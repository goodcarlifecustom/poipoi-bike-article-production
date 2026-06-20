# 05 SWELL・Gutenberg装飾

新規記事では `decoration.json` を作成し、`npm run decorate -- --slug <slug>` で `article-linked.html`（なければ `article.html`）から `article-decorated.html` を生成する。

- H2に安定したIDを付与し、最初のH2直前に「この記事でわかること」をcapboxで追加する。
- H3が3個以上あるH2では、H2直下の導入文直後にH3アンカーリストをcapboxで追加する。
- 通常ulは `decoration.json` の `list_boxes` で指定されたものだけcapbox化する。仮タイトルは禁止。
- `markers` で指定した本文内の一意な文字列にpositive/negativeマーカーを適用する。空markは禁止。
- 装飾後は `npm run check:decoration -- --slug <slug>` を実行し、PASSしない場合はWordPressへ投稿しない。
