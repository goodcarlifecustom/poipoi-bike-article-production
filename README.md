# バイク買取MAX 新規記事作成ワークフロー

Codexに `main_keyword`、`related_keywords`、`wordpress_draft` の3項目を渡すだけで、SEO記事ファイル作成から、必要な場合のみWordPress下書き投稿まで進めるためのワークフローです。

対象メディア: https://poi-poi.co.jp/bike/

## 最小入力項目

- `main_keyword`: メインキーワード。必須。
- `related_keywords`: 関連キーワード。YAML配列またはカンマ区切り文字列。必須。
- `wordpress_draft`: WordPress下書き投稿まで行うか。省略時は `false`。

`wordpress_draft: true` は内部で `post_to_wp: true` に正規化されます。既存互換の `post_to_wp` も読めますが、両方がある場合は `wordpress_draft` を優先します。

## 任意の上書き項目

`title`、`slug`、`target_word_count`、`category`、`target_media`、`reference_urls`、`notes` は任意です。通常は入力不要で、Codexがキーワード分析と調査に基づいて自動生成します。

## 記事ファイルだけ作成

```yaml
main_keyword:
ネオクラシックバイク おすすめ

related_keywords:
ネオクラシックバイク 初心者, ネオクラシックバイク 400cc, ネオクラシックバイク 比較

wordpress_draft:
false
```

## WordPress下書きまで作成

```yaml
main_keyword:
CTN バイク買取 評判

related_keywords:
CTN バイク買取 口コミ, CTN バイク買取 査定, CTN バイク買取 一括査定

wordpress_draft:
true
```

## npmコマンド

```bash
npm run create -- --input jobs/sample-new-article.yml
npm run create -- --main-keyword "CTN バイク買取 評判" --related-keywords "CTN バイク買取 口コミ,CTN バイク買取 査定" --wordpress-draft true
npm run extract -- --slug ctn-bike-kaitori-reviews
npm test
npm run check -- --slug ctn-bike-kaitori-reviews
npm run post -- --slug ctn-bike-kaitori-reviews
```

`npm run post` は `post_to_wp: true` の場合だけ実行されます。`post_to_wp:false` の記事ではWordPress環境変数を要求せず、ネットワーク接続もしません。

## 出力ファイルの役割

- `input.yml`: 正規化済み入力。`status: draft` と固定の `target_media` を含む。
- `metadata.json`: タイトル、スラッグ、メタディスクリプション、検索意図、WordPress下書きID/URLなどの機械可読メタデータ。
- `research.md`: キーワード分析、競合調査、一次情報、選定基準、リンク一覧、未確認事項。
- `serp.md`: 検索クエリ、参考URL、除外URL、抽出見出し概要。
- `headings.csv`: 競合ページのH2/H3抽出結果。
- `heading-analysis.md`: 共通論点、採用/不採用理由、見出し構成根拠。
- `heading-plan.md`: H2/H3/H4のみのHTML見出し構成。H1は禁止。
- `draft.md`: Markdown本文。
- `article.html`: WordPressブロックエディタで扱いやすい本文HTML。H1は禁止。
- `article-linked.html`: 外部リンク追加後の本文HTML。
- `article-decorated.html`: SWELL装飾後の本文HTML。WordPress投稿対象。
- `external-links.md`: 外部リンク候補、採用理由、確認日。
- `check-report.md`: 品質チェック結果。
- `wp-result.md`: WordPress下書き投稿成功時の結果。

## WordPress投稿の安全条件

WordPress投稿は必ず `draft` です。環境変数 `WP_REST_ROOT`、`WP_USERNAME`、`WP_APP_PASSWORD`、`WP_DEFAULT_STATUS=draft` をプロセス環境変数から読み、`.env` は必須にしません。投稿前にRESTルートGET、認証確認、作成権限確認、同一スラッグ重複確認、品質チェックを行います。既存投稿の更新・削除、別スラッグ投稿、公開投稿は行いません。
