# AIチャット評価は暗黙的シグナルで実施

- **type**: `decision`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, auto-detected, daily-batch, llm-classified

## what_happened
AIチャットの良し悪し評価について、グッドバッドボタンは使われないので不要、明示的評価は強制すると逆効果と判断。質問内容・行動変化・面談情報など暗黙的シグナルから満足度・有用性を推定する方針に決定。業務連動の解像度を上げる必要性も確認。

## result
評価設計の方向性を確定。業務連動データ収集設計が次の課題に

<!-- id: f2ac0c8a-6dac-4db4-9875-e548af5eb9a7 -->
