import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const sourceDirectory = resolve("gas/backup");
const expectedFiles = [
  "appsscript.json",
  "src/config.js",
  "src/healthcheck.js",
  "src/probe-format.js",
  "src/storage-probe.js",
  "src/probe-retention.js",
  "src/retention-probe.js",
];
const directory = mkdtempSync(join(tmpdir(), "gas-upload-check-"));

try {
  mkdirSync(join(directory, "src"));
  mkdirSync(join(directory, "tests"));
  // Copy reviewed source only; never copy local project settings or credentials.
  for (const file of [...expectedFiles, ".claspignore"]) {
    copyFileSync(join(sourceDirectory, file), join(directory, file));
  }
  const fixtures = {
    ".clasp.json": JSON.stringify({
      scriptId: "FAKE_SCRIPT_ID_FOR_LOCAL_FILE_STATUS_ONLY",
      rootDir: ".",
    }),
    ".env.local": "SECRET_CANARY=never-upload-this-value\n",
    "clasp.example.json": "{}",
    "tsconfig.json": "{}",
    "tests/setup.test.ts": "export {};\n",
    "src/not-reviewed.js": "const unexpected = true;\n",
  };
  for (const [file, content] of Object.entries(fixtures)) {
    writeFileSync(join(directory, file), content);
  }

  const result = spawnSync("clasp", ["show-file-status"], {
    cwd: directory,
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(result.status, 0, "Local clasp file status failed");
  const tracked = result.stdout.split("Untracked files:")[0];
  assert(tracked, "clasp output is missing tracked files");
  const actualFiles = tracked
    .split("\n")
    .filter((line) => line.startsWith("└─ "))
    .map((line) => line.slice(3).trim())
    .sort();
  assert.deepEqual(
    actualFiles,
    [...expectedFiles].sort(),
    "GAS upload allowlist changed",
  );
  console.log(
    "GAS upload allowlist passed: manifest and six source files only",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
