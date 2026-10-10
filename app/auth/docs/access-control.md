# App固有仕様

業務要件と具体的な設計案を記載する. 未確定の判断は「案」または「未決」と明示する.


## 権限の更新

- 通常ロールは `practice.manage`, `attendance.manage`, `roster.write`, `promotion.register`, `access.manage` 等の名前付き権限の集合としてコード定義する.
- 任意の権限編集画面は初回に作らず, ロール付与画面に限定する案.
- アクセス管理者はACCESS_ADMIN・SUPER_ADMINを含めロールを付与可能とし, 自身より上位という理由で拒否しない. 付与数も制限しない. ロールの重複行は一意制約で防ぐ.
- 最後の有効なSUPER_ADMINの剥奪・アカウント無効化を拒否する.
- 権限をJWT内だけに保持せず, 更新・参照時にDBの現行ロール・紐付け・アカウント状態を確認する. 剥奪後の古いセッションで操作できないことをテストする.
- 初期SUPER_ADMINは運営者が指定したLINEアカウントを検証後, 管理用手順で1件設定する. 「最初にログインした人」を自動管理者にしない.

## 認証からDB認可までの構成案

1. LIFFから受け取ったトークンをサーバーで検証し, 検証結果のLINE識別子でアカウントを特定する. ブラウザが送ったプロフィールやUIDを認証根拠にしない. [LINE公式資料](https://developers.line.biz/en/docs/line-login/verify-id-token/)
2. アプリのセッションと内部アカウントIDを対応させる. サーバーで管理するセッションCookieを使用し, HTTPS・HttpOnly・SameSite・有効期限・失効を設計する.
3. DB呼出しには検証済みの内部アカウントIDを持つ利用者用JWTを渡し, RLSで対象と操作範囲を確認する案. Supabaseが受理する外部JWTには対応方式・鍵設定が必要であり, LINEトークンをそのまま渡せる前提にしない. [Supabase JWT資料](https://supabase.com/docs/guides/auth/jwts)
4. 変更はトランザクション関数に集約し, 関数内でも資格・締切・更新対象を検証する. 画面のボタン非表示だけで権限制御しない.

[MIL-SYS-03](../../../documents/scope-and-milestones.md#mil-sys-03)の最初に, LINEトークン検証から利用者JWT・RLSへ至る最小実証を行う. Supabaseへインポートした署名鍵によるJWT発行を候補とし, 無料枠での適用・鍵管理・更新・失効・セッション保護を検証して方式を確定する.
これが成立しない場合は設計をレビューし直す. 常用の全権キーでRLSを迂回して完成扱いにはしない.
RLSは公開スキーマのテーブルに有効化し, ポリシーのない操作を拒否する. service role等のバイパス可能な資格情報を利用者処理と分ける. [Supabase RLS資料](https://supabase.com/docs/guides/database/postgres/row-level-security)
