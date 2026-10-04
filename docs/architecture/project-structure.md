# ファイルと実行経路

| 場所 | 役割 |
| --- | --- |
| `client/src/game.js` | ブラウザに依存しないゲーム規則と決定的な出現順 |
| `client/src/controller.js` | 入力、時間、一時停止、再開の制御 |
| `client/src/main.js` | DOM、Canvas、キーボードと画面ボタン |
| `client/src/styles.css` | 画面と狭いビューポートのレイアウト |
| `client/index.html` | 日本語UIの入口 |
| `client/vite.config.js` | 開発サーバーと静的ビルドの設定 |
| `client/dist/` | `npm run build` の生成物。Gitには保存しない |
| `server.js` | Node標準HTTPによる生成物の配信 |
| `tests/` | Node標準テストランナーによる規則・配信の回帰テスト |
| `scripts/browser-smoke.mjs` | 実ブラウザでの操作と終了・再開の受け入れ検証 |
| `.github/workflows/` | Linux/Node 20でのクリーン検証 |

開発は `npm run dev`、配布用成果物は `npm run build`、ビルド済み成果物のローカル配信は `npm start` を使います。起動時に再ビルドしません。サーバーはゲーム状態を持たず、対戦用の接続も作りません。

本番のゲームに追加ライブラリは不要です。ViteとPlaywrightは開発・検証用です。Nodeのバージョンは `.nvmrc`、npmの依存関係は `package-lock.json` を正本とします。