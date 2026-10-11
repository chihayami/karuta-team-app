---
name: git-push
description: "Stage selected changes, create commits through the existing /commit skill, and push them after explicit user confirmation. Use when the user asks to commit and push or invokes /git-push."
---

# /git-push スキル

コミット作成は既存の [`/commit` スキル](../commit/SKILL.md) に委譲し、その成功後にユーザー確認を得て現在のブランチを push する.

## 実行フロー

### 1. 状態と対象ファイルを確認する

- `git status --short --branch`, `git diff --cached`, `git diff` でブランチと変更を確認する.
- 未追跡ファイルも候補に含める. 内容を確認し、機密情報や生成物を候補から除外する.
- 既存の staged changes がある場合はそのファイルも一覧に含める. コミットから除外したい staged changes があれば、index を変更せずユーザーに調整を依頼して停止する.
- 対象ファイル、コミットの分割案、変更の概要をユーザーに示し、どのファイルを stage するか確認する. 確認前に `git add` しない.
- staged changes がなく、stage する変更もない場合は終了する. コミットが作成されなければ push しない.

### 2. 選択されたファイルを stage する

- 承認されたファイルだけを `git add -- <個別パス>` で stage する.
- `git add .`, `git add -A`, glob による一括追加は使わない.
- 機密ファイルや `/commit` スキルが除外するファイルは stage しない. 除外対象があればユーザーに知らせる.
- stage 後に `git diff --cached` で index の内容を確認する. 承認された対象と異なる場合は停止し、勝手に unstaging や rollback をしない.

### 3. `/commit` スキルにコミットを委譲する

- 既存の `/commit` スキルをサブフローとして呼び出し、その指示に従う. コミットメッセージの作成、確認、分割判断、コミット実行を独自に置き換えない.
- `/git-push` の依頼は、このスキル内で `/commit` を呼び出す明示的な指示として扱う.
- `/commit` がキャンセルされた場合、失敗した場合、またはコミットを作成しなかった場合は停止する. push しない.

### 4. push 先を示して承認を得る

- コミット成功後、現在のブランチ、remote 名、upstream のブランチ、および push 対象となる outgoing commits を確認する.
- push 先が不明な場合は remote 名とブランチ名をユーザーに尋ねる. remote URL や認証情報は表示しない.
- 実行する push の宛先と対象コミットをユーザーに示し、push の明示承認を得る. `/git-push` の起動だけを push 承認とはみなさない.
- detached HEAD、merge conflict、merge / rebase の途中状態などで安全な push 先を特定できない場合は停止して報告する.

### 5. 承認後に push する

- 承認された宛先に対し、通常の `git push` のみ実行する.
- `--force`, `--force-with-lease`, `--mirror` は使わない.
- push が失敗した場合はそこで停止して結果を報告する. 自動 retry や別の push オプションへの切り替えはしない.
- 成功後に `git status --short --branch` を確認し、commit と push の結果を報告する.

## 禁止事項

- `/commit` を使わずに独自の `git commit` を実行すること.
- ユーザーの確認なしにファイルを stage したり push したりすること.
- `git reset`, stash, discard, commit amend による自動 rollback や変更破棄.
- `--no-verify` で hook を回避すること.
