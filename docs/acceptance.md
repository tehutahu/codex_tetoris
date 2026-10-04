# 受け入れ検証

検証日: 2026-10-04。仕様は [ゲーム設計](game-design.md)、オンライン機能を採用しない理由は [オフライン判断](offline-decision.md)、起動手順は [README](../README.md) を参照してください。進捗の正本はGitHub Issuesと関連PRです。

## 再現コマンド

Node 20.19以上の20系とnpmを使用します。

```sh
npm ci
npm test
npm run build
npm audit --audit-level=high
npx playwright install chromium
npm run test:browser
```

Ubuntu CIは `bash scripts/codex-setup.sh` でクリーン導入とビルドを行い、`npm test`、全依存監査、`npx playwright install --with-deps chromium`、本番ビルドのブラウザ検証を実行します。`output/playwright/` を `browser-acceptance` artifactに保存します。CI実行結果は関連PRから確認できます。

Windowsの今回の実行環境では標準のnpm.cmdが同梱Node 24を優先したため、Node 20.20.2の実行ファイルからnpm-cli.jsを起動し、子プロセスのPATHにもNode 20を前置して同じnpmコマンドを実行しました。この個人用キャッシュパスはプロジェクトの再現条件には含めません。

## ブラウザ検証の意味

`scripts/sprint-plan.mjs` は本番の純粋な規則モジュールから、同じseedで合法な移動・回転・ハードドロップの操作列を生成します。`scripts/browser-smoke.mjs` はビルド済み成果物を本番のHTTP factoryで一時ポートへ配信し、Chromiumの実キー入力でその操作列を送ります。表示ライン数と得点を各配置で照合します。盤面の直接変更、URLから状態を書き換えるdebug機能、別実装のゲームは使いません。

重力の混入を避ける操作列の段階では [Playwright Clock](https://playwright.dev/docs/clock) で時間を止めます。別段階で時計を進め、重力・進行中の時間表示・停止中の時計を確認します。完走段階のゼロ秒表示はテスト時計によるもので、人間の達成記録ではありません。

ヘッドレスの新しいタブはデスクトップのフォーカス喪失を再現しなかったため、blurイベントを明示して本番listenerによる一時停止を検証します。これは実際のOS上でのウィンドウ切り替えの受け入れ結果とは区別します。

回転は、初手の回転しても変わらないOを固定して次のSで描画の変化を確認します。左右の回転・移動、画面の6操作ボタン、ソフトドロップの加点には結果のアサーションを設けています。

## 最終構成の実測結果

Windows / Node 20.20.2 / Chromium 153.0.8010.12で、標準HTTPへ置き換えた統合構成を確認しました。

| 検証 | 結果 |
| --- | --- |
| `npm ci` | lockfileからクリーン導入成功 |
| `npm test` | 32テスト成功、失敗・skipなし。ゲーム規則・controllerと配信10テスト |
| `npm run build` | 成功。JS 14.32kB（gzip 5.84kB）、CSS 8.35kB（gzip 2.50kB）、chunk警告なし |
| `npm audit --audit-level=high` | 開発依存を含め脆弱性0件 |
| 本番依存 | root/clientとも空。ViteとPlaywrightは開発用 |
| `npm run test:browser` | 本番HTTP上のChromiumで全確認成功 |
| seed `acceptance-20` の完走 | 52個配置、20ライン、3950点でクリア |
| 中央への積み上げ | 10個でゲーム終了。クリア・ゲーム終了の両方から再開成功 |
| console/runtime error・外部request・asset失敗 | 各0件 |

ゲームと配信のPR #24/#25のUbuntu / Node 20 CIは成功しています。最終PRは初期セットアップとChromium受け入れを同じクリーンCIへ接続します。スクリーンショットは `desktop.png`、`line-clear.png`、`won.png`、`mobile.png`、結果は `report.json` に保存します。

## 確認した範囲

- 起動、左右移動・回転、ソフト／ハードドロップ、自然落下、NEXT描画。
- プレイ中の時間表示、ポーズ中の時間・盤面・入力停止、blur listenerの停止。
- 行消去、20ライン達成、達成後の入力停止、ゲームオーバー、両終了状態からの再開。
- 1440×1000と390×844のレイアウト、390px幅での横方向のはみ出しなし、画面ボタン。
- 初回取得後に通信を止めた状態での再開と操作。外部ランタイムリクエスト・console/runtime error・asset失敗なし。
- HTTPのGET/HEAD、MIME、未存在asset、未知ルート、旧Socket.IO経路、405、不正URL、配信範囲の境界。

## 採用しない配布方法と未検証範囲

Dockerは廃止し、クリーンなLinux CIとNode/npmによる静的成果物の配信を採用しました。コンテナデーモンやイメージを必須にする必要がないためです。Dockerの実ビルド・公開デプロイは完成条件に含めません。

実スマートフォンのタッチ入力、Safari、Firefox、OSのウィンドウ切り替え、ネット切断後の新規起動は未検証です。PWA、対戦、ランキング、記録保存は採用していません。モバイル幅とブラウザのポインター操作の成功を、実端末のタッチ確認として扱いません。