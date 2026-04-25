# アジェンダ生成はmagentic_pipeline型、AIチャットはdynamic型

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, llm-prompt, architecture, auto-detected, daily-batch, llm-classified

## what_happened
MAF/magentic_pipeline.pyとdynamic orchestrationの使い分けを議論し、アジェンダ生成のような決定論的フローはmagentic_pipeline.pyスタイル、AIチャットのような対話的フローはdynamic方式で実装する方針を決定。

## result
用途別の設計パターン使い分け方針が確立

<!-- id: 106f5026-cccd-4d1d-a8ea-defc4e786306 -->
