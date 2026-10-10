# AGENTS.md

## 関連する開発規約

本書はAIの基本動作と操作制限を定める. 詳細な作業手順と実装上の規則は次を参照する. skillの手順を根拠に本書の操作制限を緩和しない.

- [開発規約](documents/development-conventions.md)
- [Git運用規約](documents/git-workflow.md)
- [コーディング規約](documents/coding-conventions.md)
- [セキュリティ開発規約](documents/security-development.md)

## 開発ルール

- 必ずimplementation前に計画を立て, 計画後に計画のレビューを依頼すること. 計画に沿ってimplementationを行うこと.
- 作業開始時にカレントディレクトリおよび対象リポジトリを確認すること
- 挙動が変わるような修正時には既存のテストを修正すること.
- テストの仕様変更は勝手に行わず, 計画時に相談すること.
- 新規機能追加時には自動テストも追加すべきである

## 日本語出力のルール

- アスタリスクを用いる太字・斜体の修飾を禁じる
- 絵文字を用いないこと
- 開発者向け環境においては, 日本語中でも半角カンマ,半角ピリオド.を用いること.
- 製品ユーザに見える文章は, 句読点、。を用いること
- 全角スペースは一切の使用を禁じる

## Git利用のルール

AIは作業開始前にGit管理されているすべてのリポジトリの状態を確認する.
次のいずれかが存在する場合, implemetion planにて重要な確認として人間に確認する.

- stagedな変更
- modifiedな変更
- deleted なファイル
- untracked なファイル
- merge conflict
- rebaseまたはmergeの途中状態

以下の操作は禁じる.

- tag, releaseの作成
- stash, discard
- マージ全般（ローカルマージ・PRマージ・自動マージの設定を含む）

以下の操作のみが許可される.

- `git status`による状態確認
- 差分確認
- `feature/`, `fix/`, `docs/`, `chore/`, `hotfix/` の作成・切替は[Git運用規約](documents/git-workflow.md)の分岐元に従う場合のみAIに許可する. `main`・`develop` の作成・切替, リモート設定・同期, ブランチ削除は人間が行う.
- local commitは`/commit` skillを利用してのみ許可される.
- commit前のセキュリティレビューはpre-commit hookで必須実行する. `--no-verify`, `HUSKY=0`, hook設定変更による回避は禁止する.
- pushは`/git-push` skillを利用してのみ許可される.
- ステージングは`/commit`・`/git-push` skillの手順に従う場合のみ許可される.
- PR作成はAIに許可する. マージは人間が実施する.
