# 認証・アクセス管理の公開API

契約案. 共通の文脈・DTO・エラーは[公開契約](README.md)に従う. 実際のHTTPパスと実装は未確定.

| ID | 操作 | 入力 | 出力 | 利用元・認可 |
| --- | --- | --- | --- | --- |
| <a id="api-aut-01"></a>API-AUT-01 | `resolveActor` | 入口で受け取ったセッション, 環境 | actorId, 現行roles, accessRevision. 未紐付けでも主体を返せる | 全Appの信頼されたサーバー入口. 有効なアカウント・セッションと開発版許可を確認 |
| <a id="api-aut-02"></a>API-AUT-02 | `listActingMembers` | 検証済み主体, ページ条件 | memberId, relationship, linkRevisionの一覧 | 全App. 操作者本人の有効な紐付けのみ. 氏名等は名簿APIで用途別に取得 |
| <a id="api-aut-03"></a>API-AUT-03 | `checkAccess` | 検証済み主体, 所有Appが定義する操作, 必要ならtargetMemberId | 許可時のactorId, targetMemberId, accessRevision, linkRevision | 全App. 現行ロールと紐付けを確認. 不許可はFORBIDDEN. 対象会員の管理権限を継承しない |

認証が返す紐付け・権限の許可と, 名簿の在籍状態・種別に基づく業務資格を分離する. 各Appは後者と締切等を判定する. accessRevisionは認可結果の永久保証ではなく, 更新時の競合検証に使う案. 生のトークンやLINE識別子は他Appへ返さない.

認証Appは初回紐付けで[名簿候補検索](roster.md#api-rst-02)と[会員基本情報](roster.md#api-rst-03)を利用する. 名簿側は検証済み文脈を受け取り, resolveActorから名簿を呼ぶ循環を作らない. ロール・紐付け変更は[認証App仕様](../app/auth/docs/requirements.md)が所有する.
