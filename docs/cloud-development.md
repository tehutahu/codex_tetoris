# Codex クラウド開発ガイド

## 結論

このプロジェクトは Codex のクラウド環境を主な開発環境として継続できる。ただし、クラウド上の作業ディレクトリそのものを永続ストレージとは考えず、**GitHub のブランチ、commit、pull request を成果物の正本**にする。

Codex の環境が新しく作られても同じ状態を再現できるよう、このリポジトリには以下を用意した。

- `.nvmrc`: Node.js の major version を固定する。
- `package-lock.json`: npm 依存関係を固定する。
- `scripts/codex-setup.sh`: 依存導入とビルドを一度に検証する。
- `AGENTS.md`: Codex が各タスクで従う、リポジトリ固有の永続的な指示を定義する。

## Codex 側で最初に必要な設定

1. GitHub 上のこのリポジトリを Codex に接続する。
2. 環境の Node.js を 20 にする。少なくとも `20.19` 以降を使用する。
3. 環境の setup command に次を登録する。

   ```bash
   bash scripts/codex-setup.sh
   ```

4. npm registry から依存を取得するため、setup 中のネットワークアクセスを許可する。制限付きネットワークを使う場合は、少なくとも利用する npm registry のホストを allowlist に含める。
5. Codex に pull request を作成できる GitHub 権限を与える。`main` への直接 push ではなく、タスクごとのブランチと pull request を使う。

OpenAI-hosted environment は Node.js などのツール、事前インストールする package、setup command、ネットワークポリシーを構成できる。environment template を使う場合も、template は実行中 workspace のスナップショットではなく構成を再利用するものなので、再現に必要なものはリポジトリと setup command に残す。詳細は [OpenAI-hosted sandboxes](https://developers.openai.com/api/docs/guides/agents-api/environments/openai-hosted) を参照する。

## 通常の開発フロー

タスクごとに次の流れを使う。

1. 最新の既定ブランチを基点に Codex task を開始する。
2. setup command の成功を確認する。
3. 要件と受け入れ条件を日本語で提示する。
4. Codex が実装、テスト、ブラウザ確認を行う。
5. diff とテスト結果をレビューする。
6. Codex が commit と pull request を作成する。
7. CI が成功し、人がレビューした後に merge する。

環境をまたいで残したい決定事項は会話だけに置かず、次のいずれかへ書く。

| 情報 | 保存先 |
| --- | --- |
| 実装とテスト | Git 管理されたソースコード |
| 常に守る開発規約 | `AGENTS.md` |
| セットアップ手順 | `scripts/codex-setup.sh` と README |
| 設計判断 | `docs/` または ADR |
| 作業単位の議論 | GitHub issue / pull request |
| パスワードやトークン | Codex/GitHub の secret 管理機能。リポジトリには保存しない |

## このプロジェクトでまだ必要なもの

クラウドだけで安全に開発を回すため、次を順に追加する。

### 必須

- **CI**: pull request ごとに `npm ci`, `npm test`, `npm run build` を実行する GitHub Actions。
- **実テスト**: 現在の `npm test` はテストを実行しないため、テストランナーと最低限の game logic / server test を導入する。
- **ブランチ保護**: CI とレビューが成功するまで既定ブランチへ merge できない設定。
- **ブラウザ確認手段**: 開発サーバーを起動し、1人プレイと2クライアント接続を確認できる preview/E2E 手順。

### 必要になった時点で追加

- デプロイ先の token、外部 API key、private registry credential は secret として登録し、ログやコードへ出さない。
- 本番デプロイは人の承認が必要な GitHub Environment などへ分離する。
- 定期的な依存更新、脆弱性監査、バックアップ/リリース手順を自動化する。

環境内のコードは、環境から見えるファイル、credential、network へアクセスできる。権限はタスクに必要な最小限にし、長期 secret をソース、コンテナイメージ、ログへ含めない。詳細は [Sandbox security](https://developers.openai.com/api/docs/guides/agents-api/environments/security) を参照する。

## 現時点の判断

- **Codex クラウド中心で開発することは可能**。
- GitHub、再現可能な setup、CI、人による merge 判断を組み合わせれば、ローカル PC を日常的な必須環境にする必要はない。
- 一方、ブラウザでの操作感、複数クライアント、デプロイ先固有の動作は自動テストだけに任せず、preview 環境またはリリース前の人手確認を残す。
- 次の実装タスクは、`docs/current-status.md` の Baseline PR と Quality PR をまとめて進め、CI と実テストを有効化するのが適切である。
