# 検証はAPI叩いて自動再現すべき

- **type**: `countermeasure`
- **date**: 2026-04-05
- **category**: quality / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, testing, process, llm-retroactive, llm-classified

## what_happened
「私がテストしないといけないの？APIを叩いて、再現できないの？」と社長から指摘。手動テスト依頼を前提にする姿勢を修正し、APIで自動再現・検証を行う方針へ。

## root_cause
実装完了報告時に社長に手動テストを依頼する運用が残っていた

## countermeasure
APIレベルで再現・検証してから報告する。手動確認依頼を減らす

<!-- id: 78eba101-f9c9-4506-b2da-11108ae9ed9b -->
