# プロジェクト現状調査（2026-10-04）

## 結論

現在のリポジトリには React + Phaser のテトリス本体と、Socket.IO で相手の画面を中継する最小構成がある。ただし、クリーンインストールからビルドできず、自動テストも実質的に動作していない。そのため、現状は「実装の原型はあるが、再現可能な開発・リリース基盤がない」段階と判断する。

Git 履歴上の最終変更は 2025-07-15 で、調査日時点で約 15 か月更新されていない。

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

調査は Node.js `v20.20.2` / npm `11.4.2` の Linux x64 環境で実施した。

| コマンド | 結果 | 意味 |
| --- | --- | --- |
| `npm ci` | 成功 | lockfile からの依存導入自体は完了する。 |
| `npm run build` | 失敗 | `@rollup/rollup-linux-x64-gnu` が lockfile/導入結果になく、Vite 起動前に停止する。 |
| `npm test` | 見かけ上成功 | `No tests specified` を表示するだけで、テストは 0 件。 |
| `npx --no-install jest --runInBand` | 失敗 | Jest が未導入のため、既存テストを実行できない。 |
| `npm audit --omit=dev` | 失敗 | 本番依存に high 5 件、moderate 4 件の脆弱性が報告された。 |

## 主な問題とリスク

### P0: まず開発の再現性を回復する

1. **Linux でビルド不能**  
   lockfile が Rollup の Linux x64 用 optional package を解決できていない。過去の Docker 対応は lockfile をコンテナにコピーしない回避策であり、ローカル/CI の `npm ci` を直していない。lockfile を対象環境で再生成し、`npm ci && npm run build` を通す必要がある。
2. **Phaser の外部化設定**  
   Vite は `phaser` を Rollup の `external` にしている一方、HTML に import map や CDN script がない。ビルド復旧後もブラウザが bare import を解決できない可能性が高いため、通常の bundle 対象に戻して E2E 確認する。
3. **検証の入り口が機能していない**  
   `npm test` を実際の test runner に接続し、必要な devDependencies を明示する。既存テストは本番の `server.js` や `client/dist` を使わず、独自に Express app を再実装しているため、サーバーの回帰検知には不十分。

### P1: 運用可能な最小品質にする

1. **脆弱な依存関係**  
   Express/Socket.IO 系の本番依存に high を含む 9 件が残っている。互換性を確認しつつ更新し、audit を CI に入れる。
2. **マルチプレイの境界がない**  
   全接続者への broadcast のため、3 人以上では複数人の状態が単一の「相手」表示を上書きする。ペア/ルームをサーバー側で管理する。
3. **クライアント入力を無検証で中継**  
   `state` のサイズ、形、頻度に制限がない。現状は各クライアントがほぼ毎フレーム全盤面を送信するため、schema validation、rate limit、差分または送信間隔の制御が必要。
4. **開発手順が不完全**  
   README の `npm run dev` は Vite だけを起動する。既定ポートも Vite は 5173、Express は 3000 であり、記載どおり `localhost:3000` でマルチプレイを開発できない。クライアント/サーバーを並行起動する script と手順が必要。

### P2: 機能と保守性を改善する

- ゲームロジックを Phaser/React/Socket.IO から分離し、行消去、回転、衝突、スコアを unit test 可能にする。
- 勝敗、切断、再接続、再戦の state machine を定義する。現在の表示ロジックで明示されるのは `GAME OVER` と、両者が game over の場合の `DRAW` だけである。
- 7-bag、next-piece UI、レベル/落下速度、標準的なスコアなど、「どのテトリス仕様を目指すか」を決めてから実装する。
- 未使用の旧 UI 用 CSS を整理し、タイトル、操作説明、スコア、接続状態を DOM とキャンバスのどちらで管理するか統一する。

## 再開ロードマップ案

1. **Baseline PR**: lockfile/Phaser bundle/開発 script を修正し、Linux のクリーン環境で build と起動を成功させる。
2. **Quality PR**: ロジック分離、有効な unit/integration test、GitHub Actions を追加する。
3. **Security PR**: 依存更新、Socket.IO payload validation/rate limit、ルーム制を導入する。
4. **Product PR**: 勝敗フローと切断/再戦 UX を完成し、その後に攻撃メカニクス等の TODO を優先順位付けする。

## 完了条件（最初のマイルストーン）

- Linux のクリーン環境で `npm ci && npm run build` が成功する。
- `npm test` が実際のテストを実行し、失敗を exit code で返す。
- 1 人プレイと 2 人接続をブラウザ E2E で確認できる。
- CI が build/test/audit を pull request ごとに実行する。
- README だけで新規参加者が開発環境を起動できる。
