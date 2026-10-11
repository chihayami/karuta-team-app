# GAS保存先の入出力実証計画

## 状態と目的

2026-10-11にユーザーが承認した計画. 既存変更を保持し, 同じ作業ブランチで実装する.
運用者から[GAS設定と同期](gas-development.md)の完了報告を受けたため, [IMP-SYS-03](implementation-plan.md#imp-sys-03)の準備として開発専用Driveフォルダへの保存・読戻しを実証する.
設定文字列の確認から進め, 小さな固定の架空データがGoogle Sheets経由でも同じ型・値で戻ることを確認する. 全DBのバックアップ方式を確定する計画ではない.

## 作業状態と既存変更

- 対象は `/workspace` の1リポジトリ. 現在の `feature/mil-sys-02-foundation` で同じマイルストーンの実証を継続する.
- 開始時にREADME・文書索引・GAS用検査設定・依存設定の変更と, 設定手順書・同期計画・GASソース・送信対象検査スクリプトの未追跡ファイルがある. ステージ済み変更・競合・merge/rebase途中の状態はない.
- これらは承認済み同期基盤の作業として保持する. 利用者による手順書の編集, `.env.local`, `.clasp.json`, Google認証情報も保持する. 計画レビューでは既存変更を保持して継続することも確認する.
- commit・Git push・Google側へのコード送信はこの計画のローカル実装に含めない. Google側への送信と実証関数の実行は, 運用者が対象と権限を確認して行う.

## 実装範囲

1. `gas/backup/src/probe-format.js` に実証用の保存形式と検証を置く. development・形式版・件数・SHA-256の整合性を確認し, 未知の版や破損を拒否する. チェックサムは破損検知に使用し, 認証や署名の代わりにはしない.
2. 固定の架空データは文字列・数値・真偽値・NULL・JSON・日付と日時の明示的な文字列表現・日本語・先頭ゼロ・数式に見える文字列を含む. JSONをUTF-8のBase64へ変換し, セルには文字列接頭辞付きで分割保存する案. データそのものを数式・日付・数値としてセルへ解釈させず, 復号後の型と値を比較する. サイズは実証用の小さな上限を設け, 大容量対応を主張しない.
3. `gas/backup/src/storage-probe.js` に `runDevelopmentStorageProbe` を追加する. 既存のdevelopment設定検証を通してから保存先フォルダを確認し, Drive advanced service v3で指定フォルダ内に新規の実証用Sheetsファイルを作る. 作成したファイルだけへSpreadsheetAppで書込み, flush後に読戻して固定データと比較する. 入力として任意のデータや既存ファイルIDを受け取らない.
4. 実証結果は成功・環境・比較した件数だけをログへ出す. 設定値・データ全体・Googleの内部例外は出さない. 運用者は専用フォルダで実証ファイルを確認する. 実証ファイルには用途が分かる名称を付け, 実証専用であることを記録する.
5. 実証は毎回新規作成とし, 既存ファイルの更新・削除・共有設定変更・定期実行を追加しない. 失敗して残った架空データのファイルも運用者が確認できる手順を記載する. この段階で自動削除や保存期限の達成を主張しない.
6. 新しいソースを `gas/backup/.claspignore` の明示的な許可リストへ追加し, `scripts/gas-check-upload.mjs` の期待する送信対象も更新する. 送信対象制限を緩めず, 新規機能のテストと文書を追加する.

DriveとSheetsの操作にGoogle権限が必要になる. 使用サービスに応じたDrive・SpreadsheetのOAuth scopeをmanifestと手順書に明示し, 運用者が開発用アカウントで確認する. 権限付与だけでフォルダ内に限定したOAuth権限になるとは扱わず, コードがアクセスする対象を限定する.

## 検証と対象ファイル

- `gas/backup/tests/probe-format.test.ts`, `gas/backup/tests/storage-probe.test.ts` を追加する. 固定データの往復一致, 破損・版・環境・件数不一致の拒否, フォルダアクセス失敗時の作成抑止, 書込・読戻し失敗時の成功抑止, 設定値の非露出, 既存ファイルを更新・削除しないことを検証する.
- 既存の設定確認関数とテストの期待結果を維持する. 送信対象検査の期待ファイル一覧だけを, 承認された新規ソースに合わせて更新する. 業務テスト仕様の期待結果は変えない.
- `gas/backup/appsscript.json`, `.claspignore`, `scripts/gas-check-upload.mjs`, GAS用lint設定, [GAS手順](gas-development.md)を対象に必要な更新を行う. 新たなnpm依存やWebの挙動変更は予定しない.
- Node.js 24で型チェック・lint・GAS対象テスト・既存テスト・送信対象検査を行う. 文書整形・リンクとID整合性・差分検査を行う.
- 実Googleへの保存・読戻しは運用者の実行結果を別途記録する. ローカルのスタブ成功を実サービスへの接続成功として扱わない.

## 後続レビューと到達点

保存した固定データの往復一致と失敗時の成功抑止を確認できれば, この準備実証は完了とする. [保存期限仕様](data-retention.md#バックアップと復元)とIMP-SYS-03全体の完了は未判定のまま維持する.

次の全DB実証では, 同一時点のスナップショット, DDL・RLS・関数, 復元先, 失効と期限の再適用, 原データ期限に追随する削除を別計画で扱う. [DEC-OPS-01](open-questions.md#dec-ops-01)の運用・復旧条件と保存先, [DEC-OPS-02](open-questions.md#dec-ops-02)の年単位境界も実装前に確定する.
TST-SYS-05・TST-SYS-06・TST-SYS-07・TST-SYS-12の総合的な期待結果を本実証だけで達成済みにはしない.

Google Sheetsの個別の版履歴はDrive APIで削除できないため, セル上の削除だけでは期限を満たせたと扱わない. 世代ファイル全体の扱いを含め, 期限が混在するデータをどう保管・削除するかを後続レビューで判断する. 保存先の仕様変更が必要なら, 実証結果を根拠に相談する.

2026-10-11に確認した公式資料:

- [Driveファイル作成](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)
- [SpreadsheetApp](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app)
- [Drive版履歴の削除制限](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/delete)

## 実装とローカル検証結果

- `runDevelopmentStorageProbe` と実証用の保存形式・固定データを追加した. フォルダの存在・種類・ゴミ箱状態・追加権限を確認し, 指定フォルダ内に新規作成したファイルのメタデータを検証してから書き込む. 既存ファイルの更新・削除・共有設定変更は行わない.
- 固定データ3件をUTF-8 JSONのBase64で分割保存する. 形式版・環境・件数・SHA-256・チャンク順とサイズを検証し, 読戻した型・値を固定データと比較する. 実証用の上限は10件・JSONのUTF-8サイズ16KiB・1チャンク512文字. UTF-8とBase64の不正表現も拒否する.
- manifestにDriveとSpreadsheetのOAuth scopeを明示した. 設定先や認証情報のファイルは更新していない. 新たなnpm依存も追加していない.
- Node.js 24.21.0で型チェック・lint・自動テスト194件が成功した. GAS112件と既存Web82件を含む. 既存ツールテスト12件も成功し, 合計206件. 既存の業務テスト仕様と設定確認の期待結果は維持した.
- `gas:check-files` が成功した. claspの実際のローカル選定でmanifestと4つのソースだけが送信対象となり, 設定ファイル・秘密値の架空サンプル・テスト・未レビューのソースが除外されることを確認した. Google認証・リモート更新は行っていない.
- 文書整形・IDとリンクの整合性・差分空白検査が成功した. Webの実装・依存は変更しておらず, 今回Webビルド・配信の再検証は行っていない.
- [security-review skill](../.agents/skills/security-review/SKILL.md)で今回の実証コード・権限・送信対象を確認した. この範囲で要修正の指摘なし. ローカルの自己レビューであり, commit前hookの実行記録やGoogle側の権限・接続検証とは区別する. 2026-10-11に[OWASPログ指針](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [Google OAuth scope](https://developers.google.com/apps-script/concepts/scopes), [Driveサービス](https://developers.google.com/apps-script/advanced/drive)を確認した.
- ローカル実装完了時点では, 更新コードのGoogle側への同期・実際の保存と読戻しは未実施だった. 下記の運用者による実行結果を受け, 保存・読戻しの準備実証を完了とする. 全DBバックアップ・復元・保存期限適用は引き続き未検証.

## 同期時の構文エラーへの対応

2026-10-11に運用者から, ローカル検査成功後の送信で `src/probe-format.g` の8行目に `ParseError: Unexpected token ILLEGAL` が出たとの報告を受けた. 送信成功・保存実証成功としては記録しない.
承認済み実装のGAS互換性修正として, 該当行の数値リテラル `16_384` を同じ値の `16384` に置き換えた. 保存上限・形式・業務テストの期待結果は変更しない.
GASソースだけに適用するlintルールと `syntax-compatibility.test.ts` を追加し, 送信前に数値区切り構文を拒否する. テストは実際のESLint設定で整数・小数・16進・2進・BigIntの区切り構文の拒否, 区切りなしの数値と文字列の許可, Webへの非適用を検証する. GASパーサー全体を再現する検査ではない.
型チェック・lint・GASテスト123件が成功した. 修正コードの再送信とGoogle側での実行結果は, 次の完了報告で確認した.

## 運用者による保存・読戻し実証の結果

2026-10-11に運用者から, `runDevelopmentStorageProbe` の実行で期待された `status: verified`, `environment: development`, `recordCount: 3` のログが出たとの報告を受けた. 修正コードの同期後, 実Google環境で固定の架空データ3件の保存・読戻しが成功した報告として記録する. AIによるGoogle側への接続・再実行は行っていない.
本計画の準備実証は完了. 次は[保存期限・世代更新・永久削除の実証計画](backup-retention-probe-plan.md)をレビューする. IMP-SYS-03とPOC-SYS-02全体の完了とは扱わない.
