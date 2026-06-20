# 品質チェックレポート

- slug: bike-kaitori
- result: PASS

## Local article validation

- result: PASS
- command: npm run check -- --slug bike-kaitori
- article.html H1なし: yes
- article-linked.html H1なし: yes
- article-decorated.html H1なし: yes
- metadata.json: valid JSON
- status: draft

## Decoration validation

- result: PASS
- command: npm run decorate -- --slug bike-kaitori
- command: npm run check:decoration -- --slug bike-kaitori
- decoration-manifest.json: created
- article-decorated.html SHA-256: 1ba18cd36c8a8c575f1a574e759f2e4cd0db0f6f525c0602f3ae377de3926f14

## WordPress connection

- result: PASS
- command: npm run article:complete -- --slug bike-kaitori
- REST root: reachable
- authenticated read/write: success

## Duplicate check

- result: PASS
- 投稿ID 29442確認: draft / slug=bike-kaitori
- 同一slugの既存draftとして再利用
- publish/future/pending/privateの自動更新なし

## Minimal draft createまたはexisting draft reuse

- result: existing-id
- reused_post_id: 29442
- 新規下書き作成: not required

## Content update

- result: update-timeout-saved
- explanation: content更新リクエストはタイムアウト扱いになったが、直後の認証付き再取得でWordPress本文SHA-256がローカル本文と一致したため保存成功として扱った。

## REST API read-back

- result: PASS
- post_id: 29442
- title: バイク買取はどこがいい？相場・査定・必要書類・注意点を初めてでもわかるように解説
- slug: bike-kaitori
- status: draft
- H1なし確認: yes

## Content SHA match

- result: PASS
- article-decorated.html SHA-256: 1ba18cd36c8a8c575f1a574e759f2e4cd0db0f6f525c0602f3ae377de3926f14
- WordPress本文 SHA-256: 1ba18cd36c8a8c575f1a574e759f2e4cd0db0f6f525c0602f3ae377de3926f14
- SHA一致: yes

## Final status

- status: draft
- Overall: PASS
