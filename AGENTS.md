# Codex project guidance

## 最優先の開発方針

このリポジトリは、エージェントへ実装を任せる実験です。ゲームのルール・遊び方・UI・対戦の有無・アーキテクチャ・言語・フレームワーク・通信・ファイル構成を、既存にとらわれず自由に選んでください。必要なら全面的な再設計・置換・不要機能の削除を行ってよいです。既存仕様との互換性、現行スタックの維持、標準テトリス仕様への準拠、旧TODOの消化は必須ではありません。

通常の仕様・設計判断は確認待ちで停止せず、小さく完成できる方向を選び、実装と検証まで進めてください。評価するのは、実際に遊べること、再現可能であること、選んだ仕様を検証できること、判断理由が引き継がれることです。

以下のNode.js等の記述は現行構成の手順です。構成を変更する場合は起動・テスト・CI・文書も合わせて更新してください。新しい本番依存の追加には事前確認が必要です。JavaScript変更後は必ずnpm testを実行してください。他の作業や認証情報は保護してください。

## 課題管理と別セッションへの引き継ぎ

- 開発方針と着手順の入口は [管理Issue #21](https://github.com/tehutahu/codex_tetoris/issues/21) です。新しいセッションは最初に確認してください。
- 進捗の正本はGitHub Issuesの状態と関連PRです。文書に進捗チェックリストを複製しません。
- 基本は1つの実装Issueを1回のgoalにします。最新mainと関連PRで重複着手を確認し、対象Issueに担当セッション・ブランチ・今回の範囲を記録してください。
- Issue内の現状や推奨実装は観測・提案であり、既存仕様を固定する制約ではありません。方向を変える場合は判断理由と新しい受け入れ条件を記録してください。
- PRにCloses #対象Issue番号、仕様の選択理由、検証結果、未検証事項を記載してください。完了条件を満たしたPRがマージされて初めて実装課題を完了とします。
- マージはそのセッションのユーザー指示・権限に従います。

## Source of truth

- Git and GitHub are the source of truth. Never rely on files or installed packages that exist only in one cloud task.
- Keep changes scoped, commit them on the current branch, and include the commands and results used for verification.
- Never commit credentials or `.env` files.

## Setup and verification

- Use Node.js 20 as selected by `.nvmrc`.
- Run `bash scripts/codex-setup.sh` when a fresh Codex environment is created.
- Run `npm test` and `npm run build` before completing code changes.
- For user-visible web changes, start the application and check it in a browser. Capture a screenshot when the environment provides browser tooling.

## Implementation conventions

- Keep game rules independent from Phaser, React, and Socket.IO where practical so they can be unit tested.
- Add or update tests for behavior changes.
- Update README or relevant files under `docs/` when commands, architecture, or user-visible behavior changes.
- User-facing project documentation and review summaries should be written in Japanese. Code identifiers and source comments may be in English.
