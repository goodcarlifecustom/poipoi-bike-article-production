# 06 WordPress下書き投稿ルール

`post_to_wp: true` の場合のみ `npm run post -- --slug {slug}` を実行する。`wordpress_draft` はcreate時に `post_to_wp` へ正規化される。

## 環境変数

`WP_REST_ROOT`、`WP_USERNAME`、`WP_APP_PASSWORD`、`WP_DEFAULT_STATUS` をプロセス環境変数から読む。`.env` は必須にせず、自動作成しない。`WP_DEFAULT_STATUS` が `draft` 以外なら停止する。

## 投稿前確認

1. REST APIルートへの匿名GET
2. WordPress認証確認
3. 投稿作成権限確認
4. publish/draft/pending/private/future の同一スラッグ重複確認
5. 品質チェック

同一スラッグが1件でもあれば停止し、既存投稿の更新・削除、別スラッグ投稿、publish/future投稿をしない。

## 投稿仕様

- エンドポイント: `POST {WP_REST_ROOT}/wp/v2/posts`
- payload: `title`、`content`、`slug`、`status: draft`
- content: `articles/{slug}/article-decorated.html`
- 通信はPython `urllib.request` と `ProxyHandler()` を使い、Codex環境のHTTP/HTTPSプロキシに対応する。

成功時だけ `metadata.json` の `wordpress_draft_id`、`wordpress_draft_url` と `wp-result.md` を更新する。
