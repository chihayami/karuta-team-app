# ローカル開発と環境設定

## 実装済みの範囲

MIL-SYS-02 / IMP-SYS-02の最初の基盤実装. Next.jsでログイン前の準備画面, 環境・版表示, 設定検証を提供する. 認証・認可・公開API・業務データ操作・バックアップは後続工程で実装する.
環境設定の検証はセッション検証やDB資格情報の検証を代替しない.

Webの組立は `web/app/`, 共通基盤は `web/src/platform/`, 共通表示は `web/src/components/` に置く. 各Appの業務処理・テスト・マイグレーションは `app/<所有App>/` に置く構成を維持する.

## 起動

Node.js 24 LTSとnpmを使用する. `.nvmrc` は `24`, `package.json` の `engines.node` は `24.x`. Vercelでも24.xを選択し, ローカルと配信のメジャー版を統一する. 対応の確認記録は[無料運用と配信の確認](free-operation-check.md)を参照する.

```sh
npm ci
cp web/environment.example web/.env.local
npm run dev
```

コピー前に既存の `web/.env.local` がある場合は内容を保持する. `APP_GIT_SHA` を対象の完全SHAへ更新する. 取得には `git rev-parse HEAD` を使用できる. 作業ツリー変更はそのコミットに含まれないため, この状態の成果物を本番へ配信しない.
`http://localhost:3000` から開く. サンプルはローカル限定の架空設定であり, LINE・DB・GASへの外部通信は発生しない.
Next.jsの `NODE_ENV=production` はビルド方式を表すため, 本システムの開発・本番の区別には使用しない.

## 設定の境界

以下をNext.jsの実行環境へ渡す. ローカルでは `web/.env.local` を使い, Git管理しない. `web/environment.example` に秘密値を追加しない.

| 変数                       | 用途と制約                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENVIRONMENT`          | `development` または `production`                                                                                          |
| `APP_DEPLOYMENT_TARGET`    | `local`, `preview`, `production`. local・previewはdevelopmentのみ                                                          |
| `APP_ORIGIN`               | 同一環境の承認したWeb origin. パス・クエリ・認証情報を含めない. localのみloopbackを使用                                    |
| `APP_ENVIRONMENT_BINDINGS` | 開発・本番の期待接続先のJSON. 各環境の `origin`, `supabaseProjectRef`, `lineChannelId`, `liffId`, `gasDeploymentId` を指定 |
| `APP_SUPABASE_URL`         | 期待するproject refに対応する `https://<ref>.supabase.co`                                                                  |
| `APP_LINE_CHANNEL_ID`      | 対象環境のLINEチャネルID                                                                                                   |
| `APP_LIFF_ID`              | 対象環境のLIFF ID                                                                                                          |
| `APP_GAS_DEPLOYMENT_ID`    | 対象環境のGASデプロイID                                                                                                    |
| `APP_GIT_SHA`              | 40桁の小文字16進のソースSHA. VercelのソースSHAがある場合は一致必須                                                         |
| `APP_CONFIG_REVISION`      | 非秘密の設定改訂識別子. 設定変更時に更新し再ビルドする                                                                     |

期待接続先は運用者が各サービスの設定と照合して管理する. 開発・本番の各識別子を共用できない. 実際の値を取り違えたまま期待値にも同じ値を設定する誤りを, 文字列比較だけで検出できるとは扱わない.
個別Previewでは対象の確認用originを明示する. LINEのコールバック・LIFF入口には継続開発用の固定URLを使い, 任意のPreview URLを無条件に登録しない.

Vercelの `VERCEL_ENV`, `VERCEL_TARGET_ENV`, Gitブランチ・SHAが提供されている場合も照合する. `develop` というブランチ名だけで開発環境と判定しない. `main` のProductionには本番設定, `develop` と許可された作業ブランチのPreviewには開発設定を渡す.
ローカル用の `.invalid` originや未設定相当のゼロSHAによる公開用ビルドを拒否する.

必要値の不足・不一致はビルド時に拒否する. ビルド後に環境・SHA・ソース版・設定改訂が変わった場合も, ページ描画前に503で拒否し設定値を返さない. サーバー専用モジュールは `server-only` でクライアントからのimportを防ぐ.
表示へ渡すのは環境・ソース版・SHA等の非秘密の版情報だけ. 全体設定・トークン・DB特権資格情報は渡さない. 今回は秘密資格情報の読込や外部サービスへの接続を実装しない.

## 版表示と検査

ソース版はルート `package.json` の `version`. 初期基盤の版は `0.1.0` とし, 初回リリース完了を意味しない.
開発版は `0.1.0-dev.<shortSHA>`, 本番版は `0.1.0`. 共通フッターは未ログイン画面・404にも環境と短縮SHAを表示する.
ビルドへ埋め込むのは非秘密の版識別のみ. デプロイID・契約版・DB版・配信記録は実デプロイと各方式の確定後に追加する.

| コマンド                        | 検査                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run typecheck`             | strict TypeScriptと設定ファイルの型検査                                               |
| `npm run lint`                  | ESLint, TypeScript, React Hooksの静的検査                                             |
| `npm run test`                  | 環境設定・環境混同拒否・版識別・表示の自動テスト                                      |
| `npm run build`                 | 現在の明示的な設定でNext.jsをビルド                                                   |
| `npm run test:smoke`            | 開発用ビルドをloopbackで起動し, HTML・404・ヘッダー・設定改訂不一致の描画前拒否を確認 |
| `npm run check:md`              | 全Markdownの整形確認                                                                  |
| `python3 scripts/check-docs.py` | 仕様IDとローカルリンクの整合性                                                        |
| `npm run test:tooling`          | 既存commit前レビュー処理の自動テスト                                                  |
| `npm audit`                     | lockfileに基づく依存関係の検査                                                        |

自動テストはTST-ENV-02・TST-ENV-03・TST-ENV-05・TST-SYS-15のうち今回の設定・版表示の範囲を検証する. 他環境のセッション拒否, クライアント成果物の実資格情報混入, デプロイID追跡, 実サービス分離等は後続実証で確認する.
HTTP検査は実サービスに接続せず, 架空の接続先とビルドの版情報を使う. 本番用設定の成果物に対して実行しない.

採用版は `package.json` と `package-lock.json` に記録する. TypeScriptはtypescript-eslintがサポートする安定版6.0.3を選定した. ESLint10に対応するTypeScript・React Hooksの規則を組み合わせる. 根拠は[公式の依存サポート範囲](https://typescript-eslint.io/users/dependency-versions/)と各パッケージのpeerDependenciesを2026-10-10に確認した.
