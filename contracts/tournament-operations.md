# 大会班の公開API

契約案. 共通の文脈・DTO・エラーは[公開契約](README.md)に従う. 実際のHTTPパスと実装は未確定.

| ID | 操作 | 入力 | 出力 | 利用元・認可 |
| --- | --- | --- | --- | --- |
| <a id="api-top-01"></a>API-TOP-01 | `getRecruitment` | tournamentId | 大会表示名, 日程, 募集条件, 締切, conditionsRevision | 参加希望App. 認証済みで募集情報の閲覧資格を持つ主体. 内部作業情報は除外 |
| <a id="api-top-02"></a>API-TOP-02 | `receiveParticipationRequest` | 参加希望APIから取得した希望, requestId, revision, conditionsRevision, 冪等キー | requestId, receivedRevision, 受領状態 | 大会班の担当権限または受渡し専用の運用主体. 参加希望Appの正本からの取得を確認 |
| <a id="api-top-03"></a>API-TOP-03 | `getMemberOutcome` | tournamentId, targetMemberId, requestId | 受領有無, receivedRevision, 開示可能な処理結果, revision | 参加希望App. 本人・有効な代理対象または許可された担当権限に限定 |

後続リリースの案. 希望IDと版に対する受領は冪等とし, 古い版で新しい版を上書きしない. 版文字列の辞書順に依存せず, 所有Appが定義する順序・現行版の比較で検証する. 未受領は結果APIの成功応答内で明示し, 通信障害とは区別する. 受領は参加確定を意味しない.

一般会員へ開示する募集・結果APIと, 担当者用の受領・内部タスクAPIを権限上分離する. 内部メモ・入金タスク・他会員の非公開情報を結果DTOに含めない. 締切境界・募集条件版の競合・結果項目・保存期間は[大会契約](tournaments.md)で確定する. 大会班は名簿APIを利用できるが, 参加希望や名簿の内部テーブルを変更しない.
