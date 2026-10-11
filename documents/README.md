# プロジェクト仕様

認証, ポータル, 名簿管理, 練習管理を独立したミニアプリとして構成する. 大会参加希望と大会班作業は後続リリースの別Appとする. 各Appが所有テーブル・仕様・テストを管理し, App間は公開APIで連携する.

IDと文書の正本は[仕様書の管理規則](specification-conventions.md), 以前の番号は[旧新対応](id-migration.md)を参照する.

## 全体仕様

| 文書                                                           | 内容                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| [全体設計](architecture.md)                                    | App境界, DB管理, 依存, 画面遷移                         |
| [スコープと工程](scope-and-milestones.md)                      | 対象範囲とマイルストーン                                |
| [初回リリース](initial-release.md)                             | 要件と受入条件                                          |
| [環境仕様](development-environment.md)                         | 開発版・本番版の分離, GitとVercelの版管理・更新・切戻し |
| [画面一覧](screens-and-flows.md)                               | 画面と所有App                                           |
| [権限](access-control.md)                                      | 共通の権限と利用範囲                                    |
| [DB設計](data-design.md)                                       | global/local分類, 管理者, データ辞書                    |
| [保存期限](data-retention.md)                                  | データ保持, バックアップ, 復元                          |
| [公開契約](../contracts/README.md)                             | 各Appの公開API・DTO・認可・連携手順                     |
| [実装・検証計画](implementation-plan.md)                       | 工程, 検証, 移行                                        |
| [文書整合性レビュー](documentation-review.md)                  | 重複の整理結果と未定義事項                              |
| [設計判断](open-questions.md)                                  | 実装前に確定する業務条件                                |
| [実装着手条件](specification-review.md)                        | 技術実証と受入判定                                      |
| [開発用外部サービスの設定](development-services-setup.md)      | Supabase, GAS・Drive, Vercel, LINE/LIFFの準備と設定     |
| [GAS保存先の入出力実証計画](gas-storage-probe-plan.md)         | 架空データの保存・読戻しと完了報告                      |
| [保存期限と永久削除の実証計画](backup-retention-probe-plan.md) | 世代更新・永久削除と残る全DB実証の工程                  |

## 開発規約

| 文書                                            | 内容                                                      |
| ----------------------------------------------- | --------------------------------------------------------- |
| [開発規約](development-conventions.md)          | 計画レビュー, 実装, 検証, 完了条件                        |
| [Git運用規約](git-workflow.md)                  | ブランチ, PR, 緊急修正, 人間とAIの操作範囲                |
| [コーディング規約](coding-conventions.md)       | 命名, 構造, 型・入力, エラー, テスト, 整形                |
| [セキュリティ開発規約](security-development.md) | セキュリティレビュー, 自動検査, skill・拡張機能の導入方針 |

## App別仕様

- [認証・アクセス管理](../app/auth/README.md)
- [ポータル](../app/portal/README.md)
- [名簿管理](../app/roster/README.md)
- [練習管理](../app/practice/README.md)
- [大会参加希望](../app/tournament-entry/README.md)
- [大会班](../app/tournament-operations/README.md)

業務仕様の未確定部分は「案」または「未決」と明記する. 過去の議論はhistory配下の記録とし, 現行仕様の根拠は本文に記載する. 新機能には自動テストを用意し, 既存の期待結果を変更する場合は実装前にレビューする.
