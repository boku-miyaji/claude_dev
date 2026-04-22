# 構造化ハンドオフYAML — Markdown正規表現の限界を超える

- **type**: `countermeasure`
- **date**: 2026-04-05
- **category**: process / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: process, handoff, yaml, department-coordination, IMP-002
- **commits**: 68c1e51

## what_happened
IMP-002として実施。部署間のハンドオフ（引き継ぎ）をMarkdownパターンマッチで検出していたが、誤検出・見逃しが発生。YAMLブロック形式に移行し、確実なパースを実現。

## root_cause
Markdownの「→ {部署名}部への依頼」パターンは自然文に紛れやすく、正規表現での検出が不安定だった。

## countermeasure
ハンドオフ情報をYAMLブロック（handoff: - to: pm, tasks: [...]）で構造化。後方互換のためMarkdownパターンも残すが、新規は必ずYAML。

## result
部署間連携の指示が機械可読になり、自動パイプライン実行の基盤が整った。

<!-- id: bfef251e-a99f-428d-ab69-a8d1f0b15c5d -->
