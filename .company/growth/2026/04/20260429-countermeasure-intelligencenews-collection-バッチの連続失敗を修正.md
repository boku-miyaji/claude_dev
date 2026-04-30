# Intelligence/News Collection バッチの連続失敗を修正

- **type**: `countermeasure`
- **date**: 2026-04-29
- **category**: devops / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, github-actions, silent-failure, manual-record

## what_happened
Intelligence: llm_compose.py の collect_previous_urls() で過去レポートの items が dict 形式（旧スキーマ 2026-03-31-1052.json）になっていた場合に AttributeError: 'str' object has no attribute 'get' でクラッシュ。News: Verify rows ステップで anon key + HEAD リクエストの content-range が RLS 影響で空になり、24件INSERT成功にも関わらず誤って exit 1 → false positive failure。修正: (1) collect_previous_urls に isinstance ガードを追加し dict/str 混在に対応、(2) news-collect.yml の Verify ステップを SERVICE_ROLE_KEY ベースに変更し RLS バイパス。

<!-- id: c45a7eee-8358-4958-a375-c2994f4404fa -->
