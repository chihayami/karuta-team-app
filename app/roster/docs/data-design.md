# 名簿Appのデータ辞書

列名・型・制約の具体設計. PostgreSQLの型で記載する. 業務上の新しい制限となる文字数・値域・入力必須条件は[設計判断](../../../documents/open-questions.md)のレビュー対象. SQL作成前に確定する. 共通規則は[DB設計](../../../documents/data-design.md)に記載する.

## global.members

| 列名 | 型 | NULL | 既定値 | 入力・制約・意味 |
| --- | --- | --- | --- | --- |
| id | uuid | 不可 | サーバー生成 | 主キー. 利用者による指定・変更不可 |
| member_code | text | 不可 | なし | 1〜32文字. 一意. 新規採番案はM+入会年下2桁+連番3桁 |
| family_name | text | 可 | NULL | 1〜100文字. given_nameと少なくとも片方必須 |
| given_name | text | 可 | NULL | 1〜100文字. family_nameと少なくとも片方必須 |
| family_name_kana | text | 可 | NULL | 1〜100文字. given_name_kanaと少なくとも片方必須 |
| given_name_kana | text | 可 | NULL | 1〜100文字. family_name_kanaと少なくとも片方必須 |
| school_year | text | 可 | NULL | 1〜32文字. 年度による自動繰上なし |
| member_type | text | 不可 | なし | REGULAR / ASSOCIATE / MATE |
| membership_status | text | 不可 | ACTIVE | ACTIVE / SUSPENDED / RESIGNED |
| current_grade | text | 不可 | なし | A / B / C / D / E / F / G / BASIC / INTRODUCTORY |
| joined_date | date | 可 | NULL | 入会日. 移行時の不明値はNULL |
| suspended_date | date | 可 | NULL | 現在の休会開始日 |
| resigned_date | date | 可 | NULL | 退会日. 新規の退会操作では必須 |
| last_promoted_date | date | 可 | NULL | 有効な級履歴から算出. 移行時不明はNULL |
| version | bigint | 不可 | 1 | 1以上. 更新ごとに1加算. 要求の版と不一致なら競合 |
| created_at | timestamptz | 不可 | サーバー現在時刻 | 作成時に固定 |
| updated_at | timestamptz | 不可 | サーバー現在時刻 | 更新時に更新 |

名簿Appだけが更新する. 氏名・かなの文字種は制限せず, 空白のみを拒否する案. 姓名の一方しかない会員も表現できる. 氏名だけを一意キーにしない.
在籍状態と会員種別を分離する. ACTIVEではsuspended_dateとresigned_dateはNULL, SUSPENDEDではresigned_dateはNULL, RESIGNEDではsuspended_dateはNULL. 状態変更時の発効日は必須. 移行で不明な日付は捏造せずNULLとし要確認一覧へ出す. 既知の日付はjoined_date以降. 退会日不明のデータを自動削除の対象から黙って外さず, 移行前に運用判断する.
会員コードの新規採番は入会年を要求し, 同年採番をロックして重複を防ぐ. 上限999を超える場合はエラー. 既存値は対応表で検証して保持する. 移行例外を通常APIの入力規則に持ち込まない.
現役一覧の対象案はACTIVE. 休会者は明示した別条件で取得する. 他Appには用途別DTOだけを返す. 学年・日付・氏名の全列を無条件公開しない.

## roster_local.grade_history

| 列名 | 型 | NULL | 既定値 | 入力・制約・意味 |
| --- | --- | --- | --- | --- |
| id | uuid | 不可 | サーバー生成 | 主キー. 利用者による指定・変更不可 |
| member_id | uuid | 不可 | なし | 同じ所有者のglobal.members.idを参照 |
| grade | text | 不可 | なし | members.current_gradeと同じコード集合 |
| effective_date | date | 不可 | なし | 級の発効日 |
| recorded_at | timestamptz | 不可 | サーバー現在時刻 | 登録日時 |
| recorded_by | uuid | 不可 | なし | 認証APIで確認した操作者ID |
| supersedes_id | uuid | 可 | NULL | 訂正対象の同テーブルid. 同じmember_idに限る |

過去日登録と訂正を許可する. 自己参照・循環・同一履歴への二重訂正を拒否する. 訂正は追加行で表現し, supersedes_idの非NULL値を一意にする. 同じ会員・発効日の有効な末端履歴は最大1件とし, 会員行のロック下で検証する.
指定日時点の級は訂正後の有効履歴のうちeffective_dateが当日以前で最大のものから取得する. 同日の昇級は当日から有効とする案. 不明な過去級は現在級で補完しない. 将来日の昇級予約は初回対象外案.
現在級・最新昇級日・級履歴を名簿Appの同一トランザクションで更新する. 級履歴が揃わない移行データは現在級だけを保持できる. 保持と最終削除は[RET-RST-02](../../../documents/data-retention.md#ret-rst-02)に従う.

監査・取込実行記録は[共通列定義](../../../documents/operational-data.md)を使い, roster_localで管理する. 入退会・休復会の変更は監査に記録する.
