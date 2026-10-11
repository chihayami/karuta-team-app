# 開発用外部サービスの設定手順

## 目的と現在の到達点

MIL-SYS-02の先行実証に必要な開発環境を運用者が用意する手順. 2026-10-10に公式資料と現在の実装を確認した.
まずSupabaseとGAS・Google Driveを準備し, その後にWebの固定入口とLINE/LIFFを設定する. ローカルのWeb基盤・環境設定検証は実装済み. DB接続・LINEログイン・バックアップ処理は後続実装であり, アカウント作成だけで各工程を完了にしない.

団体は非営利の会員制団体. 料金と無料枠の確認状況は[無料運用の確認記録](free-operation-check.md), 保持期限は[保存期限](data-retention.md)を正本とする.
この手順は開発専用の資源を対象とする. データには架空の名簿・練習を使い, 既存の本番DB・本番名簿・本番保存先を接続しない.

## 作成するものと設定の保管

| サービス     | 作成する開発用資源               | 控える非秘密情報                                    | 秘密として保管する情報                 |
| ------------ | -------------------------------- | --------------------------------------------------- | -------------------------------------- |
| Supabase     | 開発専用プロジェクト1つ          | project ref, Project URL, region, DBのメジャー版    | DBパスワード・接続文字列・secret key等 |
| Google Drive | 開発専用の保存フォルダ           | folder ID, 所有者, 共有範囲                         | 後続実証用の資格情報がある場合は別管理 |
| GAS          | 開発専用のstandaloneプロジェクト | Script ID, タイムゾーン, 有効なサービス             | 後続実装で使用する運用資格情報         |
| Vercel       | 1つのWebプロジェクト             | project名, develop固定URL, 対象SHA・環境, Node.js版 | 後続実装のサーバー専用資格情報         |
| LINE/LIFF    | 開発専用LINE LoginチャネルとLIFF | provider, Channel ID, LIFF ID, Endpoint URL, 検証者 | Channel secret                         |

秘密値は運用者のパスワード管理等で保管し, Git・文書・チャットに貼り付けない. AIへの報告は設定の完了状況と詰まった項目だけでよい.
現在のWebコードが読む設定名は[ローカル開発](local-development.md#設定の境界)を参照する. 上表の全情報が現在の環境変数で消費されるわけではない.

## 1. Supabaseの開発プロジェクト

1. [Supabase Dashboard](https://supabase.com/dashboard)へログインし, 管理対象のorganizationを選ぶ. 既存プロジェクト数とFreeの適用状況を確認する. Freeはactive projectが2つまでなので, 開発・本番を合わせた枠を確保する.
2. `New project` から開発専用プロジェクトを作成する. 名前は開発用と分かるものにし, 本番用と区別する. 例: `member-miniapps-development`.
3. DBパスワードを生成して安全な保存先へ保管する. 運用者が利用しやすいregionを選び, 選択結果を控える. 有料プランへの変更や追加課金機能の有効化はこの手順に含めない.
4. 準備完了後, Dashboardの接続情報でproject refとProject URLを確認する. project refはURLの `<ref>.supabase.co` 部分と対応する. DBのメジャー版も控える.
5. 本番プロジェクトがある場合は, 別のproject refであることを確認する. 本番から名簿をコピーせず, 開発プロジェクトは空の状態で準備する.
6. プロジェクトを管理・検証する担当者を限定する. DBマイグレーション・ロール・RLS・バックアップ用権限は実証用実装を用意した後に設定する.

Freeの枠数・停止・バックアップ条件は[料金の公式資料](https://supabase.com/pricing)を参照する.

## 2. Google DriveとGAS

1. 団体の全体管理者が管理できるGoogleアカウントを使用する. 本番用の保存フォルダ・GASプロジェクトと区別できる状態にする.
2. Google Driveに開発専用フォルダを作成する. 例: `member-miniapps-development-backups`. 共有を確認し, 一般公開・リンクを知っている全員への公開を設定しない. 編集者は実証に必要な担当者に限定する.
3. フォルダURLのfolder IDと所有者を運用者の管理記録に控える. 既存の本番バックアップ用folder IDを流用しない.
4. [Apps Script](https://script.google.com/)で新しいstandaloneプロジェクトを作成し, 開発用と分かる名前にする. バックアップ対象のスプレッドシートへ直接バインドすることは今回の前提にしない.
5. プロジェクト設定でタイムゾーンを `Asia/Tokyo` にし, Script IDを控える. プロジェクトの編集権限も限定する.
6. エディタの `Services` からGoogle Drive APIのadvanced serviceを追加し, v3を使用する. defaultのGoogle Cloud projectでは対応APIが自動有効化される. standard projectを選んでいる場合は, 同じCloud projectのGoogle Drive APIを手動で有効化する.
7. 設定確認用コードは実装済みなので, [GASの設定先とコード同期](gas-development.md)に従ってスクリプトプロパティとclaspを設定する. DB用の認証・OAuth scope・実行トリガーは保存・復元実証の採用計画に合わせて後で設定する. 空のWeb appのデプロイや定期トリガー作成は不要.

Script IDとWeb appのDeployment IDは別物. 現在の `APP_GAS_DEPLOYMENT_ID` にScript IDやfolder IDを入れない. 実証コードを実際にデプロイする段階でDeployment IDを取得する.
GASをまだデプロイしていない間は, ローカル設定例の `development-example` を `APP_GAS_DEPLOYMENT_ID` と対応する期待値の両方に維持できる. これは仮の識別子であり, GAS接続済みとは扱わない.

出典: [standaloneプロジェクト](https://developers.google.com/apps-script/guides/standalone), [advanced servicesの有効化](https://developers.google.com/apps-script/guides/services/advanced), [Script properties](https://developers.google.com/apps-script/guides/properties).

Script ID・folder ID・Deployment IDの設定先と, claspでコードを確認・送信する具体的な手順は[GASの設定先とコード同期](gas-development.md)を参照する. [承認済み同期基盤の計画](gas-sync-plan.md)に従って, 設定確認用ソースを用意した.

## 3. 保存先の削除・復元実証で確認すること

Google Sheetsのセルを空にするだけでは, 古い版の値まで消えたとは判断できない. Drive APIの `revisions.delete` はGoogle Docs・Sheetsの版には使えない. [公式の版削除仕様](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/delete)

実証では次の保存方式を比較する. まだ方式を採用済みとは扱わない.

- 世代ごとに別ファイルを作成し, 15日経過または元データの期限到来時に対象ファイルを永久削除する方式.
- 期限到来前に保持可能なデータを新しい保存物へ移し, 期限対象を含む旧ファイル全体を永久削除する方式. 新保存物の検証失敗時や中断時の扱いも必要.
- GASから別の保存形式で世代を保存する方式. スプレッドシート主保存の仕様変更が必要なら, 採用前に設計レビューする.

ゴミ箱への移動と永久削除を区別する. [Driveのfiles.delete](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/delete)はファイルを永久削除する操作だが, 実際の権限・複製・保存先を含む削除可能範囲は開発用の架空データで確認する.
これらの方式では世代内の期限未到来データや復元地点も失われ得るため, 元データ期限・複数世代・型保持・復元要件が同時に成立することを確認して採否を決める.

最初の実証データにはNULL・先頭ゼロの文字列・Unicode・日付・JSON・取消済み出欠・失効済みセッションを含める. 本番名簿や実際のLINE識別子を使わない.
復元は隔離先に行い, 期限と失効状態を再適用した後に公開する. Supabaseの別プロジェクトが必要になる場合はFreeの2 active project制限との対応も先に確認する.

## 4. Vercelのプロジェクトと開発固定入口

### 先に用意する設定

1. [Vercel Dashboard](https://vercel.com/dashboard)で対象リポジトリを利用できるアカウントを確認する. 非営利団体の運用形態とHobbyの利用条件は[確認記録](free-operation-check.md)に従って確認する.
2. 1つのWebプロジェクトを用意し, Gitリポジトリを関連付ける. Production Branchは `main`, 継続開発版は `develop` のPreviewとする. Node.jsは24.xを選択する.
3. 今回のコードがリモートの `develop` に含まれることを確認する. 現在の作業ブランチにしかない場合は, [Git運用規約](git-workflow.md)に従いpush・PR・人間によるレビューとマージを先に行う. AIはマージを実行しない.
4. 開発の設定はPreviewの `develop` に割り当てる. 本番の秘密値はProduction専用とし, 全Previewや個別作業ブランチへ一律に配布しない.
5. 初回デプロイはProductionになるため, 開発設定をProductionへコピーして初回だけ通す対応は行わない. 本番を未設定のまま作成した初回デプロイが失敗しても, 開発版の成功とは扱わない. 初回セットアップ後に, 対象がPreviewであることを確認して開発用配信を行う.

### 現在のリポジトリに合わせたビルド設定案

| 項目             | 設定案                                                |
| ---------------- | ----------------------------------------------------- |
| Framework Preset | Next.js                                               |
| Root Directory   | リポジトリルート. `package.json` とlockfileがある階層 |
| Install Command  | `npm ci`                                              |
| Build Command    | `npm run build`                                       |
| Output Directory | `web/.next`                                           |
| Node.js          | 24.x                                                  |

アプリ本体は `web/`, packageとlockfileはリポジトリルートにある. 通常のルート `.next` と取り違えない. この設定案の実Vercelでの成果物検出・関数起動は未実証. エラーが出た場合は設定不足と構成の問題を区別し, ソース構成や設定をレビューしてから修正する. 適当にRoot Directoryを `web` に変えて親のpackageを参照できると仮定しない.

### Previewへ設定する値

| 変数                       | 開発用の値                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `APP_ENVIRONMENT`          | `development`                                                                           |
| `APP_DEPLOYMENT_TARGET`    | `preview`                                                                               |
| `APP_ORIGIN`               | 実際のdevelopブランチ固定URLのorigin. 末尾スラッシュなし                                |
| `APP_CONFIG_REVISION`      | 設定改訂番号. 例: `development-1`                                                       |
| `APP_SUPABASE_URL`         | 手順1の開発用Project URL                                                                |
| `APP_LINE_CHANNEL_ID`      | 手順5で作成する開発用Channel ID                                                         |
| `APP_LIFF_ID`              | 手順5で作成する開発用LIFF ID                                                            |
| `APP_GAS_DEPLOYMENT_ID`    | GAS実装前は前述の仮識別子. 実デプロイ後に更新                                           |
| `APP_ENVIRONMENT_BINDINGS` | [設定例](../web/environment.example)のJSONを基に, developmentの期待値を上記と一致させる |

DashboardのJSON値には, dotenvファイルで値を囲んでいる外側のシングルクォートを付けない.
本番が未準備の場合, JSONのproduction部分は設定例の架空値を維持する. この状態で本番へ配信しない. 本番の資格情報を開発環境に置く必要はない.
`VERCEL_*` はVercelの実際の環境情報を使用し, 別環境に見せかける手入力で上書きしない. `APP_BUILD_*` はコードがビルド時に設定するのでDashboardへの追加は不要.

Vercelの Project Settings > Environment Variables で Automatically expose System Environment Variables を有効にし, `VERCEL_GIT_COMMIT_SHA` が提供されるようにする. Web基盤はこの値から配信対象SHAを取得するため, Vercelには `APP_GIT_SHA` を設定しない. 既に設定済みなら削除する. `APP_GIT_SHA` はローカル用で, `VERCEL_GIT_COMMIT_SHA` がない場合にだけ使用される. 両方がある場合の不一致はコードが拒否する.

developの固定URLはVercelが実際に表示するbranch URLを採用し, 名前から推測しない. 個別デプロイURLと区別する. 先にURL・LINE/LIFF ID等を揃えてからPreviewを実行する.
配信後は「開発版」の表示・版・SHAとソースを照合する. 準備画面の表示確認は, LINEログイン・検証者許可リスト・業務認可の受入完了を意味しない.

出典: [ビルド設定](https://vercel.com/docs/builds/configure-a-build), [環境変数とbranch別設定](https://vercel.com/docs/environment-variables), [初回を含む配信環境](https://vercel.com/docs/deployments/environments), [生成URL](https://vercel.com/docs/deployments/generated-urls).

## 5. LINE LoginとLIFF

1. [LINE Developers Console](https://developers.line.biz/console/)へログインする. 団体が管理するproviderを選び, 開発専用のLINE Loginチャネルを作成する. 本番チャネルとは分け, アプリ種別はWeb appとする.
2. Channel IDとproviderを控え, Channel secretは秘密の保存先へ保管する. 現在のWeb基盤にはChannel secretを登録する変数や検証処理がないため, まだWebへ渡さない.
3. 開発チャネルの状態は `Developing` を維持し, 実機確認する担当者をAdmin/Testerとして追加する. 各検証者はBusiness IDとLINEアカウントの連携を確認する. チャネル側のTesterと, 後続のアプリ側検証者許可リストは別に管理する.
4. `LIFF` タブでアプリを追加する. 名前は開発用と分かるものにし, 画面サイズは `Full`, Scopeはまず `openid` とする. `profile`, `email`, `chat_message.write` 等は必要性が確定するまで追加しない.
5. Endpoint URLには手順4のdevelop固定入口のHTTPS URLを指定し, LIFF IDを控える. 固定URLだけ先に確認でき, まだ配信が通っていない場合は未配信と記録する. 仮のURLを使った場合は, 実際の固定入口へ変更してから実機検証する.
6. 現在のWeb設定ではChannel IDとLIFF IDの値および期待値を一致させる. SDK・IDトークン検証・ログイン画面は未実装なので, 現段階でLIFFを開けてもログイン成功とは扱わない.
7. LINE LoginのCallback URLは, 認証実証で実装する実際のエンドポイントを決めてから登録する. 未実装の `/auth` や `/api/auth/callback` を存在するAPIとして登録しない.

開発チャネルを `Published` に切り替える作業はこの手順に含めない. 開発時のAdmin/Tester制限は[LINE Loginの公式手順](https://developers.line.biz/en/docs/line-login/getting-started/)を参照する. EndpointのHTTPS条件と各Scopeの用途は[LIFF追加の公式手順](https://developers.line.biz/en/docs/liff/registering-liff-apps/)に従う.

## 6. ローカルの設定反映と確認

1. Node.js 24 LTSで `npm ci` を実行する.
2. `web/.env.local` が未作成の場合だけ, `web/environment.example` をコピーする. 既存ファイルがある場合は保持し, その内容を運用者が更新する.
3. localでは `APP_ENVIRONMENT=development`, `APP_DEPLOYMENT_TARGET=local`, `APP_ORIGIN=http://localhost:3000` とする. Supabase・LINE・LIFFの各識別子とJSON内developmentの期待値を更新する.
4. `APP_GIT_SHA` に `git rev-parse HEAD` で確認した完全SHAを設定し, `APP_CONFIG_REVISION` を更新する. 本番が未設定ならproductionの架空値は維持する.
5. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:smoke` を実行する. 必須値や期待接続先が不一致なら, 出力された変数名を基に設定を修正する.
6. `npm run dev` で準備画面の開発表示・版を確認する. 現在のコードは外部サービスへ通信しないため, 外部設定を入力しても接続確認にはならない.

## 7. 完了報告と次の実証

設定後は, 秘密値を含めずに次の状態を報告する.

- Supabase: 開発専用プロジェクト作成済みか, DBのメジャー版, 本番と別か.
- Drive/GAS: 専用フォルダ・standaloneプロジェクト・Drive advanced service作成済みか.
- Vercel: プロジェクト・Node.js 24.x・Production Branch設定済みか, Preview配信の状況.
- LINE/LIFF: 開発チャネル・LIFF作成済みか, 検証者を指定できるか.
- 未完了項目と, 秘密値を伏せたエラー内容.

その後, IMP-SYS-03の保存・削除・復元の具体的な方式・対象ファイル・自動テストを計画レビューする. 実装前にDEC-OPS-01の実行時刻・遅延・復旧時間・許容損失と, DEC-OPS-02の年単位期限境界を確定する.
Google Sheetsの版履歴, 整合した全DBの保存地点, 復元時の期限・失効の再適用を実証できるまで, バックアップ方式やMIL-SYS-02全体を完了扱いにしない.
