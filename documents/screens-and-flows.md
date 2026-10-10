# 画面・操作設計案

[初回リリース仕様](initial-release.md)に対応する画面と操作. 未確定の業務条件は[設計判断](open-questions.md)に記載する.

## 共通UI

- スマホを基本に, 共通の見た目と各App内のナビゲーションを使う. URL・状態・認証復帰・画面所有者は[全体設計](architecture.md)に従う.
- 家族分の操作では対象会員の氏名を画面上部と送信前に表示する. 操作者と対象会員を取り違えない.
- 保存中は重複送信を抑止し, サーバーでも重複を防ぐ. 保存失敗時は入力内容を保持する.
- 状態を色だけで表さず, 文字を併用する. 入力欄にはラベル, エラーには修正方法を付ける.
- 日付・締切は日本時間で表示する. 文字サイズ・余白・色・ボタン種類を共通部品で管理する.
- 一般利用者の画面には権限コードや内部IDを出さない.

## 画面一覧

画面IDの定義と表示・操作・利用者は所有Appの画面仕様を正本とする. 横断運用画面[SCR-OPS-01](screens-and-flows.md#scr-ops-01)のみ本書で定義する.

| ID | 画面 | 表示と操作 | 利用者 |
| --- | --- | --- | --- |
| [SCR-AUT-01](../app/auth/docs/screens-and-flows.md#scr-aut-01) | ログイン・初回案内 | [authの画面仕様](../app/auth/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-PTL-01](../app/portal/docs/screens-and-flows.md#scr-ptl-01) | ポータル | [portalの画面仕様](../app/portal/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-AUT-02](../app/auth/docs/screens-and-flows.md#scr-aut-02) | 紐付け確認 | [authの画面仕様](../app/auth/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-PRC-01](../app/practice/docs/screens-and-flows.md#scr-prc-01) | 練習一覧 | [practiceの画面仕様](../app/practice/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-PRC-02](../app/practice/docs/screens-and-flows.md#scr-prc-02) | 練習詳細 | [practiceの画面仕様](../app/practice/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-PRC-03](../app/practice/docs/screens-and-flows.md#scr-prc-03) | 出欠編集 | [practiceの画面仕様](../app/practice/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-PRC-04](../app/practice/docs/screens-and-flows.md#scr-prc-04) | 参加者一覧 | [practiceの画面仕様](../app/practice/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-PRC-05](../app/practice/docs/screens-and-flows.md#scr-prc-05) | 過去の集計 | [practiceの画面仕様](../app/practice/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-RST-01](../app/roster/docs/screens-and-flows.md#scr-rst-01) | 名簿一覧 | [rosterの画面仕様](../app/roster/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-RST-02](../app/roster/docs/screens-and-flows.md#scr-rst-02) | 会員詳細・編集 | [rosterの画面仕様](../app/roster/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-RST-03](../app/roster/docs/screens-and-flows.md#scr-rst-03) | 昇級登録 | [rosterの画面仕様](../app/roster/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-RST-04](../app/roster/docs/screens-and-flows.md#scr-rst-04) | 名簿取込・出力 | [rosterの画面仕様](../app/roster/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-PRC-06](../app/practice/docs/screens-and-flows.md#scr-prc-06) | 会場管理 | [practiceの画面仕様](../app/practice/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-PRC-07](../app/practice/docs/screens-and-flows.md#scr-prc-07) | 練習管理 | [practiceの画面仕様](../app/practice/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-AUT-03](../app/auth/docs/screens-and-flows.md#scr-aut-03) | 紐付け管理 | [authの画面仕様](../app/auth/docs/screens-and-flows.md) | 所有Appで認可 |
| [SCR-AUT-04](../app/auth/docs/screens-and-flows.md#scr-aut-04) | ロール管理 | [authの画面仕様](../app/auth/docs/screens-and-flows.md) | 所有Appで認可 |
| <a id="scr-ops-01"></a>SCR-OPS-01 | 運用状況 | バックアップ・集計化の成功時刻, 失敗内容, 手動再実行 | 全体管理者を基本案とする |

一覧と詳細は同じ画面内の切替でもよい. 画面数とページ数を一致させる必要はない.
初回未提供の大会・会計Appは, URL設定済みなら既存Appへの入口とし, 未設定なら入口を表示しない案.

## 操作フローの参照先

認証の初回紐付け・管理操作, 練習の公開範囲・登録・例外・期限後の表示, 名簿操作は, 上表でリンクした所有Appの画面仕様を正本とする. 本書は共通UIと画面の索引を扱う.
