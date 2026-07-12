# 06 WordPress下書き投稿ルール

`post_to_wp: true` かつ `metadata.status: draft` の場合のみ、通常の新規記事完了処理では `npm run check -- --slug {slug}` のPASS後に `npm run check:decoration`、`npm run wp:doctor`、`npm run wp:draft -- --slug {slug} --confirm` を自動実行する。`npm run finish -- --slug {slug}` も同じ完了処理を実行する。個別実行時も明示確認付きで `npm run wp:draft -- --slug {slug} --confirm` を実行する。公開、予約、private、pending への変更は禁止し、送信payloadの `status` はコード上で常に `draft` に固定する。

## 1実行1記事・1下書き

1回の依頼・実行で扱えるのは、1記事、1 articleディレクトリ、1つの `approved_outline.json`、1つのメインキーワード、WordPressへの新規POST 1回、WordPress下書き1件だけとする。複数メインキーワード、複数approved_outline、複数の記事生成単位、一括生成指示、複数ディレクトリ作成が必要な入力を構造化入力上で検出した場合は、記事を作らず `MULTIPLE_ARTICLE_INPUT` で停止する。`related_keywords` が複数ある場合、1記事内で複数車種を比較・紹介する場合、見出しや本文で複数車種名を扱う場合、`source_plan` やURLが複数ある場合は複数記事入力とは判定しない。2件目の記事・ディレクトリ・WordPress POSTを実行しようとした場合は、処理前に `MULTIPLE_ARTICLE_OUTPUT_BLOCKED` で停止する。

別のユーザー依頼・別実行であれば、同じ `base_slug`、メインキーワード、タイトルの過去記事があっても停止しない。既存記事や過去の下書きは更新せず、`base_slug`、`base_slug-new`、`base_slug-new-2`、`base_slug-new-3` の順で空いている `final_slug` を1つだけ決定し、その名前の新規 `articles/{final_slug}/` を作成する。

WordPress下書き作成直前にも、WordPress APIで `publish`、`future`、`draft`、`pending`、`private` の同一slugを確認する。同一slugが見つかっても停止せず、同じ連番規則で次の空きslugを1つだけ選び、新規作成用エンドポイントへ1回だけPOSTする。

## 認証と安全ルール

WordPress Application Passwordを使用し、通常のログインパスワードを保存・記録しない。`.env` はGit管理しない。Authorizationヘッダー、Application Password、nonce、認証情報をmetadata、wp-result、check-report、ログ、fixtureへ出力しない。

書き込み前に必要に応じて `npm run wp:doctor` を実行し、次を確認する。

1. `WP_SITE_URL` と `/wp-json/` に接続できる
2. Application Passwordで `wp/v2/users/me?context=edit` を取得できる
3. `wp/v2/posts` エンドポイントへ認証付きでアクセスできる

`wp:draft` は書き込み前に以下を実行し、失敗時はWordPress APIへ書き込みリクエストを送らない。

1. `npm run check -- --slug {slug}`
2. `npm run check:decoration -- --slug {slug}`

投稿元は必ず `articles/{slug}/article-decorated.html` とし、`article.html`、`article-linked.html`、`draft.md` へフォールバックしない。

## 投稿方式

既存の公開記事、下書き、保留記事、非公開記事、予約記事は更新・削除しない。`--adopt-existing` は禁止する。WordPressへの `PUT`、`PATCH`、`DELETE` と、既存投稿IDへの更新POSTは禁止する。毎回 `POST {WP_SITE_URL}/wp-json/wp/v2/posts` で新規下書きを1件だけ作成する。

- payload: `title`、`slug`、`content`、`status: draft`
- title: `metadata.title`
- slug: `metadata.final_slug`（互換のため `metadata.slug` も同じ値にする）
- content: `articles/{slug}/article-decorated.html` からfront matterを除去したGutenbergブロックマークアップ全文

WordPress REST APIへ送信する `content` にfront matter、作業ログ、metadata、Markdown原稿、`rendered.html` 相当のレンダリング済みHTMLを混入させない。送信前にGutenbergブロックコメントの対応、H2/H3構造、目次禁止ルール、重複ID、missing target、Markdown構文残存、H1混入、タイトル重複を検証する。

投稿後は `context=edit` で再取得し、ID、status、slug、title.raw、content.raw、H2/H3順序、table件数、id属性、SWELLブロックコメント、class属性、marker/mark、外部リンクhrefを検証する。改行コード差以外の本文改変は `CONTENT_MISMATCH` として失敗扱いにする。

成功時はREST再取得結果をもとに `metadata.json` をatomic renameで更新し、`generation_number`、`base_slug`、`requested_slug`、WordPressから返された実際の `final_slug`、`slug_collision_detected`、`article_count`、`wordpress_post_count`、`wordpress_draft_id`、`wordpress_draft_url`、`status: draft`、`wordpress_status: draft`、`wordpress_last_synced_at`、`wordpress_content_sha256` を保存する。`wp-result.md` には実行日時、created、投稿ID、編集URL、status、title、slug、投稿元ファイル、SHA-256、本文検証、SEOメタディスクリプション結果、投稿前チェック結果、警告、エラーを記録する。

`npm run wp:draft -- --slug {slug} --dry-run` はmetadata、投稿元、投稿前チェック、title、slug、status、content SHA-256、新規作成判定に必要な情報、必須環境変数名を表示する。WordPressへの作成リクエスト、metadata更新、wp-result更新は行わない。
