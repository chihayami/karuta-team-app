# 認証Appのデータ辞書

列名・型・制約の具体設計. PostgreSQLの型で記載する. 業務上の新しい制限となる文字数・値域・入力必須条件は[設計判断](../../../documents/open-questions.md)のレビュー対象. SQL作成前に確定する. 共通規則は[DB設計](../../../documents/data-design.md)に記載する.

## global.accounts

| 列名                      | 型          | NULL | 既定値           | 入力・制約・意味                               |
| ------------------------- | ----------- | ---- | ---------------- | ---------------------------------------------- |
| id                        | uuid        | 不可 | サーバー生成     | 主キー. 利用者による指定・変更不可             |
| status                    | text        | 不可 | ACTIVE           | ACTIVE / DISABLED                              |
| initial_link_completed_at | timestamptz | 可   | NULL             | 初回紐付け確定時に設定. 紐付け解除でも戻さない |
| created_at                | timestamptz | 不可 | サーバー現在時刻 | 作成時に固定                                   |

認証Appが管理. 保持規則は[RET-AUT-01](../../../documents/data-retention.md#ret-aut-01). LINE識別情報はauth_local.account_identitiesに保持し, 公開する主体DTOに含めない.

## auth_local.account_identities

| 列名             | 型          | NULL | 既定値           | 入力・制約・意味                         |
| ---------------- | ----------- | ---- | ---------------- | ---------------------------------------- |
| account_id       | uuid        | 不可 | なし             | 主キー. global.accounts.idを参照         |
| line_provider_id | text        | 不可 | なし             | 1〜128文字. 検証済み設定値               |
| line_user_id     | text        | 不可 | なし             | 1〜128文字. LINEトークン検証結果のみ使用 |
| created_at       | timestamptz | 不可 | サーバー現在時刻 | 作成時に固定                             |

(line_provider_id, line_user_id)を一意とする. 大文字小文字変換・自動補完をしない. 保持規則は[RET-AUT-02](../../../documents/data-retention.md#ret-aut-02). 表示名・画像は保存しない.

## auth_local.auth_sessions

| 列名       | 型          | NULL | 既定値           | 入力・制約・意味                                      |
| ---------- | ----------- | ---- | ---------------- | ----------------------------------------------------- |
| id         | uuid        | 不可 | サーバー生成     | 主キー. 利用者による指定・変更不可                    |
| account_id | uuid        | 不可 | なし             | global.accounts.idを参照                              |
| token_hash | text        | 不可 | なし             | SHA-256の小文字16進64文字. 一意. 生トークンは保存不可 |
| expires_at | timestamptz | 不可 | なし             | created_atより後                                      |
| revoked_at | timestamptz | 可   | NULL             | 失効時刻. created_at以降                              |
| created_at | timestamptz | 不可 | サーバー現在時刻 | 作成時に固定                                          |

サーバー管理セッション方式のデータ定義. セッション方式の技術実証で採否を決める. 失効・削除・復元時の保持規則は[RET-AUT-06](../../../documents/data-retention.md#ret-aut-06).

## global.account_roles

| 列名       | 型          | NULL | 既定値           | 入力・制約・意味                                                             |
| ---------- | ----------- | ---- | ---------------- | ---------------------------------------------------------------------------- |
| account_id | uuid        | 不可 | なし             | global.accounts.idを参照                                                     |
| role_code  | text        | 不可 | なし             | PRACTICE_ADMIN / ROSTER_ADMIN / PROMOTION_STAFF / ACCESS_ADMIN / SUPER_ADMIN |
| granted_by | uuid        | 可   | NULL             | 付与者のaccounts.id. 初期管理者設定時のみNULL                                |
| granted_at | timestamptz | 不可 | サーバー現在時刻 | 付与日時                                                                     |

主キーは(account_id, role_code). MEMBERは紐付けから判定し行を作らない. 将来Appのロールは契約を定義後に登録. 剥奪時の行と監査の保持規則は[RET-AUT-03](../../../documents/data-retention.md#ret-aut-03). 最後の有効なSUPER_ADMINの剥奪を拒否する.

## global.member_links

| 列名              | 型          | NULL | 既定値           | 入力・制約・意味                                                  |
| ----------------- | ----------- | ---- | ---------------- | ----------------------------------------------------------------- |
| id                | uuid        | 不可 | サーバー生成     | 主キー. 利用者による指定・変更不可                                |
| account_id        | uuid        | 不可 | なし             | global.accounts.idを参照                                          |
| member_id         | uuid        | 不可 | なし             | 名簿APIで確認したglobal.members.id. 他App所有のためDB連鎖削除なし |
| relationship_code | text        | 不可 | なし             | SELF / GUARDIAN. 権限を意味しない                                 |
| declared_at       | timestamptz | 不可 | サーバー現在時刻 | 申告日時                                                          |
| reviewed_at       | timestamptz | 可   | NULL             | 事後確認日時. 利用開始条件ではない                                |
| reviewed_by       | uuid        | 可   | NULL             | 確認者のaccounts.id. reviewed_atと同時に設定                      |
| revoked_at        | timestamptz | 可   | NULL             | 解除日時. created_at以降                                          |
| created_at        | timestamptz | 不可 | サーバー現在時刻 | 作成時に固定                                                      |

revoked_at IS NULLの(account_id, member_id)を一意とする. 有効紐付けはアカウントごとに最大5名. 初回セットと完了日時は同一トランザクションで確定. 確認日時・確認者は両方NULLまたは両方非NULL. 有効行・解除済み行の保持規則と名簿削除時の整理は[保存期限](../../../documents/data-retention.md)の[RET-AUT-04](../../../documents/data-retention.md#ret-aut-04)・[RET-AUT-05](../../../documents/data-retention.md#ret-aut-05)に従う.

## auth_local.development_testers

| 列名             | 型          | NULL | 既定値           | 入力・制約・意味                     |
| ---------------- | ----------- | ---- | ---------------- | ------------------------------------ |
| line_provider_id | text        | 不可 | なし             | 1〜128文字. 開発環境のprovider       |
| line_user_id     | text        | 不可 | なし             | 1〜128文字. 管理手順で指定した検証者 |
| created_at       | timestamptz | 不可 | サーバー現在時刻 | 作成時に固定                         |

主キーは(line_provider_id, line_user_id). 開発環境のみに作成. ログイン時と各要求時に許可を確認し, 行の削除で許可を解除する. 自動登録しない. 業務ロールの付与とは別. アカウント未作成時の初回ログインにも適用する.

監査・運用記録は[共通列定義](../../../documents/operational-data.md)を使い, auth_localで管理する.
