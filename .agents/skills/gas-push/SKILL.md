---
name: gas-push
description: 'Safely push Google Apps Script code to development or production environment after running verification checks. Use when the user invokes /gas-push or asks to push code to GAS.'
---

# /gas-push スキル

`/gas-push` が呼ばれた時, 事前検証（型チェック, テスト, ビルド）を確実に実行し, 安全に対話形式で Google Apps Script (GAS) へのプッシュを行う.

## 絶対ルール

- clasp pull は絶対に実行しない（ローカルコードが上書きされるリスクを完全に排除する）.
- 本番環境（prod）へのプッシュはAIの独断による実行を禁止し, 必ずユーザへの明示的な確認を行う.
- 型チェック, テスト, ビルドのいずれか1つでも失敗した場合はプッシュを即座に中止する.
- 失敗時に git reset やファイルの破棄などの自動ロールバックは行わない. 状況を報告してユーザに判断を仰ぐ.
- 認証情報（.env, CLASPRC_PATH, トークン等）の値をチャットやログに平文で出力しない.

## 実行対象の判定

本プロジェクトには2つのGASプロジェクトが存在する.

1. メインアプリ（taikai-manage-app / root）: 通常はこちらを対象とする.
2. データ同期ツール（tools/data-sync）: ユーザから明示的な指定があった場合のみ対象とする.

## 実行フロー

### Step 1: 現状確認

以下を順次確認する:

- カレントディレクトリが対象リポジトリ（/workspace/taikai-manage-app）であること.
- 現在の .clasp.json の内容（現在設定されている scriptId）を確認する.
- git status を確認し, 未コミットの変更が存在する場合はユーザへ注意喚起する.

### Step 2: プッシュ先環境の確認

ユーザへプッシュ先環境を確認する:

- 選択肢1: 開発環境（dev）- 推奨
- 選択肢2: 本番環境（prod）- 警告を表示し, 明示的な承認を要求する
- 選択肢3: 中止

本番環境が選択された場合は, 以下の警告を明示する:
「本番環境（prod）へのデプロイです. 稼働中の本番システムに即時反映されます. 本当に実行しますか？」

### Step 3: 事前品質検証の実行

選択された対象に応じて, 以下のコマンドを順番に実行する.
途中で1つでも失敗（終了コード非0）した場合は, そこで停止してエラー内容を報告する.

メインアプリ（root）の場合:
1. 型チェック: npm run type-check
2. テスト: npm run test:all (単体テスト Jest + E2Eテスト Playwright)
3. ビルド: npm run build

データ同期ツール（tools/data-sync）の場合:
1. テスト: npm run test (tests/dataSync.test.js)

### Step 4: 環境切り替え（メインアプリの場合）

プッシュ先環境に応じて設定ファイルを切り替える:

- 開発環境の場合: npm run switch:dev
- 本番環境の場合: npm run switch:prod

切り替え後, .clasp.json の scriptId が意図した環境（.clasp.dev.json または .clasp.prod.json）と一致していることを確認する.

### Step 5: プッシュの実行

プッシュスクリプトを実行する:

メインアプリの場合:
node scripts/clasp-push.js

データ同期ツールの場合:
tools/data-sync ディレクトリにて node scripts/clasp-push.js

実行ログを確認し, clasp push が正常終了（コード0）したことを検証する.

### Step 6: 完了サマリの報告

全処理の完了後, 以下の項目をチャットに報告する:

- 対象: メインアプリ または データ同期ツール
- デプロイ先環境: dev または prod
- スクリプトID: .clasp.json の scriptId
- 事前検証結果: 型チェック（成功）, テスト（成功）, ビルド（成功）
- プッシュ結果: 成功 / 失敗

## エラー時の対応

- 型チェックまたはテスト失敗: プッシュを中止し, エラー箇所のログを提示して修正を促す.
- clasp 認証エラー: CLASPRC_PATH または clasp ログイン状態の確認を促す.
- push コマンド失敗: 変更の強制ロールバックは行わず, clasp のエラーメッセージを表示してユーザの判断を仰ぐ.
