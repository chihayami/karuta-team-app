# ミニアプリ仕様リポジトリ

認証, ポータル, 名簿, 練習, 大会参加希望, 大会班の仕様とテスト仕様を管理する. アプリ本体・デプロイは未実装.

- [仕様の入口](documents/README.md)
- [各Appの公開APIと連携](contracts/README.md)
- [開発版・本番版とバージョン管理](documents/development-environment.md)
- [仕様ID規則](documents/specification-conventions.md)
- [ID移行対応表](documents/id-migration.md)
- [開発ルール](AGENTS.md)
- [開発規約・Git運用・コーディング・セキュリティ](documents/development-conventions.md)

文書を更新したら, リポジトリルートで次を実行する. Python 3の標準ライブラリのみを使用する.

```sh
python3 scripts/check-docs.py
```

この検査は仕様IDとローカルリンクの整合性を確認する. API契約・業務処理・環境分離の実行テストは本体実装時に追加する.

Markdownの整形にはPrettierを使用する. Node.js 26とnpmを用意し, 初回に `npm install` を実行すると, commit前にMarkdown整形とセキュリティレビューを実行するhookが有効になる. 手動で全Markdownを整形・確認する場合は `npm run format:md` と `npm run check:md` を実行する.

Gitの初期ブランチはmain. 継続開発用のdevelopとVercelのPreview/Production連携は環境仕様に従って設定する. リモート設定とマージは人間が行う. AIによるpushは `/git-push` スキル経由に限定し, PR作成は許可する. 詳細は[Git運用規約](documents/git-workflow.md)に従う. 個人設定・資格情報・ログ・生成物はGit管理から除外する.

commit前レビューにはPython 3と, 認証済みのCodex CLIが必要. hookはステージ済みskill本文を毎回レビュー入力へ組み込み, レビューが完了しなければcommitを停止する. 初回の有効化は `npm run prepare`, 手動レビューは `npm run security:review`, 仕組みの自動テストは `npm run test:tooling` を使う. [運用条件と制約](documents/security-development.md#commit前の必須レビュー)を参照する.
