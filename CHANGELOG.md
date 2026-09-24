# Changelog

このプロジェクトは [Semantic Versioning](https://semver.org/) を使用します。

## [0.1.1] - 2026-09-24

### Security

- 開発依存の Vitest を 4.1.11 に更新（`@vitest/mocker` のリダイレクトモックを fs 許可リスト内に制限する修正 GHSA-82fw-gwwq-j7x9 を含む）。配信するサイトの動作に変更はありません

## [0.1.0] - 2026-08-16

### Added

- 5,373件の公式公開カメラ・ポータルカタログ
- 世界地図、検索、国/形式フィルター、お気に入り、現在地に近い順
- Caltrans HLS と更新画像、Fintraffic・DriveBC 道路画像の明示的な遅延読込
- カメラごとの共有 URL、公開元・利用条件・帰属表示
- モバイル対応、キーボード操作、reduced-motion 対応
- HTTPS・座標・重複・プライベートネットワークを検査するカタログゲート
- GitHub Actions CI と GitHub Pages 配信
