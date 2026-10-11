# DB設計

Supabaseの共通アカウントで管理する. 開発・本番は環境別プロジェクトとし, 各環境内のテーブルをglobalとApp localに分ける. スキーマ名は以下の設計とする. テーブルの管理責任はミニアプリにある.

## テーブル分類と所有者

本節をテーブル分類・所有者の正本とする. 初回のデータ辞書に記載されたテーブルを列挙する. 1行は1テーブルであり, 保持規則は[保存期限](data-retention.md)に定義する. 同一テーブルの行・列ごとに期限が異なる場合も, テーブルの区分・所有者は変わらない. 列定義は所有Appのデータ辞書を参照する.

| ID                                | 区分   | テーブル                         | 管理App | データ辞書                                                                  | 保持規則                                                                               |
| --------------------------------- | ------ | -------------------------------- | ------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| <a id="tbl-aut-01"></a>TBL-AUT-01 | global | global.accounts                  | 認証    | [認証](../app/auth/docs/data-design.md#globalaccounts)                      | [RET-AUT-01](data-retention.md#ret-aut-01)                                             |
| <a id="tbl-aut-02"></a>TBL-AUT-02 | global | global.account_roles             | 認証    | [認証](../app/auth/docs/data-design.md#globalaccount_roles)                 | [RET-AUT-03](data-retention.md#ret-aut-03)                                             |
| <a id="tbl-aut-03"></a>TBL-AUT-03 | global | global.member_links              | 認証    | [認証](../app/auth/docs/data-design.md#globalmember_links)                  | [RET-AUT-04](data-retention.md#ret-aut-04), [RET-AUT-05](data-retention.md#ret-aut-05) |
| <a id="tbl-rst-01"></a>TBL-RST-01 | global | global.members                   | 名簿    | [名簿](../app/roster/docs/data-design.md#globalmembers)                     | [RET-RST-01](data-retention.md#ret-rst-01)                                             |
| <a id="tbl-aut-04"></a>TBL-AUT-04 | local  | auth_local.account_identities    | 認証    | [認証](../app/auth/docs/data-design.md#auth_localaccount_identities)        | [RET-AUT-02](data-retention.md#ret-aut-02)                                             |
| <a id="tbl-aut-05"></a>TBL-AUT-05 | local  | auth_local.auth_sessions         | 認証    | [認証](../app/auth/docs/data-design.md#auth_localauth_sessions)             | [RET-AUT-06](data-retention.md#ret-aut-06)                                             |
| <a id="tbl-aut-06"></a>TBL-AUT-06 | local  | auth_local.development_testers   | 認証    | [認証](../app/auth/docs/data-design.md#auth_localdevelopment_testers)       | [RET-AUT-07](data-retention.md#ret-aut-07)                                             |
| <a id="tbl-aut-07"></a>TBL-AUT-07 | local  | auth_local.audit_events          | 認証    | [運用列定義](operational-data.md)                                           | [RET-AUT-08](data-retention.md#ret-aut-08), [RET-AUT-09](data-retention.md#ret-aut-09) |
| <a id="tbl-aut-08"></a>TBL-AUT-08 | local  | auth_local.operation_runs        | 認証    | [運用列定義](operational-data.md)                                           | [RET-OPS-01](data-retention.md#ret-ops-01)                                             |
| <a id="tbl-rst-02"></a>TBL-RST-02 | local  | roster_local.grade_history       | 名簿    | [名簿](../app/roster/docs/data-design.md#roster_localgrade_history)         | [RET-RST-02](data-retention.md#ret-rst-02)                                             |
| <a id="tbl-rst-03"></a>TBL-RST-03 | local  | roster_local.audit_events        | 名簿    | [運用列定義](operational-data.md)                                           | [RET-RST-03](data-retention.md#ret-rst-03)                                             |
| <a id="tbl-rst-04"></a>TBL-RST-04 | local  | roster_local.operation_runs      | 名簿    | [運用列定義](operational-data.md)                                           | [RET-OPS-01](data-retention.md#ret-ops-01)                                             |
| <a id="tbl-prc-01"></a>TBL-PRC-01 | local  | practice_local.venues            | 練習    | [練習](../app/practice/docs/data-design.md#practice_localvenues)            | [RET-PRC-01](data-retention.md#ret-prc-01)                                             |
| <a id="tbl-prc-02"></a>TBL-PRC-02 | local  | practice_local.practice_sessions | 練習    | [練習](../app/practice/docs/data-design.md#practice_localpractice_sessions) | [RET-PRC-02](data-retention.md#ret-prc-02), [RET-PRC-03](data-retention.md#ret-prc-03) |
| <a id="tbl-prc-03"></a>TBL-PRC-03 | local  | practice_local.attendances       | 練習    | [練習](../app/practice/docs/data-design.md#practice_localattendances)       | [RET-PRC-04](data-retention.md#ret-prc-04)                                             |
| <a id="tbl-prc-04"></a>TBL-PRC-04 | local  | practice_local.audit_events      | 練習    | [運用列定義](operational-data.md)                                           | [RET-PRC-05](data-retention.md#ret-prc-05), [RET-PRC-06](data-retention.md#ret-prc-06) |
| <a id="tbl-prc-05"></a>TBL-PRC-05 | local  | practice_local.operation_runs    | 練習    | [運用列定義](operational-data.md)                                           | [RET-OPS-01](data-retention.md#ret-ops-01)                                             |

localから他Appに結果を提供する場合も公開APIを用いる. 級履歴を用いた指定日級の照会は名簿APIで提供し, grade_historyをglobalにしない. globalには各Appの作業用データや汎用的なJSON置場を設けない.

## 後続データとテーブルを持たないApp

| 管理App      | 区分・設計状況                                                                             | データ辞書                                                  |
| ------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| ポータル     | 初回は業務・監査・ジョブ実行テーブルなし. [DEC-OPS-05](open-questions.md#dec-ops-05)で確定 | [ポータル](../app/portal/docs/specification.md)             |
| 大会参加希望 | local. 参加希望データのテーブル名・列・保持期限は後続設計                                  | [大会参加希望](../app/tournament-entry/docs/data-design.md) |
| 大会班       | local. 大会・受付・確定名簿・戦績・作業データのテーブル名・列・保持期限は後続設計          | [大会班](../app/tournament-operations/docs/data-design.md)  |

上表の後続データはテーブル定義ではない. [DEC-SYS-02](open-questions.md#dec-sys-02)は後続Appの実装開始時に具体化して一覧へ追加し, 初回リリースの条件には含めない. ポータルは所有Appの公開APIを利用する. 運用テーブルは全Appに一律で作らず, 本一覧にある業務更新・ジョブ実行を担う所有Appだけに置く.
招待コード方式のinvitationsと独立集計テーブルpractice_summariesは作成しない. 確定集計はpractice_local.practice_sessionsの列に保持する.

## 管理とアクセス

- 各所有Appが列定義, マイグレーション, 制約, API, 認可, 監査, 保持期限, 自動テストを管理する.
- globalの変更には利用Appへの契約互換性を確認する. 他Appによる直接のSELECT・JOIN・更新を許可しない. 用途別DTOだけを公開する.
- 同じAppが管理するglobalとlocalは同一トランザクションと外部キーを利用できる. 異なる所有者への参照はIDと公開APIで扱い, 横断CASCADEを設けない.
- マイグレーションはapp/<app>/db/globalとapp/<app>/db/localに置く設計. 同一環境での適用順序を全体計画に記録するが, テーブル定義を全体側へ複製しない.
- DB権限と公開関数の権限を分け, Appの全権キー共用で境界を迂回しない. 実装時に権限・RLSの拒否試験を行う.

## 列と入力の共通規則

- 列名は英小文字snake_case. PostgreSQL型で定義し, NULL・既定値・入力制約を列ごとに記載する. 表の「なし」は入力またはサーバー処理による明示値が必要という意味.
- 内部IDはUUID. 外部入力の構文を検証し, 対象の存在とアクセス権を別途確認する. created_at等のサーバー列をクライアントが指定する要求は拒否する.
- dateはYYYY-MM-DDの実在日, time(0)はHH:mmで秒0, timestamptzはオフセット付き日時. 業務境界はAsia/Tokyo. データ辞書に別指定がなければクライアントによる時刻生成は認めない.
- textは前後の空白を除去し, 任意入力の空文字はNULL, 必須入力の空文字は拒否する案. 氏名・かなはUnicode文字を許容し, 文字種を理由に拒否しない. 識別子・秘密値はtrimや大小文字変換をしない.
- 文字数はUnicodeコードポイント数で検証する案. 改行は自由記述のみ許可し, NULと不要な制御文字は拒否. 文字数超過の自動切詰めは禁止.
- 数値の暗黙変換・丸め, 未知のコードの自動補正, 不明な日付や級の補完をしない. 配列は要素型・NULL・重複・要素集合を検証する.
- DBのNOT NULL / CHECK / UNIQUEとAPI入力検証を対応させる. 複数行の競合制約はトランザクションで検証. 空欄と0, 未確定と確定0件を区別する.
- バックアップ・CSV・復元でも同じ型を保ち, 一括取込は全件検証後に確定する.

## 確定手順

初回テーブルの全列は各Appのデータ辞書に記載する. 文字数上限等の新規制約と移行例外は[設計判断](open-questions.md)でレビューし, SQLと入力フォームを作る前に確定する. 大会2Appは業務条件の確定後, 列ごとの辞書を完成させることを当該大会Appの着手条件とする. 初回4Appの着手・受入条件には含めない. 未決の型やJSONの自由入力に実装判断を委ねない.

保持期限と月次処理は[保存期限](data-retention.md), App横断のアクセスと整合性は[全体設計](architecture.md)に記載する.
