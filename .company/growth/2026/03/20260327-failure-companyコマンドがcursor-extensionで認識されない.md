# /companyコマンドがCursor extensionで認識されない

- **type**: `failure`
- **date**: 2026-03-27
- **category**: tooling / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, documentation, llm-retroactive, llm-classified

## what_happened
Cursor のClaude extensionから /company を呼び出しても認識されないが、ターミナルから claude を立ち上げると認識する。他サーバーでは Cursor extension でも動作していた。skills-cache.json には company スキルが存在しているがロードされていない状況。インストール方法が不明で再現性がない。

## root_cause
インストール手順が未整備で環境差異が発生。skills-cache のソースパス解決がextension起動時と異なる可能性

## countermeasure
他サーバーで動く配置と比較し、再現可能なインストール手順をドキュメント化する方針

<!-- id: 561755db-c26f-4870-8e40-98ff06f3b0d9 -->
