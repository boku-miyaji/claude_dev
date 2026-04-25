# AIチャット評価は暗黙評価のみで設計

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, llm-prompt, ui, auto-detected, daily-batch, llm-classified

## what_happened
focus-you の AI チャット評価方式について、グッドバッドボタンは誰も使わないため廃止。明示評価は強制せず、質問内容・行動・面談情報・業務連動から暗黙的に有用性を判定する方針に決定。

## result
業務連動の評価設計はデータ収集方法も含め早期に詳細化が必要、として継続課題化

<!-- id: ef7d3f31-8306-4632-9780-a690a40c52b5 -->
