# MIL-SYS-02 着手計画

## 状態と目的

2026-10-10にユーザーが順序1と2を承認. 既存39ファイルのMarkdown整形を先に直す追加指示と, 非営利の会員制団体である前提を確認済み.
[マイルストーン](scope-and-milestones.md)と[実装順序](implementation-plan.md)に従い, MIL-SYS-01の前提整理とMIL-SYS-02の先行実証から着手する.

- 対象リポジトリは `/workspace`. 作業領域のGitリポジトリは1件.
- 開始時の `main` は作業ツリー・indexともクリーン. 競合・merge/rebase途中の状態なし.
- ローカル `develop` から `feature/mil-sys-02-foundation` を作成・切替済み. `main` と `develop` のファイル差分なし.
- 着手前はアプリ本体・DBマイグレーション・実行可能なアプリテストが未実装だった.
- リモートとの同期と外部サービスの設定状態は未確認.

## 工程と今回の実装範囲

| 順序 | 工程                    | 作業と到達点                                                                                             |
| ---- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| 1    | MIL-SYS-01 / IMP-SYS-01 | 未決事項を対象工程別に整理する. 業務判断や無料利用可否を承認済みと推定しない                             |
| 2    | MIL-SYS-02 / IMP-SYS-02 | 今回の最初の実装単位. Web・型・検査の基盤, 環境設定検証, 表示版, 開発版表示, 非秘密の設定手順を追加する  |
| 3    | MIL-SYS-02 / IMP-SYS-03 | 架空データで保存・期限適用・復元の先行実証. 年単位境界・復旧条件と保存先を確定してから対象処理を実装する |
| 4    | MIL-SYS-02 / IMP-SYS-04 | 最小のLINE認証・JWT・RLSを実証. 偽装・越権・環境混同・失効を検証する                                     |
| 5    | MIL-SYS-03以降          | 実証結果とMIL-SYS-01の合意を確認後, 認証・会員基盤, 名簿, 練習, 通し試験の順に進む                       |

今回のレビュー対象は順序1と2. 順序3以降の具体的な方式・対象ファイル・テストは実証結果と未決事項の判断を反映して計画を更新する.
基盤のローカル検査が通ってもMIL-SYS-02全体の完了とは扱わない.

## 実装方針と対象ファイル

- ユーザーの追加判断に従いNode.js 24 LTSへ統一し, Vercel構成を維持する. `.nvmrc`, `engines.node`, Node.js型定義と関連文書を24系へ合わせる. TypeScriptの `strict` を有効にする. Next.js App Router, ESLint, Vitestを採用する案. 依存の正確な版は実装時に公式配布元の最新安定版・互換性を確認し, `package-lock.json` で固定する.
- `package.json`, `package-lock.json`, TypeScript・lint・テスト設定に実行コマンドを定義する. 既存の文書検査・commit hookを維持する.
- `web/app/` はNext.jsのルーティングと薄い画面組立を担当する. 将来の業務実装・単体テスト・マイグレーションは既存の `app/<所有App>/` に置く. 今回は業務テーブル・公開APIを追加しない.
- `web/src/platform/` に環境設定と版識別の検証を置く. 開発・本番, 配信環境, 接続先識別, ソース版, 完全SHAを明示し, 必須値欠落・不整合ではビルドまたは処理を拒否する. 本番の既定値で補完しない.
- `web/src/components/` に共通の環境・版表示を置く. ログイン前から表示し, 開発版では初期化の可能性を製品向けの句読点で案内する. サーバー専用設定や秘密値を画面へ渡さない.
- `tests/integration/` に設定欠落・環境不一致・版識別の自動テストを追加する. 実Vercelの配信・LINEログイン・DB分離は外部設定後に別途検証する.
- `README.md` と環境設定手順にローカル起動・検査コマンドと設定変数の用途を記載する. 秘密値は記載しない.

参照: [Next.jsの導入](https://nextjs.org/docs/app/getting-started/installation), [TypeScriptの導入](https://www.typescriptlang.org/download/), [Vitestの導入](https://vitest.dev/guide/). 2026-10-10に公式資料を確認した.

## 検証と受入

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` を定義し実行する. 版表示と開発案内は画面でも確認する.
- [環境テスト仕様](../tests/integration/environments.md)のTST-ENV-02・TST-ENV-03・TST-ENV-05と, [結合テスト仕様](../tests/integration/specification.md)のTST-SYS-15に対応する今回の範囲を自動化する. 各IDの未実装範囲と実サービス確認は結果に明記する.
- 開発用の架空設定と隔離したテスト設定を使用する. 本番DBへ試験データを書き込まない.
- 既存テスト仕様の期待結果は維持する. 未決の業務仕様を固定するテストは今回追加しない. 期待結果の変更が必要になった場合は計画に変更前後と根拠を示してレビューを依頼する.
- 文書変更には `python3 scripts/check-docs.py` と `npm run check:md` を実行する. ユーザーの追加指示により既存39ファイルの整形不備を先に修正してから基盤実装へ進む. 業務仕様とテストの期待結果は変えない.
- 依存導入後に依存関係検査を実行する. 認証・認可の実装時には拒否系と権限境界の検査・セキュリティレビューを追加する.

## 未確定事項と外部検証

- 初回の業務判断は[設計判断](open-questions.md)に従って確定する. 今回は氏名制約, 会員状態, 閲覧範囲, 年単位保持の境界を実装で決めない.
- IMP-SYS-02の実サービス確認には開発用Vercel・Supabase・LINE/LIFFと指定検証者の設定が必要. 設定の有無を確認し, 実値はGitやチャットへ貼り付けない.
- 団体としての無料利用可否・容量・定期実行・停止条件を公式資料と対象設定で確認する. 課金契約やデプロイは今回の基盤実装に含めない.
- IMP-SYS-03にはDEC-OPS-01・DEC-OPS-02の判断と, 版履歴を含む削除制御可能範囲の検証が必要. モックやローカル成功を保存先の実証の代用にしない.
- IMP-SYS-04では利用者JWTの方式・鍵運用・RLS・失効を実証して方式をレビューする. 長期間有効なトークンだけで現行権限を保証しない.

## 着手前の検査結果

- `python3 scripts/check-docs.py`: 成功. 既存66文書, 217 ID, 1041ローカルリンクに不整合なし.
- `npm run test:tooling`: 成功. 12件.
- `npm run check:md`: 着手前は既存39ファイルの整形不備で失敗. ユーザーの追加指示により基盤実装前に修正済み.

## 承認後の進捗

- 既存39ファイルのMarkdown整形を修正し, 基盤実装前に全体の整形・文書整合性検査が通ることを確認した.
- Web基盤, 環境設定と期待接続先の照合, ビルド版の照合, 共通フッター, 自動テストを追加した. 実装と検査手順は[ローカル開発](local-development.md)を参照.
- [無料運用の確認記録](free-operation-check.md)に非営利団体の前提, 公式の無料枠条件, 対象工程の未決事項を整理した.
- TypeScriptの採用版はlint基盤のサポート範囲内で選定した. 依存検査で未修正版のbracesを含むことが分かったeslint-config-nextは採用せず, ESLint・TypeScript・React Hooksの対応した規則を組み合わせた. 最終依存に当該経路は残さない.
- Node.js 26とVercelの対応版の不一致について, 2026-10-10にユーザーが24 LTSへの統一とVercel構成の維持を選択した. 24系へ指定・型定義・lockfile・文書を更新し, Node.js 24.21.0で型検査・lint・自動テスト94件・ビルド・HTTP検査が成功した. 既存テストの期待結果は維持した. 文書検査も成功し, 依存検査の指摘は0件. MIL-SYS-02の実サービス実証は未完了.

## 基盤実装の検証結果

- 型チェック・lint・Next.jsビルド: 成功.
- 環境設定と版表示の自動テスト82件, 既存ツールテスト12件: 成功.
- HTTP検査: 通常ページ・404の環境と版, ヘッダー, 設定改訂不一致時の描画前503拒否を確認した.
- Chromiumで390pxと1280px幅の表示, 横方向のはみ出しなし, キーボードの本文移動リンク, 日本語404と復帰, ページ例外なしを確認した. 隔離した一時Playwrightを使用し, プロジェクトの依存には追加していない.
- 全Markdown整形・文書IDとリンク整合性・差分空白検査: 成功.
- `npm audit`: 指摘0件.
- [security-review skill](../.agents/skills/security-review/SKILL.md)で今回のコードと設定例を確認した. 入力値を含めないエラー, 設定の明示的照合, サーバー専用モジュール, 公開表示への最小情報のみの受渡しを確認し, この範囲で要修正の指摘なし. 参照は[OWASP入力検証](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), [OWASPログ](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [Next.jsのServer/Client境界](https://nextjs.org/docs/app/getting-started/server-and-client-components). 2026-10-10確認. commit hookによるレビューの実行記録とは区別する.
- LINE実機, DB/RLS, 実Vercelの配信・分離, バックアップ・復元は未実施. これらの完了条件は後続実証で維持する.
