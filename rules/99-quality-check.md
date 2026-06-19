# 99 品質チェックルール

`npm run check -- --slug {slug}` で、3項目入力ワークフローの成果物を検証する。

必須ファイル: `input.yml`、`metadata.json`、`research.md`、`serp.md`、`headings.csv`、`heading-analysis.md`、`heading-plan.md`、`draft.md`、`article.html`、`article-linked.html`、`article-decorated.html`、`external-links.md`。

主な検証項目:

- `main_keyword`、配列の `related_keywords`、booleanの `post_to_wp` がある。
- `metadata.json` の `title`、`slug`、`meta_description`、`search_intent`、`persona`、`article_type`、`target_word_count` が null/空/auto ではない。
- `status` は `draft`。
- `article.html`、`article-linked.html`、`article-decorated.html` が空ではなくH1を含まない。
- タイトル、スラッグ、キーワードがファイル間で一致する。
- 本文文字数が目標文字数から大きく外れていない。
- 外部URLのベタ書き、空aタグ、存在しない内部アンカー、秘密情報、コミット対象の `.env` がない。
- `post_to_wp:false` ならWordPress環境変数を要求しない。`true` なら投稿前条件を確認する。
