# codex_tetoris
A simple Tetris implementation that now uses **React** and **Phaser**.

ブラウザで実行できる簡単なテトリス実装です。

> **Project status:** 開発再開に向けた現状、検証結果、優先課題は
> [プロジェクト現状調査](docs/current-status.md) を参照してください。
> Codex クラウドを主な開発環境にするための準備と運用方針は
> [Codex クラウド開発ガイド](docs/cloud-development.md) を参照してください。

## 開発方針と課題管理

このリポジトリはエージェント主導の開発実験です。ゲームルールとアーキテクチャを含め、既存にとらわれず自由に再設計してよい方針です。通常の仕様・設計判断はエージェントに任せます。

別セッションのgoalで開発を進める場合は、[管理Issue #21](https://github.com/tehutahu/codex_tetoris/issues/21) と `AGENTS.md` を最初に読み、対象Issueの完了条件と関連PRを確認してください。進捗はGitHub Issuesに集約します。下記のTODOは過去の候補であり、すべてを実装する義務はありません。

## 起動と検証

Node.js **20.19以上・21未満**（`.nvmrc` の Node 20）と npm を使います。再現可能な依存導入にはコミットされた `package-lock.json` を使用します。Windows PowerShell で実行ポリシーにより `npm` が拒否される場合は、以下の `npm` を `npm.cmd` に置き換えてください。

### 開発

リポジトリのルートで実行します。

```sh
npm ci
npm run dev
```

ブラウザで **http://127.0.0.1:5173** を開きます。1つのコマンドで Vite と Node サーバー（既定3000番）を起動し、`/socket.io` の HTTP/WebSocket 通信を Vite からサーバーへ転送します。5173番が使用済みの場合は別のポートへ移らずエラーで終了します。`Ctrl+C` で両プロセスを停止します。サーバーの `PORT` を変更した場合、開発 proxy も同じ値を使用します。

新しい Codex の Bash 環境では `bash scripts/codex-setup.sh` が Node の版確認・`npm ci`・本番ビルドを実行します。

### 本番ビルドと起動

```sh
npm ci
npm run build
npm start
```

ブラウザで **http://localhost:3000** を開きます。`npm start` は既に生成した `client/dist` を配信し、起動時の再ビルドは行いません。ソースを変更したら起動前に `npm run build` を実行します。

### テストとCI

```sh
npm test
npm run build
npm audit --audit-level=high
```

`npm test` は Node 組み込みのテストランナーを使用し、本番 `server.js` の静的ファイル配信・画面ルートのフォールバックと、2つの実 Socket.IO クライアント間の状態中継を検証します。テスト専用のローカルポートと一時静的ファイルを使うため、事前のビルドや手動サーバー起動は不要です。失敗は非0の終了コードになります。

GitHub Actions は PR と main 更新時に Ubuntu / Node 20 で依存導入・実テスト・本番ビルド・high以上の脆弱性監査を実行します。テストランナーの追加依存を避け、本番経路を直接検証できる構成を選びました。

### Docker（任意）

```sh
docker build -t codex_tetoris .
docker run --rm -p 3000:3000 codex_tetoris
```

http://localhost:3000 で、イメージ作成時にビルドした成果物を配信します。

### Multiplayer
1. Start the server using either of the methods above.
2. Open the development URL or `http://localhost:3000/index.html` in **two** browser windows or share the
   URL with another player on your network.
3. Each player's board is shown on the left, and the opponent's board appears on
   the right.
4. Play normally using the controls below. The server will relay states between
   connected clients in real time.

## Key Controls
- **Arrow Left / Right**: Move the piece sideways
- **Arrow Down**: Drop the piece faster
- **q / w**: Rotate the piece
- **Enter**: Restart after a game over



## TODO
- Implement attack mechanics between players
- Support "T-spin" moves and related scoring
- Add simple login and user management
- Create CPU opponents
- Enable matches with more than two players
