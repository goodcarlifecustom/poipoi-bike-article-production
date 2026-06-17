# 04 SWELL装飾ルール

## 目的

バイク買取MAX（`https://poi-poi.co.jp/bike/`）向けの記事を、WordPressテーマSWELLで読みやすい本文HTMLにする。入力は `article-linked.html`、出力は `article-decorated.html` とする。

## 使用する装飾

- 注意喚起: `wp-block-group` と `is-style-alert` 相当のクラスを使う
- 比較表: `wp-block-table`
- CTA: `wp-block-buttons` と `wp-block-button`
- 箇条書き: 標準の `ul` / `ol`

## CTA方針

- バイク買取MAXへの相談・査定導線を自然に配置する
- 査定依頼、無料出張査定、バイク売却相談への導線として自然に配置する
- 過度な煽りや保証表現は使わない

## 出力

`articles/{slug}/article-decorated.html` に保存する。WordPress下書き投稿に使う本文ファイルもこのファイルに統一する。
