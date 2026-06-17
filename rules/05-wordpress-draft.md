# 05 WordPress下書き投稿ルール

## 目的

WordPress REST APIを使い、バイク買取MAX（`https://poi-poi.co.jp/bike/`）の記事本文として `articles/{slug}/article-decorated.html` を下書き投稿する。

## 実行条件

- Codex Cloudのタスク詳細で `post_to_wp: true` の場合のみ投稿工程へ進む
- `post_to_wp` の初期推奨値は `false`
- WordPress下書き投稿まで進めたい場合のみ `post_to_wp: true` を指定する
- `post_to_wp: false` または未指定の場合は、品質チェックまでで止める
- どちらの場合も `article-decorated.html` までは作成する

## 絶対条件

- 投稿ステータスは必ず `draft`
- 公開状態で投稿しない
- WordPress投稿本文は必ず `articles/{slug}/article-decorated.html` を使う
- `.env` の `WP_DEFAULT_STATUS` も `draft` にする
- 送信payloadも必ず `status: "draft"` に固定する
- `article-decorated.html` が存在しない、空、またはHTMLタグを除いた本文500文字未満の場合は投稿を停止し、`check-report.md` に原因を記録する
- WordPress Application Password は `.env` で管理し、コミットしない

## 投稿エンドポイント

`WP_REST_ROOT + wp/v2/posts`

## 実行

```bash
npm run post -- --slug {slug}
```

## 出力

投稿成功後、`articles/{slug}/wp-result.md` に以下を保存する。

- 投稿ID
- 編集URL
- 確認URL
- status
- 投稿前本文文字数
- 投稿後本文文字数
