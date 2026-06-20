# 品質チェックレポート

- slug: bike-kaitori
- result: PASS

## 詳細

- OK: input.yml を確認しました
- OK: metadata.json を確認しました
- OK: research.md を確認しました
- OK: serp.md を確認しました
- OK: headings.csv を確認しました
- OK: heading-analysis.md を確認しました
- OK: heading-plan.md を確認しました
- OK: draft.md を確認しました
- OK: article.html を確認しました
- OK: article-linked.html を確認しました
- OK: article-decorated.html を確認しました
- OK: external-links.md を確認しました
- OK: metadata.json は有効なJSONです
- OK: research.md は空ではありません
- OK: main_keyword を確認しました
- OK: related_keywords 配列を確認しました
- OK: title は生成済みです
- OK: slug は生成済みです
- OK: meta_description は生成済みです
- OK: search_intent は生成済みです
- OK: persona は生成済みです
- OK: article_type は生成済みです
- OK: target_word_count は生成済みです
- OK: status: draft を確認しました
- OK: post_to_wp はbooleanです
- OK: slug は一致しています
- OK: メインキーワードは一致しています
- OK: article.html にH1はありません
- OK: article-linked.html にH1はありません
- OK: article-decorated.html にH1はありません
- OK: 本文文字数は目標から大きく外れていません
- OK: 外部URLのベタ書きは検出されません
- OK: .env はコミット対象ではありません
- OK: 認証情報・nonceの残存は検出されませんでした

## WordPress投稿確認

- result: FAIL
- command: npm run post -- --slug bike-kaitori
- reason: WordPress REST APIへのPOSTリクエストがタイムアウトしたため、下書き作成完了を確認できなかった。
- next_action: WordPress管理画面またはREST APIで同一スラッグの投稿有無を確認し、未作成であることを確認してから再実行する。
