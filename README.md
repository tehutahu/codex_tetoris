# codex_tetoris
A simple Tetris implementation that runs directly in your browser.

ブラウザで実行できる簡単なテトリス実装です。

## How to Run

### Local Server
1. Install dependencies and start the Node.js server:
   ```
   npm install
   npm start
   ```
2. Open `http://localhost:3000/index.html` in your web browser.

### Docker
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


