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

## How to Run

### Local Development
1. Install dependencies and start the development server:
   ```
   npm install
   npm run dev
   ```
2. Open `http://localhost:3000` in your web browser.

### Build and Run
1. Build the client application:
   ```
   npm run build
   ```
2. Start the Node.js server:
   ```
   npm start
   ```

### Docker (optional)
1. Build the container:
   ```
   docker build -t codex_tetoris .
   ```
2. Run the container:
   ```
   docker run -p 3000:3000 codex_tetoris
   ```

### Multiplayer
1. Start the server using either of the methods above.
2. Open `http://localhost:3000/index.html` in **two** browser windows or share the
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
