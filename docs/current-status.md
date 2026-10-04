# プロジェクト現状調査（2026-10-04）

> この文書は2026-10-04の調査記録です。現在の開発方針・着手順・進捗は [管理Issue #21](https://github.com/tehutahu/codex_tetoris/issues/21) と各実装Issueを参照してください。以下のロードマップや旧機能候補は仕様の拘束ではありません。ゲームルールとアーキテクチャはエージェントが自由に選び直せます。

## 結論

現在のリポジトリには React + Phaser のテトリス本体と、Socket.IO で相手の画面を中継する最小構成がある。クリーンインストールとプロダクションビルドは再現可能になったが、自動テストはまだ実質的に動作していない。そのため、現状は「開発基盤の再構築に着手した原型」の段階と判断する。

開発再開前の最終変更は 2025-07-15 だった。2026-10-04 に現状調査（PR #15）を main に取り込み、この PR で開発環境の再現性を整備した。

## 確認できた構成

| 領域 | 現状 |
| --- | --- |
| クライアント | React 18 + Phaser 3 + Vite。ゲームロジックと Phaser Scene は `client/src/Game.jsx` の単一ファイルに集約。 |
| サーバー | Express でビルド済み SPA を配信し、Socket.IO の `state` を他クライアント全員へ broadcast。 |
| マルチプレイ | 相手ボードの状態表示のみ。マッチング、ルーム、攻撃、認証、切断処理はない。 |
| テスト | `tests/server.test.js` はあるが、`npm test` はテストを実行せず成功終了する。Jest/Supertest も直接依存関係に宣言されていない。 |
| CI/CD | GitHub Actions 等の CI 設定はない。Dockerfile はあるが、検証はビルド問題の解決後に必要。 |
| ドキュメント | README とアーキテクチャ文書はあるが、実際の開発手順と一部乖離している。 |

## 検証結果

以下は PR 作成時に Node.js `v20.20.2` / npm `11.4.2` の Linux x64 環境で実施した検証結果。初期調査（PR #15）では build が失敗し、本番依存に 9 件の脆弱性があったが、この PR の lockfile 再生成後に以下の結果となった。

| コマンド | 結果 | 意味 |
| --- | --- | --- |
| `npm ci` | 成功 | lockfile からの依存導入自体は完了する。 |
| `npm run build` | 成功 | lockfile 再生成と Phaser の bundle 対象化後、Vite の production build が成功する。 |
| `npm test` | 見かけ上成功 | `No tests specified` を表示するだけで、テストは 0 件。 |
| `npx --no-install jest --runInBand` | 失敗 | Jest が未導入のため、既存テストを実行できない。 |
| `npm audit --omit=dev` | 成功 | lockfile 再生成後の本番依存で既知の脆弱性は 0 件。 |

### コンフリクト解消時の再検証（2026-10-04）

Windows x64 / Node.js `v20.20.2` / npm `11.6.2` で `npm ci`、`npm run build`、`npm audit --omit=dev` が成功し、本番依存の既知の脆弱性は 0 件だった。`npm test` も終了コード 0 だが、実際のテストは 0 件。

ビルド成果物を `server.js` で配信し、Playwright の Chromium で盤面と落下するテトリミノの描画を確認した。ブラウザの console error / warning は 0 件。2 人対戦の操作確認は未実施。Docker はデーモンが起動していないため、イメージビルドは未検証。ビルドでは 500 kB を超える bundle の警告が残る。

## 主な問題とリスク

### P0: まず開発の再現性を回復する

1. **検証の入り口が機能していない**
   `npm test` を実際の test runner に接続し、必要な devDependencies を明示する。既存テストは本番の `server.js` や `client/dist` を使わず、独自に Express app を再実装しているため、サーバーの回帰検知には不十分。

### P1: 運用可能な最小品質にする

1. **マルチプレイの境界がない**
   全接続者への broadcast のため、3 人以上では複数人の状態が単一の「相手」表示を上書きする。ペア/ルームをサーバー側で管理する。
2. **クライアント入力を無検証で中継**
   `state` のサイズ、形、頻度に制限がない。現状は各クライアントがほぼ毎フレーム全盤面を送信するため、schema validation、rate limit、差分または送信間隔の制御が必要。
3. **開発手順が不完全**
   README の `npm run dev` は Vite だけを起動する。既定ポートも Vite は 5173、Express は 3000 であり、記載どおり `localhost:3000` でマルチプレイを開発できない。クライアント/サーバーを並行起動する script と手順が必要。

### P2: 機能と保守性を改善する

- ゲームロジックを Phaser/React/Socket.IO から分離し、行消去、回転、衝突、スコアを unit test 可能にする。
- 勝敗、切断、再接続、再戦の state machine を定義する。現在の表示ロジックで明示されるのは `GAME OVER` と、両者が game over の場合の `DRAW` だけである。
- 7-bag、next-piece UI、レベル/落下速度、標準的なスコアなど、「どのテトリス仕様を目指すか」を決めてから実装する。
- 未使用の旧 UI 用 CSS を整理し、タイトル、操作説明、スコア、接続状態を DOM とキャンバスのどちらで管理するか統一する。

## 再開ロードマップ案

1. **Baseline PR（完了）**: lockfile/Phaser bundle/Codex setup script を修正し、Linux のクリーン環境で install と build を成功させる。
2. **Quality PR**: ロジック分離、有効な unit/integration test、GitHub Actions を追加する。
3. **Security PR**: 依存更新、Socket.IO payload validation/rate limit、ルーム制を導入する。
4. **Product PR**: 勝敗フローと切断/再戦 UX を完成し、その後に攻撃メカニクス等の TODO を優先順位付けする。

## 完了条件（最初のマイルストーン）

- Linux のクリーン環境で `npm ci && npm run build` が成功する。
- `npm test` が実際のテストを実行し、失敗を exit code で返す。
- 1 人プレイと 2 人接続をブラウザ E2E で確認できる。
- CI が build/test/audit を pull request ごとに実行する。
- README だけで新規参加者が開発環境を起動できる。
