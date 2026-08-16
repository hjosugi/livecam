# Contributing

バグ修正、アクセシビリティ改善、公式公開ソースの追加を歓迎します。

## 開発

```bash
npm install
npm run check
```

カタログ更新を含む変更では次も実行してください。

```bash
npm run sync:sources
npm run sync:check
```

生成された `public/data/cameras.json` に秘密情報、認証 URL、プライベート IP、無関係な差分がないことを確認してください。

## ソース追加

実装前に [Source proposal](https://github.com/hjosugi/livecam/issues/new?template=source.yml) で次を提示してください。

- 責任主体が分かる公式ホームページ
- API / 一覧 / 映像 URL
- 利用条件と必要な帰属表示
- カメラの目的とおおよその対象地域
- [データ収録ポリシー](docs/DATA_POLICY.md) を満たす根拠

公開性や再利用条件が曖昧な場合は、埋め込みではなく公式ポータルへのリンクとして提案してください。

## Pull request

- 1つの目的に絞る
- UI変更には desktop / mobile の確認結果を付ける
- 外部データを HTML として挿入しない
- Content Security Policy の接続先を広げる場合は理由と公開元の証拠を付ける
- `npm run check` の結果を記載する
