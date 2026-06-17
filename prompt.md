# バイク買取MAX 新規記事作成プロンプト

Codex Cloudのタスク詳細に入力されたYAMLをもとに、以下の順番で作業してください。

## 入力項目

基本入力（通常はこの3項目だけで実行できます）:

- `main_keyword`（既存互換で `keyword` も可。優先順位は `main_keyword > keyword`）
- `title`
- `target_word_count`

任意:

- `slug`（未指定なら `main_keyword` または `keyword` から自動生成）
- `category`（未指定なら `バイク買取`）
- `target_media`（未指定なら `https://poi-poi.co.jp/bike/`）
- `notes`
- `reference_urls`
- `post_to_wp`（未指定なら必ず `false`）

## 実行手順

1. `npm run create -- --main_keyword "{main_keyword}" --title "{title}" --target_word_count {target_word_count}` を実行し、`articles/{slug}/` を作成する。`slug` が入力されている場合のみ `--slug {slug}` を付ける
2. 入力YAMLと補完値を `articles/{slug}/input.yml` に保存する
3. `rules/01-heading-research.md` に従い、見出し調査を行って `serp.md`、`headings.csv`、`heading-analysis.md` を作成する
4. `rules/02-heading-plan-generation.md` に従い、`heading-analysis.md` を補強し、HTMLタグのみの `heading-plan.md` を作成する
5. `rules/03-article-generation.md` に従い、`target_word_count` を目標文字数として `draft.md` と `article.html` を作成する
6. `rules/04-external-links.md` に従い、外部リンクを追加した `article-linked.html` と `external-links.md` を作成する
7. `rules/05-swell-decoration.md` に従い、SWELL装飾済みの `article-decorated.html` を作成する
   - `article-decorated.html` にはH1を入れない。WordPress投稿タイトルがH1になる前提で、本文はH2から開始する。
8. `rules/99-quality-check.md` に従い、`npm run check -- --slug {slug}` を実行する
9. `post_to_wp: true` の場合のみ、`rules/06-wordpress-draft.md` に従い `npm run post -- --slug {slug}` を実行する

## デフォルト補完

最小入力3項目だけの場合、以下を補完する。

```yaml
category: "バイク買取"
target_media: "https://poi-poi.co.jp/bike/"
post_to_wp: false
```

- `post_to_wp` は安全のため、未指定時は必ず `false` として扱う。
- `target_word_count` がない場合は警告し、本文作成時は標準目安として5000を使う。

## slug自動生成

- `slug` は任意入力。
- 未指定の場合は `main_keyword` または `keyword` から自動生成する。
- 例: `main_keyword: "バイク 買取 千葉"` → `bike-kaitori-chiba`
- 日本語キーワードを英数字slugに変換できない場合は `article-YYYYMMDD-HHmmss` 形式の安全なslugを生成する。
- 可能な限り意味のある英数字slugを優先する。

## 検索失敗時の安全ルール

検索結果取得や競合サイトのH2/H3抽出に失敗した場合、上位3サイトや見出しを推測で作らない。

対応:

1. `reference_urls` が指定されている場合は、そのURLから見出し抽出を行う。
2. `reference_urls` がない場合は、`serp.md` と `check-report.md` に失敗理由を記録し、ユーザーに参考URLの指定を促す。

禁止:

- 架空の上位サイトを作る
- 競合見出しを推測で生成する
- 実際に取得していないURLを参考URLとして記録する

## 絶対条件

- 投稿ステータスは常に `draft`
- 公開ステータスを使用しない
- `.env` を作成・編集してもコミットしない
- `post_to_wp` の初期推奨値は `false`
- WordPress下書き投稿まで進めたい場合のみ `post_to_wp: true` を指定する
- `post_to_wp: false` または未指定の場合はWordPress投稿を行わない
- どちらの場合も `article-decorated.html` までは作成する
- WordPress本文内にH1は入れない。記事タイトルはWordPress側の投稿タイトルとして扱い、本文HTMLはH2から開始する
- `article-decorated.html` は存在だけでなく、HTMLタグを除いた本文500文字以上を必須とする
- 本文500文字未満の場合はWordPress下書き投稿へ進まない
- 認証情報の実値、nonce、preview tokenを表示・記録しない
- 失敗時は原因と次アクションを `articles/{slug}/check-report.md` に記録する

## 通常の記事生成

```yaml
main_keyword: "バイク 買取 千葉"
title: "千葉でバイクを高く売る方法｜おすすめ買取業者と査定前の注意点"
target_word_count: 5000
```

## WordPress下書き投稿まで行う場合

```yaml
main_keyword: "バイク 買取 千葉"
title: "千葉でバイクを高く売る方法｜おすすめ買取業者と査定前の注意点"
target_word_count: 5000
post_to_wp: true
```

注意:

- `post_to_wp: true` の場合のみWordPress下書き投稿を実行する
- 未指定または `false` の場合はWordPress投稿しない
- 投稿ステータスは必ず `draft`
- 公開は絶対にしない

## 検索が不安定な場合

```yaml
main_keyword: "バイク 買取 千葉"
title: "千葉でバイクを高く売る方法｜おすすめ買取業者と査定前の注意点"
target_word_count: 5000
reference_urls:
  - "https://example.com/article1"
  - "https://example.com/article2"
  - "https://example.com/article3"
```
