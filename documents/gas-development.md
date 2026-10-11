# GASの設定先とコード同期

## 現在の状態

2026-10-11にGAS同期基盤を実装し, 運用者から設定完了の報告を受けた. 同日に承認された[保存先の入出力実証計画](gas-storage-probe-plan.md)に従い, 架空データの保存・読戻し用コードも追加した. AIによるGoogle側の保存・読戻しは未実施.
運用者から `runDevelopmentStorageProbe` の期待された成功ログを確認したとの報告を受け, 保存・読戻しの準備実証を完了として記録した. 同日に承認された[期限適用と永久削除の実証計画](backup-retention-probe-plan.md)の工程1を実装した. Google側での期限適用・永久削除の実証は運用者の実行待ち.
`gas/backup/` に設定確認関数・実証関数・manifest・送信対象制限と自動テストがある. Google側への同期とエディタからの実行は運用者が行う. Webからの接続・DBバックアップ処理は後続実装.
この手順で同期するのは, 作成済みの開発用GASプロジェクト. 既存の本番プロジェクトや保存先を指定しない.

## 設定先の対応

| 情報                   | 取得場所                                             | 設定先                                                                                     | 用途・現在の扱い                                          |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Script ID              | GASエディタの「プロジェクトの設定」→「スクリプトID」 | 同期用ディレクトリ内の `.clasp.json` の `scriptId`                                         | claspがコードを送る対象. WebのDeployment ID欄には入れない |
| 保存フォルダID         | 開発用DriveフォルダのURLの `/folders/` 以降          | GASの「プロジェクトの設定」→「スクリプト プロパティ」                                      | `BACKUP_FOLDER_ID` として登録. 設定確認関数が読み込む     |
| Web appのDeployment ID | GASでWeb appをデプロイした後の「デプロイを管理」     | `web/.env.local` の `APP_GAS_DEPLOYMENT_ID` と期待値JSON内の `development.gasDeploymentId` | Web appを呼ぶ場合の識別子. 現在は仮値を維持する           |
| claspのGoogle認証      | `clasp login` によるブラウザ認証                     | ローカルの `.clasprc.json`                                                                 | 認証情報. Gitやチャットへ載せない                         |

時間トリガーからGAS関数を実行するだけならWeb appのデプロイは不要. `clasp push` とWeb appの公開は別操作. コード送信先を決めるのはScript IDであり, Deployment IDではない. [claspの公式手順](https://developers.google.com/apps-script/guides/clasp), [GASのdeployment](https://developers.google.com/apps-script/concepts/deployments)

## GASのスクリプトプロパティ

承認済みの[同期基盤の計画](gas-sync-plan.md)に従って実装した設定. 以下をGAS側へ登録してから, コードを同期し設定確認関数を実行する.

1. GASプロジェクトを開き, 左の歯車「プロジェクトの設定」を開く.
2. 「スクリプト プロパティ」で「スクリプト プロパティを追加」または「編集」を選ぶ.
3. 次の名前と値を登録し, 保存する.

| プロパティ名       | 値                                |
| ------------------ | --------------------------------- |
| `APP_ENVIRONMENT`  | `development`                     |
| `BACKUP_FOLDER_ID` | 作成した開発専用DriveフォルダのID |

GASはWebの `.env.local` を読み込まない. GAS側の設定はスクリプトプロパティ, Web側の設定は `.env.local` として分ける. Script propertiesはプロジェクト内で共有されるため, GASの編集者を実証担当者に限定する. [プロパティ設定の公式手順](https://developers.google.com/apps-script/guides/properties#manage_script_properties_manually)
Supabaseのsecret keyやDBパスワードは今回の同期基盤では使用しない. DB保存・復元の実装と権限設計ができてから必要な接続方式を決める.

## claspによる初回の紐付け

以下は運用者が実行するコマンド. Node.js 24 LTSを使用する. CLIは公式パッケージ `@google/clasp` の3.4.1へ固定し, コマンド実行だけに使う. この手順でプロジェクトのnpm依存には追加しない.

### 1. Apps Script APIを有効にする

[Apps Scriptのユーザー設定](https://script.google.com/home/usersettings)でApps Script APIを有効にする. GASのDrive advanced serviceとは別設定.

### 2. Googleアカウントで認証する

ブラウザ認証ができる端末で実行する. 開発用GASを作成した, または編集権限を持つアカウントを選ぶ.

```sh
npm run gas:login
```

ブラウザのlocalhostへ戻れない環境では, CLIが案内する手順に従って次を使用する. 認証コードやトークンをチャットへ貼り付けない.

```sh
npx --yes @google/clasp@3.4.1 login --no-localhost
```

### 3. 作成済みのGASへ紐付ける

現在の作業ディレクトリは `/workspace`. ローカルのコードは既に `gas/backup/` にあるため, このディレクトリへcloneしてソースを上書きしない.
`gas/backup/.clasp.json` がまだない場合だけ次を実行する. 既にある場合はその設定を保持し, 対象を確認する.

```sh
cp gas/backup/clasp.example.json gas/backup/.clasp.json
```

生成した `.clasp.json` をエディタで開き, `scriptId` の `REPLACE_WITH_DEVELOPMENT_SCRIPT_ID` を作成した開発用GASのScript IDへ置き換える. `rootDir` は `.` のままにする. Script IDはGASのプロジェクト設定で取得する. このファイルと `.clasprc.json` は既存の `.gitignore` で除外される.

Google側の既存ソース・manifestはエディタで確認する. 独自の処理がある場合はpush前に取り扱いをレビューする. 必要なら別の空のディレクトリで `npx --yes @google/clasp@3.4.1 clone-script '開発用Script ID'` を実行して参照用コピーを取得し, `gas/backup/` へ直接上書きしない.
ローカルmanifestはV8・Asia/Tokyo・Drive advanced service v3と, 下記のDrive・Sheets操作と削除結果のHTTP確認用OAuth scopeを指定している. Google側で追加していた必要な設定がある場合は, 内容を確認してローカルmanifestへ引き継ぐ.

### 4. コードを送る

リポジトリルート `/workspace` から実行する. `gas:status` と `gas:push` は内部で `gas/backup` へ移動する.

```sh
npm run gas:check-files
npm run gas:status
npm run gas:push
```

`gas:check-files` は架空のScript IDと一時ディレクトリで送信対象制限を検査し, Google認証やリモート更新を行わない. `gas:status` は設定したプロジェクトのローカル送信対象を表示する. `gas:push` は送信対象検査・GAS用の型チェック・lint・テストが通ってから送信する.
送信前に `.clasp.json` の対象が開発用Script IDであることと, Tracked filesが次の7ファイルだけであることを確認する.

```text
appsscript.json
src/config.js
src/healthcheck.js
src/probe-format.js
src/storage-probe.js
src/probe-retention.js
src/retention-probe.js
```

`--force` や自動watchは使用しない. pushはGoogle側のHEADの内容を置き換える. 送信リストに含まれない既存ファイルが保持されるとは扱わないため, エディタだけで編集した内容との食い違いは送信前に解消する. [Apps Script APIの更新仕様](https://developers.google.com/apps-script/api/reference/rest/v1/projects/updateContent)
`git push` とは別操作であり, `/git-push` skillの実行許可をGASへの反映許可とは扱わない.

送信時に `ParseError: Unexpected token ILLEGAL line: 8 file: src/probe-format.g` が報告された旧コードでは, 8行目の数値リテラルが `16_384` だった. `16384` に修正し, GAS用lintで数値の区切り記号を拒否する検査を追加した. 同じエラーが出る場合はローカルの8行目と送信対象を確認して, 更新コードを再送する. Node.js上の型チェック・テスト成功だけでGASの同期時パーサーとの互換性まで保証しない.

### 5. GASエディタから設定確認関数を実行する

送信後にGASエディタを開き直し, 同期されたソースを確認する. 関数の選択で `checkDevelopmentSetup` を選び実行する. スクリプトプロパティが正しければ, 実行ログに次を出力する.

```json
{
  "status": "configured",
  "environment": "development",
  "backupFolderConfigured": true
}
```

この結果は設定文字列を読めたことを示す. Driveフォルダの存在・アクセス権・DB接続・バックアップの成功を意味しない. IDや秘密値は出力しない.
未設定やproduction指定ではエラーになり, 成功ログを出さない. Web appのdeploy・定期トリガー作成・DBへのアクセスはこの同期確認に含めない.

## 保存・読戻し実証の実行

初回設定を完了している場合は, 上の手順4で現在の7ファイルを同期し, 次を実行する. 設定用の `.clasp.json` とスクリプトプロパティはそのまま使う.

1. `BACKUP_FOLDER_ID` のフォルダが開発専用であり, 実行するアカウントにファイル作成権限があることを確認する. この実証はMy Driveの専用フォルダを対象とし, Shared Driveへの対応は検証していない.
2. GASエディタを開き直し, `runDevelopmentStorageProbe` を選んで1回実行する. 関数に引数を指定しない. 新たな認可画面が表示されたら, 開発用アカウントと以下の権限を確認する.
3. 実行ログの成功結果と, 保存先フォルダ内にできた `development-storage-probe-` で始まる新規Sheetsファイルを確認する. ログに出る成功結果は次のとおり.

```json
{
  "status": "verified",
  "environment": "development",
  "recordCount": 3
}
```

この結果は, 新規ファイルへ保存した固定の架空データ3件を読戻し, 形式・環境・件数・SHA-256と元の型・値の一致を確認できたことを示す. 全DBの整合したバックアップやDBへの復元, 保存期限適用は後続の実証.
ファイルには実証用メタデータと接頭辞付きBase64文字列が並ぶ. 数式に見える値や先頭ゼロはセルへ直接展開しない. 保存形式は実証用であり, そのまま業務バックアップの正式形式とは扱わない. SHA-256は破損検知用であり, 署名や改変者の認証にはならない.

### 使用する権限

| OAuth scope                                               | 用途                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `https://www.googleapis.com/auth/drive`                   | 設定済みフォルダの確認と, その中への新規Sheetsファイル作成・メタデータ確認 |
| `https://www.googleapis.com/auth/spreadsheets`            | 新規作成したSheetsファイルへの書込と読戻し                                 |
| `https://www.googleapis.com/auth/script.external_request` | 永久削除実証で, 固定のGoogle Drive APIに削除前後のHTTP状態を確認する       |

これらのOAuth権限自体は専用フォルダだけに限定されない. 実装では設定済みフォルダと今回新規作成したファイルにアクセス先を限定する. 実証専用のGASと開発用アカウントで行い, 本番プロジェクトにこのmanifestを反映しない. DB資格情報は不要.
Sheetsは組込みのSpreadsheetAppを使用するため, Sheets advanced serviceの追加は不要. Drive advanced service v3は既存manifestにある. GASが自動作成するデフォルトのCloudプロジェクトでは, サービス追加時に対応するAPIも有効になる. 標準Google Cloudプロジェクトを手動で紐付けている場合は, Google Cloud側のDrive API有効化も確認する. [advanced serviceの有効化](https://developers.google.com/apps-script/guides/services/advanced), [OAuth scope](https://developers.google.com/apps-script/concepts/scopes)

### 失敗時と実証ファイルの扱い

エラーは工程を示す固定メッセージであり, Googleの内部例外・ID・保存データを出さない. フォルダ確認で失敗した場合は新規作成しない. ファイル作成後の書込や読戻しで失敗した場合は, 空または途中まで保存された架空データの実証ファイルが残ることがある. 作成応答が失敗した場合でも, サービス側で作成済みとなる可能性があるため, 再実行前にフォルダを確認する.

| エラー                                                                             | 確認する箇所                                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `APP_ENVIRONMENT must be development`                                              | GASスクリプトプロパティの値が引用符・空白なしの `development` であること. Webの `.env.local` とは別設定 |
| `Unable to access writable development backup folder`                              | 保存先ID, フォルダの存在・ゴミ箱状態・ファイル追加権限, Drive serviceとGoogle権限                       |
| `Unable to create development probe file`                                          | Drive権限・容量, 新規ファイルが専用フォルダ内に残っていないか                                           |
| `Unable to write development probe file`                                           | Sheets権限, 新規ファイルが開けるか                                                                      |
| `Unable to read development probe file`                                            | Sheets権限, 実証ファイルの行列数が変更されていないか                                                    |
| `Invalid development probe data` / `Development storage probe verification failed` | 保存内容が変わっていないか. 成功扱いにせず, エラー名と発生工程を記録                                    |

保存・読戻し実証の再実行は別の新規ファイルを作成し, 以前のファイルを再利用・上書きしない. 調査が終わった実証ファイルは, 運用者が名前・作成時刻・内容を確認して個別に片付ける. フォルダ全体や既存ファイルを一括削除しない. `runDevelopmentStorageProbe` は自動削除・共有設定変更・定期トリガー登録を行わない. 次の永久削除実証では, その実行中に新規作成した対象だけを削除する.
ゴミ箱への移動だけでバックアップの削除期限を達成したとは扱わない. Google Sheetsの個別の版履歴削除もAPIで制御できないため, 本実証の成功とは別に後続の保存・削除方式をレビューする. [版履歴の削除制限](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/delete)

## 保存期限と永久削除実証の実行

これは承認済みの[期限適用と永久削除実証](backup-retention-probe-plan.md)の工程1. この実行中に作成する架空データのファイルを最大3つ作り, そのうち2つを永久削除する. 残りの1つは確認用に残す. 以前の保存実証ファイルやその他の既存ファイルは対象にしない.

1. 手順4に従い, 開発用Script IDと送信対象7ファイルを確認して `npm run gas:push` で更新する. manifest変更の上書き確認が出る場合は, 開発用プロジェクトであることと追加scopeを確認する.
2. GASエディタを開き直し, `runDevelopmentRetentionProbe` を選んで1回実行する. 引数を指定しない. 追加の認可画面が表示されたら, 開発用アカウントとDrive・Sheets・外部リクエストの権限を確認する. コードの通信先は固定のGoogle Drive APIのみ.
3. 次のログが出たことと, 開発用フォルダ内に `development-retention-probe-` で始まり `-replacement` で終わる新規ファイルが1つ残ることを確認する.

```json
{
  "status": "verified",
  "environment": "development",
  "sourceRecordCount": 3,
  "retainedRecordCount": 2,
  "expiredRecordCount": 1,
  "permanentlyDeletedFileCount": 2
}
```

ログの `expiredRecordCount` は元の混在世代で期限到来した行の件数. 別途作成して世代全体を削除した15日経過のファイル内の行は, この件数に合算しない. 世代全体の削除を含め, 永久削除したファイルは2つ.
この実証は2026年3月1日00:00の日本時間に相当する固定の評価時刻を使う. ファイル内のスナップショット日時と期限は架空のものであり, Google上の実際の作成時刻とは別. 実際に15日待つ必要はない. 年単位の業務期限や定期トリガーを設定する処理ではない.

元の3件のうち期限到来した1件を取り除き, 2件を読戻して型・値・世代日時・期限を確認した後に旧ファイルを永久削除する. 削除前のHTTP 200と削除APIの正常終了, 削除後のHTTP 404を確認し, 401・403・通信失敗や一般的な例外を削除成功として扱わない. 最後に残したファイルも再検証する.
新保存物を作り直しても, 元のスナップショット日時と15日後の期限を引き継ぐ. ゴミ箱へ移す操作やゴミ箱全体を空にする操作は追加していない.

### 永久削除実証で失敗した場合

失敗した工程の固定メッセージだけをログへ出す. 保存内容・ID・トークン・Googleの内部エラー本文は出力しない.

| エラー                                                                                                   | 確認する箇所                                                                                   |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Unable to verify development retention probe file metadata`                                             | 今回の実証ファイルが専用フォルダにあり, 所有者であること. メタデータ・権限が変更されていないか |
| `Unable to create development retention probe file` / `Unable to write development retention probe file` | Drive・Sheets権限と容量. 途中の新規ファイルが残っていないか                                    |
| `Unable to verify development retention probe file contents`                                             | 保存内容・行列数の変更, 書込・読戻し権限. 新保存物が検証できなければ旧ファイルを削除しない     |
| `Unable to check development retention probe file status`                                                | 外部リクエストとDriveの認可, 通信状態. 30秒のタイムアウトがないか                              |
| `Development retention probe file is not readable before deletion`                                       | 削除直前の読取が成功していない. ファイルは削除せず処理を停止する                               |
| `Unable to permanently delete development retention probe file`                                          | ファイルの削除権限とDriveサービスの状態                                                        |
| `Development retention probe permanent deletion was not confirmed`                                       | 削除後のHTTP結果が期待する404でない. 削除成功として記録しない                                  |

途中失敗では旧ファイルの削除が一部だけ成功している場合や, 新規ファイルが複数残る場合がある. 自動再試行や既存ファイルの自動整理は行わない. エラー名と発生工程を記録し, 専用フォルダで今回の `development-retention-probe-` ファイルの名前・作成時刻・内容を確認する. 調査後に運用者が今回の実証ファイルだけを個別に片付ける. 別の実行のファイルや既存ファイルを一括削除しない.

成功は, 今回作成したAPIで管理可能なファイルについて期限適用と永久削除の流れが成立したことを示す. 全DBバックアップ・復元・失効の再適用, 他の複製やサービス内部の保管先についての完了判定は後続工程.

## ローカルの検査コマンド

| コマンド                  | 内容                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `npm run typecheck:gas`   | GAS用global APIとJavaScriptの型検査                                |
| `npm run lint:gas`        | GASソースと自動テストのlint                                        |
| `npm run test:gas`        | 設定確認・保存実証・期限適用と永久削除の正常系・拒否系・値の非露出 |
| `npm run gas:check-files` | claspによる実際の送信対象選定を架空設定で検査                      |

GASの型定義はGAS用tsconfigだけに読み込み, Web側へ混在させない. CLIはプロジェクト依存に追加せず3.4.1を一時実行する.

コマンド名・設定ファイル・アップロード範囲は[clasp公式リポジトリ](https://github.com/google/clasp)を参照する. 最新のCLIでは `clone-script`, `show-file-status` が使用できることを3.4.1のhelpでも確認した.
