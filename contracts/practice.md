# 練習の公開API

契約案. 共通の文脈・DTO・エラーは[公開契約](README.md)に従う. 実際のHTTPパスと実装は未確定.

| ID | 操作 | 入力 | 出力 | 利用元・認可 |
| --- | --- | --- | --- | --- |
| <a id="api-prc-01"></a>API-PRC-01 | `listOpenPractices` | 日付範囲, ページ条件 | practiceId, 業務日, 会場表示, 締切時点, registeredCount, capacity, remainingCount, overflowCount, revision | 練習画面, 必要な場合のみポータル. ログイン済みで練習の利用資格を持つ主体 |
| <a id="api-prc-02"></a>API-PRC-02 | `getRegistrationSummary` | targetMemberId, 日付範囲, ページ条件 | practiceId, 対象会員の登録有無・状態, 締切, revisionの一覧 | ポータル・練習画面. 有効な本人・代理紐付け, または対象を扱える管理権限を確認 |

概要には他会員の氏名・備考を含めない. 募集中の参加者一覧の公開範囲は[練習画面仕様](../app/practice/docs/screens-and-flows.md)に従い所有Appで扱う. 残席は0が下限, 超過人数は別項目. 満員を受付停止へ変換せず, 人数は実出席でなく登録人数である.

練習Appは[認証API](auth.md)と[名簿API](roster.md)で主体・代理対象・資格を検証する. 登録・変更・取消は[練習業務仕様](../app/practice/docs/requirements.md)に従い自Appで行う. 集計時は指定日時点の級を取得し, 集計保存・個人別削除は自Appの運用APIが担当する.
