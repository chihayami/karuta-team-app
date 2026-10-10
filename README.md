# ミニアプリ仕様リポジトリ

認証, ポータル, 名簿, 練習, 大会参加希望, 大会班の仕様とテスト仕様を管理する. アプリ本体・デプロイは未実装.

- [仕様の入口](documents/README.md)
- [各Appの公開APIと連携](contracts/README.md)
- [開発版・本番版とバージョン管理](documents/development-environment.md)
- [仕様ID規則](documents/specification-conventions.md)
- [ID移行対応表](documents/id-migration.md)
- [開発ルール](AGENTS.md)

文書を更新したら, リポジトリルートで次を実行する. Python 3の標準ライブラリのみを使用する.

```sh
python3 scripts/check-docs.py
```

この検査は仕様IDとローカルリンクの整合性を確認する. API契約・業務処理・環境分離の実行テストは本体実装時に追加する.

Gitの初期ブランチはmain. 継続開発用のdevelopとVercelのPreview/Production連携は環境仕様に従って設定する. リモート設定とpushは人間が行い, 個人設定・資格情報・ログ・生成物はGit管理から除外する.
