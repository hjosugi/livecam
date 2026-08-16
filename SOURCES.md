# データソースと帰属表示

カタログ内の各項目にも公開元、原典 URL、利用条件 URL、帰属表示を保持しています。映像や画像はこのリポジトリへ複製せず、利用者が選択した時だけ公開元から直接取得します。

## 直接統合

### Fintraffic / Digitraffic

- 内容: フィンランドの道路気象カメラ位置と更新画像
- API: <https://tie.digitraffic.fi/api/weathercam/v1/stations>
- ドキュメント: <https://www.digitraffic.fi/en/road-traffic/>
- 利用条件: <https://www.digitraffic.fi/en/terms-of-service/>
- 帰属表示: `Source: Fintraffic / digitraffic.fi, license CC BY 4.0`
- 実装上の配慮: `Digitraffic-User`、gzip、タイムアウトを使用。画像は自動巡回せず、選択時だけ読み込む。

### California Department of Transportation (Caltrans)

- 内容: California 全12地区の CCTV 位置、更新画像、一部 HLS URL
- ドキュメント: <https://cwwp2.dot.ca.gov/documentation/cctv/cctv.htm>
- 利用条件: <https://cwwp2.dot.ca.gov/documentation/conditions.htm>
- 帰属表示: `Source: California Department of Transportation, District N`
- 実装上の配慮: 公式 JSON の URL を参照し、画像・映像は保存しない。利用者の操作前には取得しない。

### Province of British Columbia / DriveBC

- 内容: British Columbia の HighwayCam 位置と更新画像
- データセット: <https://open.canada.ca/data/en/dataset/6b39a910-6c77-476f-ac96-7b4f18849b1c>
- 公式カメラ一覧: <https://www.drivebc.ca/cameras>
- 利用条件: <https://www2.gov.bc.ca/gov/content/data/open-data/open-government-license-bc>
- 帰属表示: `Source: Province of British Columbia / DriveBC, Open Government Licence - British Columbia`
- 実装上の配慮: 月次公開 CSV から位置と画像 URL だけを取得。画像は利用者が選択した時だけ読み込む。

## 公式ポータル

以下は国・地域を代表する位置に一つのディレクトリ項目を置き、公式サイトへリンクします。映像・画像データは取り込みません。

- 国土交通省「全国のライブカメラ」: <https://www.mlit.go.jp/road/bosai/LIVEcamera.html>
- Province of British Columbia / DriveBC: <https://www.drivebc.ca/cameras>
- Oregon DOT / TripCheck: <https://tripcheck.com/>
- Traffic Scotland: <https://www.traffic.gov.scot/traffic-cameras>
- NZ Transport Agency Waka Kotahi: <https://www.journeys.nzta.govt.nz/traffic-cameras>
- Statens vegvesen: <https://www.vegvesen.no/trafikk/#/kamera>
- Icelandic Road and Coastal Administration: <https://umferdin.is/en/cameras>

## 地図

- 地図データ・標準タイル: © OpenStreetMap contributors
- 著作権とライセンス: <https://www.openstreetmap.org/copyright>
- タイル利用ポリシー: <https://operations.osmfoundation.org/policies/tiles/>

標準タイルは画面内で利用者が表示する範囲だけをブラウザから取得します。事前取得、スクレイピング、オフライン保存、キャッシュ回避は実装しません。サービス規模が大きくなった場合は、利用条件と容量保証を備えたタイル提供者またはセルフホストへ移行します。

## 追加・削除

追加候補は [docs/DATA_POLICY.md](docs/DATA_POLICY.md) の全条件を満たす必要があります。公開停止、利用条件変更、誤位置、プライバシー上の懸念は [Content report](https://github.com/hjosugi/livecam/issues/new?template=report.yml) で報告してください。
