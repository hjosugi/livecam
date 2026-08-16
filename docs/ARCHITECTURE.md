# アーキテクチャ

## 全体像

```text
official JSON APIs ──sync-cameras.mjs──> public/data/cameras.json
                                                │
                                                ▼
browser ──fetch same-origin JSON──> filter/search/map UI
   │
   ├─ user clicks Load ──> provider image or HLS URL
   └─ visible viewport ──> OpenStreetMap standard tiles
```

サーバー、データベース、認証、API キーを必要としない静的構成です。GitHub Pages はビルド済み HTML/CSS/JavaScript とカタログだけを配信します。

Pages ビルドは `build-info.json` に version、完全な commit SHA、カタログ生成時刻・件数を出力します。公開後は `npm run verify:public -- URL SHA VERSION` が HTML、provenance、カタログをキャッシュ回避付きで読み戻します。

## 信頼境界

1. `scripts/sync-cameras.mjs` は許可した公式 HTTPS API だけへ接続します。
2. `scripts/validate-catalog.mjs` は ID 重複、座標範囲、URL 構文、HTTPS、資格情報、localhost・プライベートアドレス、直接統合ごとのホスト allowlist を検査します。
3. 画面表示では外部データを `textContent` で挿入し、カタログ由来の HTML を実行しません。
4. Content Security Policy は接続先を現在の公式メディアホストと地図タイルへ限定します。
5. 外部メディアは opt-in。初期表示・検索・地図操作だけではカメラ公開元へ接続しません。

## データモデル

`public/data/cameras.json` は schema version 1 です。

- `media.kind`: `hls`、`image`、`portal`
- `source`: 公開元名、原典、利用条件、帰属表示
- `observedAt`: 公開元メタデータの時刻。カメラの稼働保証ではない
- portal 項目の座標: 個別カメラ位置ではなく、国・地域を代表する地図上の案内位置

## スケーリング

約4千地点は Leaflet の Canvas renderer で描画します。リスト DOM は最初の60件だけを生成し、段階的に追加します。HLS 実装は選択時の dynamic import で初期 JavaScript から分離します。

今後カタログが数万件を超える場合は、次の順で進めます。

1. カタログを地域別に分割
2. ビューポート単位の読み込み
3. Web Worker で検索インデックス生成
4. OSM 標準タイルから容量保証付き提供者またはセルフホストへ移行
