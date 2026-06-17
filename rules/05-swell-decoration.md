# 04 SWELL装飾ルール

## 目的

WordPressテーマSWELLで読みやすい本文HTMLを作成する。入力は `article-linked.html`、出力は `article-decorated.html` とする。

## 使用する装飾

- 注意喚起: `wp-block-group` と `is-style-alert` 相当のクラスを使う
- 比較表: `wp-block-table`
- CTA: `wp-block-buttons` と `wp-block-button`
- 箇条書き: 標準の `ul` / `ol`

## CTA方針

- バイク買取MAXへの相談・査定導線を自然に配置する
- 過度な煽りや保証表現は使わない

## H1禁止

WordPress投稿タイトルがH1として表示される前提のため、本文HTML内にH1は入れないでください。

- article-decorated.html に `<h1>` を含めない
- 記事タイトルはWordPress投稿タイトルとして扱う
- 本文の見出しは `<h2>` から開始する
- `<h1>` が必要に見える場合でも、本文側では `<h2>` に変換する

## 出力

`articles/{slug}/article-decorated.html` に保存する。WordPress下書き投稿に使う本文ファイルもこのファイルに統一する。
