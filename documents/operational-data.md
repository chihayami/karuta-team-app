# 運用テーブルの列定義

作成先と所有者は[テーブル一覧](data-design.md)に従う. 本書は各所有Appのlocalスキーマに置く監査・実行記録の共通形式を定義する. 形式の共有はテーブルやアクセス権の共有を意味しない. 業務変更の監査は所有Appの更新と同一トランザクションで保存する. 操作履歴の範囲と保持方針はレビュー承認済み. テーブルの制約とジョブ実行記録は以下に定義する.

## 操作履歴の範囲と運用

[DEC-OPS-04](open-questions.md#dec-ops-04)で確定した, 問い合わせや問題発生時に参照する軽量な履歴とする. 変更の確定時に日時・操作者・対象・操作・変更項目名を記録し, 下表で許可した構造化項目だけ変更前後の値も保存する. 全文復元や全操作の追跡は目的にしない.

初回は専用の閲覧画面・収集基盤・定期目視確認・通知を設けない. 必要時にDB参照権限を持つ運用担当者が日時・対象ID等で確認する. アプリのロールだけでDB参照権限が付く構成にはしない. 名簿画面の級履歴等の業務履歴は別に維持する.
閲覧・画面遷移・通常のログイン成功は記録しない. アカウント作成・状態変更, 権限・紐付け・名簿・昇級・会場・練習・出欠の確定した変更を記録する. 拒否・失敗した要求は成功した変更履歴として残さず, 必要な障害情報は既存のアプリログの範囲で扱う.
対象ごとに業務更新と同じトランザクションで1行追加し, いずれかが失敗すれば両方を取り消す. 履歴はサーバーが生成し, 利用者の要求から監査値を直接採用しない. 期限削除は既存の月次処理に含める. 保持規則は[保存期限](data-retention.md)を正本とする.

## <app>_local.audit_events

| 列名                | 型          | NULL | 既定値           | 入力・制約・意味                                                                                  |
| ------------------- | ----------- | ---- | ---------------- | ------------------------------------------------------------------------------------------------- |
| id                  | uuid        | 不可 | サーバー生成     | 主キー. 利用者による指定・変更不可                                                                |
| actor_id            | uuid        | 可   | NULL             | 認証済み操作者ID. システム処理のみNULL                                                            |
| actor_kind          | text        | 不可 | なし             | ACCOUNT / SYSTEM                                                                                  |
| action              | text        | 不可 | なし             | 所有Appの許可された操作コード                                                                     |
| entity_type         | text        | 不可 | なし             | 所有Appの許可された対象コード                                                                     |
| entity_id           | uuid        | 不可 | なし             | 対象ID. ACCOUNT_ROLEでは対象アカウントIDとし, role_codeでロールを特定                             |
| changed_fields      | text[]      | 不可 | なし             | 変更した業務列名. 所有Appのデータ辞書にある列だけ. 重複・NULL要素不可                             |
| changes             | jsonb       | 不可 | {}               | 下表で許可した変更列だけをキーとし, 値はbefore/afterの2キー. 許可列に変更がなければ空オブジェクト |
| occurred_at         | timestamptz | 不可 | サーバー現在時刻 | 操作日時                                                                                          |
| practice_session_id | uuid        | 可   | NULL             | PRACTICE_SESSION・ATTENDANCEは対象練習ID必須. 会場単体・他Appの操作はNULL                         |
| purge_on            | date        | 不可 | サーバー計算     | 保持規則から求める削除日. 任意延長不可                                                            |

actor_kind=ACCOUNTならactor_id必須, SYSTEMならNULL. changed_fieldsは作成時には設定した業務列, 更新時には実際に変えた業務列, 削除時には削除した業務列の名前を記録する. 認証秘密値・LINE識別子の列と, version・updated_at等の機械的な管理列は含めない. 業務列の変更がない場合は空配列を許容する.
changesのキーはchanged_fieldsに含まれ, かつ次の許可列に限る. 変更された許可列はbefore/afterの値を必ず記録し, 元列と同じ型・コード制約を使う. 作成前・削除後の値はNULL. クライアントによる項目追加や未知のキーは拒否する.

| entity_type      | 変更前後の値を記録する列                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ACCOUNT          | status                                                                                                                                  |
| ACCOUNT_ROLE     | role_code                                                                                                                               |
| MEMBER_LINK      | relationship_code, revoked_at, reviewed_at                                                                                              |
| MEMBER           | member_type, membership_status, current_grade                                                                                           |
| GRADE_HISTORY    | grade, effective_date                                                                                                                   |
| VENUE            | is_active                                                                                                                               |
| PRACTICE_SESSION | status, practice_date, start_time, end_time, venue_id, target_grades, max_capacity, is_external_allowed, allow_observation, allow_trial |
| ATTENDANCE       | status, arrival_type, arrival_time, arrival_match, departure_type, departure_time, departure_match                                      |

氏名・かな・自由記述・訂正理由の本文・認証情報・リクエスト全体・行全体のコピーは保存しない. 例えば氏名変更ではchanged_fieldsにfamily_nameを記録し, changesには氏名を入れない. 自由記述だけの変更も日時・対象・項目名は確認できるが, 変更前の本文は復元できない.
changesは許可列の型・長さ・要素集合で制限する. 汎用の巨大な差分JSONや全文スナップショットは作らない. purge_onは[保存期限](data-retention.md)の対象操作ごとの規則から算出し, 複数期限が該当する場合は早い期限を使う.

## <app>_local.operation_runs

| 列名         | 型          | NULL | 既定値           | 入力・制約・意味                                                  |
| ------------ | ----------- | ---- | ---------------- | ----------------------------------------------------------------- |
| id           | uuid        | 不可 | サーバー生成     | 主キー. 利用者による指定・変更不可                                |
| job_type     | text        | 不可 | なし             | BACKUP / RESTORE / RETENTION / IMPORT / SUMMARY                   |
| run_key      | text        | 不可 | なし             | 1〜128文字. 論理的な処理単位の冪等キー                            |
| started_at   | timestamptz | 不可 | サーバー現在時刻 | 初回開始時刻                                                      |
| completed_at | timestamptz | 可   | NULL             | 終了時のみ. started_at以降                                        |
| status       | text        | 不可 | RUNNING          | RUNNING / SUCCEEDED / FAILED                                      |
| counts       | jsonb       | 不可 | 全項目0          | read / written / deleted / failedの4キー. 0以上の整数             |
| error_code   | text        | 可   | NULL             | 失敗時の許可済みコード. 最大100文字. 個人情報・例外本文を入れない |
| checkpoint   | jsonb       | 不可 | {}               | 工程名をキー, PENDING / SUCCEEDED / FAILEDを値とする              |

(job_type, run_key)を一意にする. 再試行は同じ行で工程単位に再開. RUNNINGはcompleted_at=NULL, 完了状態は非NULL. SUCCEEDEDはerror_code=NULL, FAILEDは非NULL. countsは再開で二重加算しない. 保持期限は[RET-OPS-01](data-retention.md#ret-ops-01)に従う. バックアップ等は読取・削除を別権限にする.

## 監査コードの許容組合せ

| App  | entity_type      | action                                                |
| ---- | ---------------- | ----------------------------------------------------- |
| 認証 | ACCOUNT          | CREATE / DISABLE / ENABLE / COMPLETE_INITIAL_LINK     |
| 認証 | ACCOUNT_ROLE     | GRANT / REVOKE                                        |
| 認証 | MEMBER_LINK      | CREATE / REVIEW / REVOKE / CORRECT                    |
| 名簿 | MEMBER           | CREATE / UPDATE / CHANGE_STATUS / IMPORT / DELETE     |
| 名簿 | GRADE_HISTORY    | REGISTER / CORRECT / DELETE                           |
| 練習 | VENUE            | CREATE / UPDATE / DEACTIVATE / DELETE                 |
| 練習 | PRACTICE_SESSION | CREATE / UPDATE / PUBLISH / CANCEL / FINALIZE_SUMMARY |
| 練習 | ATTENDANCE       | REGISTER / UPDATE / CANCEL / REREGISTER / CORRECT     |

一括取込は対象単位に履歴を分ける. 期限削除・集計確定は個人単位の履歴を再作成せず, 件数と結果をoperation_runsへ記録する. 上表のFINALIZE_SUMMARYも期限処理ではoperation_runsで扱う. 業務上の級履歴はgrade_historyで維持し, 操作履歴の保持期間に合わせて削除しない.

operation_runs.error_codeはVALIDATION_FAILED / SOURCE_UNAVAILABLE / TARGET_UNAVAILABLE / CONFLICT / DEADLINE_EXCEEDED / INTERNAL_ERROR. 詳細な個人別ペイロードをエラーコードへ連結しない. checkpointの許容キーはVALIDATE / EXPORT / IMPORT / FINALIZE_SUMMARY / PURGE_PRIMARY / PURGE_BACKUPS / VERIFY. 各ジョブが使うキーだけを持ち, 未知キーを拒否する.
