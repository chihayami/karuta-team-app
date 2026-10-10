"""Exercise the hook gate with isolated Git indexes and deterministic reviewers."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('security_review', ROOT / 'scripts/security-review.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class GateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='security-gate-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git('init', '-q')
        self.skill = '---\nname: security-review\ndescription: fixture\n---\nRead the staged fixture.\n'
        self.write(review.SKILL, self.skill)
        self.write('sample.txt', 'staged content\n')
        self.git('add', '--', review.SKILL, 'sample.txt')
        self.calls = 0

    def git(self, *args):
        env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
        return subprocess.run(['git', *args], cwd=self.root, env=env, check=True, capture_output=True).stdout

    def write(self, path, text):
        dest = self.root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text)

    def runner(self, command, prompt, cwd, timeout):
        self.calls += 1
        self.assertIn(self.skill, prompt)
        self.assertIn('staged content', prompt)
        self.assertNotIn('UNSTAGED', prompt)
        self.assertNotIn('UNTRACKED', prompt)
        self.assertEqual((cwd / 'staged' / review.SKILL).read_text(), self.skill)
        self.assertEqual((cwd / 'staged/sample.txt').read_text(), 'staged content\n')
        self.assertFalse((cwd / 'staged/untracked.txt').exists())
        self.assertIn('--ignore-user-config', command)
        self.assertEqual(command[command.index('--sandbox') + 1], 'read-only')
        digest = review.state(self.root)[1]
        result = dict(status='pass', snapshot_sha256=digest,
                      skill_sha256=review.hashlib.sha256(self.skill.encode()).hexdigest(),
                      findings=[], notes=[])
        (cwd / 'result.json').write_text(json.dumps(result))

    def execute(self, runner=None):
        with patch.object(review, 'run_codex', runner or self.runner), contextlib.redirect_stdout(io.StringIO()):
            review.review(self.root)

    def test_staged_skill_and_content_ignore_worktree(self):
        self.write(review.SKILL, 'UNSTAGED SKILL MUST NOT BE USED')
        self.write('sample.txt', 'UNSTAGED CONTENT MUST NOT BE USED')
        self.write('untracked.txt', 'UNTRACKED')
        before = review.state(self.root)
        self.execute()
        self.assertEqual(self.calls, 1)
        self.assertEqual(review.state(self.root), before)
        self.assertIn('UNSTAGED', (self.root / 'sample.txt').read_text())

    def test_missing_skill_stops_before_model(self):
        self.git('rm', '--cached', '--', review.SKILL)
        with self.assertRaises(review.ReviewError):
            self.execute()
        self.assertEqual(self.calls, 0)

    def test_empty_skill_stops_before_model(self):
        self.write(review.SKILL, '')
        self.git('add', '--', review.SKILL)
        with self.assertRaises(review.ReviewError):
            self.execute()
        self.assertEqual(self.calls, 0)

    def test_changed_index_stops(self):
        def runner(*args):
            self.runner(*args)
            self.write('sample.txt', 'changed during review')
            self.git('add', '--', 'sample.txt')
        with self.assertRaisesRegex(review.ReviewError, 'レビュー中'):
            self.execute(runner)

    def test_result_failures(self):
        for mode in ('missing', 'json', 'schema', 'hash', 'skill-hash', 'block', 'incomplete', 'contradiction'):
            with self.subTest(mode=mode):
                def runner(command, prompt, cwd, timeout):
                    self.runner(command, prompt, cwd, timeout)
                    output = cwd / 'result.json'
                    value = json.loads(output.read_text())
                    if mode == 'missing':
                        output.unlink()
                        return
                    if mode == 'json':
                        output.write_text('not json')
                        return
                    if mode == 'schema':
                        value['unexpected'] = True
                    if mode == 'hash':
                        value['snapshot_sha256'] = 'old'
                    if mode == 'skill-hash':
                        value['skill_sha256'] = 'old'
                    if mode in ('block', 'incomplete'):
                        value['status'] = mode
                    if mode == 'contradiction':
                        value['findings'] = [dict(severity='high', location='sample.txt:1', reason='fixture', fix='fixture')]
                    output.write_text(json.dumps(value))
                with self.assertRaises(review.ReviewError):
                    self.execute(runner)

    def test_model_failure_stops(self):
        with patch.object(review, 'run_codex', side_effect=review.ReviewError('failed')):
            with self.assertRaises(review.ReviewError):
                self.execute(review.run_codex)

    def test_timeout_and_process_failure(self):
        for command, timeout in (([sys.executable, '-c', 'import time; time.sleep(10)'], 0.05),
                                 ([sys.executable, '-c', 'raise SystemExit(1)'], 2),
                                 (['/nonexistent/security-review-codex'], 2)):
            with self.subTest(command=command), self.assertRaises(review.ReviewError):
                review.run_codex(command, 'fixture', self.root, timeout)

    def test_partial_markdown_stops_before_formatting(self):
        self.write('notes.md', 'staged\n')
        self.git('add', '--', 'notes.md')
        self.write('notes.md', 'unstaged\n')
        before = review.state(self.root)
        with self.assertRaises(review.ReviewError):
            review.preflight(self.root)
        self.assertEqual(review.state(self.root), before)
        self.assertEqual((self.root / 'notes.md').read_text(), 'unstaged\n')

    def test_symlink_does_not_escape_snapshot(self):
        (self.root / 'escape').symlink_to('/etc/passwd')
        self.git('add', '--', 'escape')
        with self.assertRaises(review.ReviewError):
            self.execute()
        self.assertEqual(self.calls, 0)

    def test_binary_stops_before_model(self):
        (self.root / 'data.bin').write_bytes(b'\x00\xff')
        self.git('add', '--', 'data.bin')
        with self.assertRaises(review.ReviewError):
            self.execute()
        self.assertEqual(self.calls, 0)

    def test_snapshot_size_limit_stops(self):
        with patch.object(review, 'MAX_BYTES', 10), self.assertRaises(review.ReviewError):
            self.execute()
        self.assertEqual(self.calls, 0)

    def test_hook_runs_after_formatter_and_propagates_failure(self):
        # Execute the real shell hook, using a deterministic Codex stand-in.
        for source in ('scripts/security-review.py', 'scripts/security-review.schema.json'):
            self.write(source, (ROOT / source).read_text())
        self.write('node_modules/.bin/lint-staged', '#!/bin/sh\necho formatted > formatted.marker\n')
        formatter = self.root / 'node_modules/.bin/lint-staged'
        formatter.chmod(0o755)
        fake = self.root / 'bin/codex'
        self.write('bin/codex', '''#!/usr/bin/env python3
import json, os, pathlib, re, sys
prompt = sys.stdin.read()
assert 'Read the staged fixture.' in prompt
assert pathlib.Path(os.environ['FIXTURE_ROOT'], 'formatted.marker').exists()
pathlib.Path(os.environ['FIXTURE_ROOT'], 'review.marker').write_text('invoked')
if os.environ.get('FAKE_PASS') == '1':
    digest = re.search(r'snapshot_sha256は([0-9a-f]{64})', prompt).group(1)
    skill = re.search(r'skill_sha256は([0-9a-f]{64})', prompt).group(1)
    output = pathlib.Path(sys.argv[sys.argv.index('--output-last-message') + 1])
    output.write_text(json.dumps(dict(status='pass', snapshot_sha256=digest, skill_sha256=skill, findings=[], notes=[])))
    sys.exit(0)
sys.exit(1)
''')
        fake.chmod(0o755)
        env = dict(os.environ, PATH=str(fake.parent) + os.pathsep + os.environ['PATH'], FIXTURE_ROOT=str(self.root))
        for key in list(env):
            if key.startswith('GIT_'):
                del env[key]
        result = subprocess.run(['sh', str(ROOT / '.husky/pre-commit')], cwd=self.root, env=env, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((self.root / 'review.marker').exists())
        result = subprocess.run(['sh', str(ROOT / '.husky/pre-commit')], cwd=self.root, env=dict(env, FAKE_PASS='1'), capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        (self.root / 'review.marker').unlink()
        formatter.write_text('#!/bin/sh\nexit 1\n')
        result = subprocess.run(['sh', str(ROOT / '.husky/pre-commit')], cwd=self.root, env=env, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / 'review.marker').exists())


if __name__ == '__main__':
    unittest.main()
