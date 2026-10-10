# 名簿の公開API

契約案. 共通の文脈・DTO・エラーは[公開契約](README.md)に従う. 実際のHTTPパスと実装は未確定.

| ID | 操作 | 入力 | 出力 | 利用元・認可 |
| --- | --- | --- | --- | --- |
| <a id="api-rst-01"></a>API-RST-01 | `searchActiveMembers` | 検索語, 用途に応じた級条件, ページ条件 | memberId, displayName, 必要なgrade, revisionの一覧 | 練習・大会の権限を持つ担当者. 対象級等の業務判断は利用Appが担当 |
| <a id="api-rst-02"></a>API-RST-02 | `searchLinkCandidates` | 氏名検索語, ページ条件 | memberId, displayName, 確定後の同姓同名識別項目, revision | 認証Appの初回紐付け処理. 未紐付けの認証済み主体も利用可能. 空検索・全件取得は禁止する案 |
| <a id="api-rst-03"></a>API-RST-03 | `getMemberBasics` | 会員ID群, サーバー側で固定した用途 | memberId, displayName, 用途に必要なstatus, memberType, grade, revision | 認証, 練習, 大会2App. 初回紐付けの選択確認, 有効な紐付け対象, 担当権限, または許可された集計処理の範囲 |
| <a id="api-rst-04"></a>API-RST-04 | `getGradesAtDate` | 会員ID群, 業務日 | memberId, gradeまたはNULL, known, revision | 練習集計や大会業務の許可された処理. grade_historyの行は返さない |

全操作に認証を要求し, 内部履歴の行や連絡先を公開DTOへ含めない. 退会者の参照は用途別に制限する. 会員ID群は1〜100件, 重複はINVALID_INPUTの案. 一括照会は要求対象すべての認可を確認し, 非公開対象があれば部分的な情報開示をしない.

現役の定義は[DEC-RST-02](../documents/open-questions.md#dec-rst-02), 候補表示項目は[DEC-AUT-01](../documents/open-questions.md#dec-aut-01)の確定後に反映する. 検索の頻度制限・上限で列挙を抑制する.

`known=false`は照会に成功したが級を確認できない場合のみ. 不在・非公開対象はNOT_FOUND, 通信失敗はDEPENDENCY_UNAVAILABLE. 現役検索から消えたことを削除通知として扱わない. 参照整理は運用APIと[保存期限](../documents/data-retention.md)に従う.

名簿は認証の検証済み文脈を利用し, 練習や大会の内部を呼ばない. 登録・昇級・取込は[名簿Appの権限](../app/roster/docs/requirements.md)に従う所有Appの操作とする.
