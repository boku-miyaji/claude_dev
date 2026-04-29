# polaris-circuit: gemini-3-pro-previewでパイプライン検証開始

- **type**: `decision`
- **date**: 2026-04-29
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: polaris-circuit, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
回路図生成エージェントパイプライン（GNN FB、KiCad生成エージェント含む）の完成度向上方針を策定。グラフ粒度ごとのLLM/GNN役割分担を整理し、まずは1構成で動くものを作ってから検証する方針を確定。

## result
モデルはgemini-3-pro-previewで統一して検証開始。論点1(a,b,c全部)・論点3(a)・論点4(認識通り)で進める。add-scripts-for-kicad-sch-generationブランチを起点に伸ばす。

<!-- id: 9dedfaf0-8542-4060-afbe-3ca663d420f3 -->
