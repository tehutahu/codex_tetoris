# codex_tetoris
A simple Tetris implementation that now uses **React** and **Phaser**.

ブラウザで実行できる簡単なテトリス実装です。

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
