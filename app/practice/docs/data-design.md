# 練習Appのデータ設計

業務要件と具体的な設計案を記載する. 未確定の判断は「案」または「未決」と明示する.


## 出欠の状態遷移

| 元状態                   | 操作               | 先状態       | 条件                                         |
| ------------------------ | ------------------ | ------------ | -------------------------------------------- |
| 未登録                   | 参加登録           | ATTENDING    | 有効な紐付け・資格・対象級, 公開中, 締切前   |
| ATTENDING                | 遅刻早退・備考変更 | ATTENDING    | 同上. 資格変化後の扱いは[DEC-PRC-02](../../../documents/open-questions.md#dec-prc-02)                  |
| ATTENDING                | 取消               | CANCELLED    | 有効な紐付け, 締切前. 対象級外でも取消可能案 |
| CANCELLED                | 再登録             | ATTENDING    | 新規登録と同じ検証                           |
| ATTENDINGまたはCANCELLED | 担当者訂正         | 指定状態     | attendance.manage, 訂正理由, 保持期限前      |
| 個人別記録あり           | 集計化・削除       | 個人別行なし | 保存期限到達, 集計確定後                     |

WAITLISTは初回の状態に含めない. CANCELLEDは不参加表明ではなく登録取消を示す. 未登録は行が存在しない状態であり, 欠席と断定しない.
練習中止時は練習の状態をCANCELLEDにし, 出欠行を一律取消へ書き換えない案. 集計にも中止であることを残す.

## 整合性と競合

- 出欠と練習監査の更新は練習App内の1トランザクションで確定する. アカウント・紐付け・会員の条件は公開契約で検証する. 検証から確定までの競合対策は[全体設計](../../../documents/architecture.md)に従って実証し, 横断テーブル参照や分散トランザクションを暗黙に前提としない.
- 初回挿入の競合は一意制約で防ぐ. 再送された同内容は既存結果を返し, 別内容の競合はversionで検出する.
- 変更・取消・再登録は要求のversionと現在のversionを比較し, 古ければ競合として再読込を求める.
- 締切判定はトランザクション内でサーバー時刻を使う. 締切と同時刻は拒否する.
- 満員判定で書込を拒否する制約やトリガーは作成しない.
- 登録人数はATTENDINGの件数. 残席はmax(定員-登録人数, 0), 超過人数はmax(登録人数-定員, 0)を提案.
- 複数練習の同時刻参加を禁止する制約は初回では設けない案. 同日開催を1つの練習と誤認しない.
- 本人と保護者の操作で同じ出欠行を更新するため, registered_byだけを編集権限の根拠にしない.

## 級別・遅刻早退の集計

- 対象はATTENDINGの登録. CANCELLEDを人数へ含めない. 外部参加等は受付がないため人数へ推計加算しない.
- 級別人数は名簿Appの指定日時点の級APIで練習開催日時点の級を取得して判定する案. 同日の昇級はその日から有効とする案.
- 確認不能な過去級は「不明」の集計区分へ入れ, 全区分の合計が登録人数と一致するようにする.
- 遅刻と早退は独立して数え, 両方申告した1人は両方の人数に含める. 総人数へ二重加算しない.
- 時刻別・試合数別の集計も必須. 到着と退出を分け, 時刻はHH:mm, 試合数は正の整数ごとに人数を保存する具体案.
- 自由記述による申告はOTHER区分の人数として集計し, 原文は長期保存しない. 個人IDと各区分の対応は保存しない.
- 入力案はNONE / TIME / MATCH / OTHERの択一. 各軸でTIME・MATCH・OTHERの合計が遅刻人数または早退人数と一致するよう検証する.
- 元の個人別時刻・試合数・自由記述は保持期限に削除する. 時刻別・試合数別の人数のみ長期保持する.
- 集計確定後の名簿・級履歴訂正で保存済み集計を自動変更しない. 個人との対応を保持しないため, 再集計できないことを運用に明記する.

## 保持期限と集計化

対象行・列と期限は[保存期限](../../../documents/data-retention.md)の[RET-PRC-02](../../../documents/data-retention.md#ret-prc-02)〜[RET-PRC-05](../../../documents/data-retention.md#ret-prc-05)に従う. 本節はその期限に実行する練習App内の処理を定義する.

実行案:

1. 期限日以降は, 物理削除処理の成否によらず通常APIから個人別出欠を返さず, 新規作成・訂正も拒否する.
2. 対象練習をロックし, 集計確定済みか確認する. 未確定なら登録人数・級別人数・遅刻早退人数・時刻別/試合数別人数を確定する.
3. 集計保存と本番DB内の個人別出欠・関連監査情報の削除を同一トランザクションで確定する.
4. 管理するバックアップの全世代から該当情報を除去する. 複数ストアを1トランザクションでは処理できないため, 進捗を記録し, 失敗時は未完了として再試行する.
5. DBとバックアップ双方の完了を確認して処理完了とする. 復元時は公開前に期限を再適用し, 古いバックアップ由来の個人情報を提供しない.

[DEC-OPS-01](../../../documents/open-questions.md#dec-ops-01)で期限日の実行時刻と遅延時の扱いを決める. アクセス拒否だけでは削除完了とみなさない.
個人別データを載せたCSV一時ファイル・エラーログ・開発データ・スプレッドシートの複製も保存先一覧で追跡する案.
保存先の制御可能範囲と復元要件は[バックアップと復元](../../../documents/data-retention.md#バックアップと復元)に従う.

## 集計に残す基本属性案

| 保持する                                                                                             | 保持しない                                                                  |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 練習ID, 開催日, 開始終了時刻, 会場・部屋の公開名称, 対象級, 定員, 外部参加・見学・体験可否, 中止状態 | 会員ID, 氏名, LINE ID, 登録者・更新者, 個人別遅刻早退, 個人別備考, 招待情報 |

練習タイトル・練習備考・会場の自由記述は個人情報混入の可能性があるため, 長期集計への自動転記対象外を提案する.
少人数の級別集計などから個人を推測できる可能性は残るため, 初回の過去集計は練習会設定班メンバー以上への限定公開を提案する.


## 列定義

列名・型・制約の具体設計. PostgreSQLの型で記載する. 業務上の新しい制限となる文字数・値域・入力必須条件は[設計判断](../../../documents/open-questions.md)のレビュー対象. SQL作成前に確定する. 共通規則は[DB設計](../../../documents/data-design.md)に記載する.

## practice_local.venues

| 列名 | 型 | NULL | 既定値 | 入力・制約・意味 |
| --- | --- | --- | --- | --- |
| id | uuid | 不可 | サーバー生成 | 主キー. 利用者による指定・変更不可 |
| building_name | text | 不可 | なし | 1〜200文字. 建物名 |
| short_name | text | 可 | NULL | 1〜100文字. 略名 |
| room_name | text | 不可 | なし | 1〜100文字. 部屋名 |
| floor_label | text | 可 | NULL | 1〜32文字. 階の表示 |
| tatami_count | numeric(6,1) | 可 | NULL | 0〜99999.9. 畳数 |
| capacity | integer | 不可 | なし | 1〜2147483647. 定員 |
| map_url | text | 可 | NULL | 最大2048文字. https URL. javascript等は拒否 |
| nearest_station | text | 可 | NULL | 1〜200文字 |
| walking_minutes | integer | 可 | NULL | 0〜1440 |
| parking_info | text | 可 | NULL | 1〜1000文字 |
| is_active | boolean | 不可 | true | 利用可否 |

1件は建物と部屋の組. 名称一致だけで同一会場と決めない. 無効化・削除条件は[RET-PRC-01](../../../documents/data-retention.md#ret-prc-01)に従う.

## practice_local.practice_sessions

| 列名 | 型 | NULL | 既定値 | 入力・制約・意味 |
| --- | --- | --- | --- | --- |
| id | uuid | 不可 | サーバー生成 | 主キー. 利用者による指定・変更不可 |
| practice_date | date | 不可 | なし | 開催日 |
| start_time | time(0) | 不可 | なし | 00:00〜23:59. 秒は0 |
| end_time | time(0) | 不可 | なし | start_timeより後. 日跨ぎは初回対象外案 |
| venue_id | uuid | 可 | なし | venues.idを参照. 集計確定前は必須. 確定時に固定名称を保存してNULLにできる |
| venue_building_name | text | 可 | NULL | 最大200文字. 集計確定時の建物名称 |
| venue_room_name | text | 可 | NULL | 最大100文字. 集計確定時の部屋名称 |
| title | text | 可 | NULL | 1〜200文字. 個人別データ期限にNULL |
| target_grades | text[] | 不可 | なし | 級コードの非空配列. 重複・NULL要素不可 |
| max_capacity | integer | 不可 | なし | 1〜2147483647. 参加登録の上限ではない |
| is_external_allowed | boolean | 不可 | false | 外部参加の可否属性 |
| allow_observation | boolean | 不可 | false | 見学の可否属性 |
| allow_trial | boolean | 不可 | false | 体験の可否属性 |
| notes | text | 可 | NULL | 1〜2000文字. 個人別データ期限にNULL |
| status | text | 不可 | DRAFT | DRAFT / PUBLISHED / CANCELLED |
| version | bigint | 不可 | 1 | 1以上. 更新ごとに1加算. 要求の版と不一致なら競合 |
| summary_version | smallint | 可 | NULL | 確定集計の形式. 初期形式は1 |
| registered_count | integer | 可 | NULL | 0以上. ATTENDINGの人数 |
| counts_by_grade | jsonb | 可 | NULL | 後述の級別件数オブジェクト |
| late_count | integer | 可 | NULL | 0〜registered_count |
| early_departure_count | integer | 可 | NULL | 0〜registered_count |
| arrival_counts | jsonb | 可 | NULL | 後述の到着集計オブジェクト |
| departure_counts | jsonb | 可 | NULL | 後述の退出集計オブジェクト |
| summary_finalized_at | timestamptz | 可 | NULL | 確定処理のサーバー時刻 |

集計列は未確定時にすべてNULL, 確定時にすべて非NULL. 固定会場名も確定時必須. 確定後は基本属性と集計を編集不可とする案. title・notesのNULL化は[RET-PRC-02](../../../documents/data-retention.md#ret-prc-02), 基本属性・確定集計は[RET-PRC-03](../../../documents/data-retention.md#ret-prc-03), 個人別監査は[RET-PRC-05](../../../documents/data-retention.md#ret-prc-05)に従う.
counts_by_gradeはA〜G, BASIC, INTRODUCTORY, UNKNOWNの全10キーを持ち, 値は0以上の整数. 未知キーを拒否し, 合計はregistered_count.
arrival_countsとdeparture_countsの形は {"time": {"HH:mm": 人数}, "match": {"正整数の10進文字列": 人数}, "other": 人数}. time/matchは空オブジェクト可, otherは0以上. 時刻キーは00:00〜23:59, matchキーは1〜2147483647で先頭ゼロなし. 値は正の整数, otherは0以上. それぞれの合計はlate_count / early_departure_count. 会員ID・氏名・自由記述は格納しない.
登録者がいる練習の開催日変更を拒否する案. 対象級変更時は不適合者を確認し, 自動取消しない. 締切と保持期限は開催日から導出し, 編集可能な列として持たない.

## practice_local.attendances

| 列名 | 型 | NULL | 既定値 | 入力・制約・意味 |
| --- | --- | --- | --- | --- |
| id | uuid | 不可 | サーバー生成 | 主キー. 利用者による指定・変更不可 |
| session_id | uuid | 不可 | なし | practice_sessions.idを参照 |
| member_id | uuid | 不可 | なし | 名簿APIで確認したglobal.members.id |
| status | text | 不可 | ATTENDING | ATTENDING / CANCELLED |
| arrival_type | text | 不可 | NONE | NONE / TIME / MATCH / OTHER |
| arrival_time | time(0) | 可 | NULL | TIME時のみ必須. 秒0. 00:00〜23:59 |
| arrival_match | integer | 可 | NULL | MATCH時のみ必須. 1〜2147483647 |
| arrival_note | text | 可 | NULL | OTHER時のみ必須. 1〜500文字 |
| departure_type | text | 不可 | NONE | NONE / TIME / MATCH / OTHER |
| departure_time | time(0) | 可 | NULL | TIME時のみ必須. 秒0. 00:00〜23:59 |
| departure_match | integer | 可 | NULL | MATCH時のみ必須. 1〜2147483647 |
| departure_note | text | 可 | NULL | OTHER時のみ必須. 1〜500文字 |
| comment | text | 可 | NULL | 1〜2000文字. 募集中の公開範囲を入力時に表示 |
| registered_by | uuid | 不可 | なし | 作成時の認証済み操作者ID |
| updated_by | uuid | 不可 | なし | 更新時の認証済み操作者ID |
| version | bigint | 不可 | 1 | 1以上. 更新ごとに1加算. 要求の版と不一致なら競合 |
| created_at | timestamptz | 不可 | サーバー現在時刻 | 作成時に固定 |
| updated_at | timestamptz | 不可 | サーバー現在時刻 | 更新時に更新 |

(session_id, member_id)は取消行も含め一意. 再登録は同じ行を使用. arrival/departureの各軸でtypeに該当する1列だけ値を持たせ, 残る列はNULL. NONE時は3列ともNULL. 操作者IDは権限の代わりにしない.
行の削除は[RET-PRC-04](../../../documents/data-retention.md#ret-prc-04), 個人別監査は[RET-PRC-05](../../../documents/data-retention.md#ret-prc-05)に従う. 時刻・試合数・自由記述を1つの文字列列へ混在させない. 登録者が定員を超えても拒否しない.

監査・実行記録は[共通列定義](../../../documents/operational-data.md)を使い, practice_localで管理する.
