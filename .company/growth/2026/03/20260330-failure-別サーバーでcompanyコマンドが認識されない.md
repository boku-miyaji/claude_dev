# 別サーバーで/companyコマンドが認識されない

- **type**: `failure`
- **date**: 2026-03-30
- **category**: tooling / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, agent-harness, documentation, llm-retroactive, llm-classified

## what_happened
他サーバーでclaude_devリポジトリをpullした状態では/companyコマンドが動作しなかった。プラグインキャッシュの.claude-plugin/にplugin.jsonが無く、代わりにmarketplace.json(マーケットプレース定義)だけが配置されていた。

## root_cause
プラグインキャッシュにplugin.jsonが欠落。marketplace.jsonのみではプラグイン本体として認識されない。

## countermeasure
plugin.jsonをソースとキャッシュ両方に配置。install-company.shでboku-miyaji/claude_devのshallow clone→plugins/company/→.company/をコピーする手順を整備。

## result
セッション再起動で/companyコマンドが認識されるようになった。

<!-- id: 3709487a-05c4-43bb-8674-f21148e4d001 -->
