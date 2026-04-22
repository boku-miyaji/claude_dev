# GNN検証方針 LLM主導 + 案2並走 + PCB 12K テンプレート生成

- **type**: `countermeasure`
- **date**: 2026-03-21
- **category**: architecture / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: polaris-circuit, llm-prompt, llm-retroactive, llm-classified

## what_happened
Step 3B（オペアンプ 1K スクラッチ学習）が再構成精度 0.4% で頓挫し案2を早々に諦めかけたが、社長から「10Kデータ生成は無理なのか、LLMで作れないか」と差し戻し。テンプレート展開のみで 12,792 件の PCBブロック DAG を生成し、150ep 学習で 22.9% まで改善。優先度は案2（GNN主導）を先に、LLM主導は将来繋がるよう並走検証する方針に確定。

## root_cause
データ量が少ないとスクラッチ学習が収束しない。諦めるのが早すぎた（案2を打ち切る判断が性急）。

## countermeasure
LLMファースト+GNN併走の両輪で検証を進め、データ生成はテンプレート展開 → LLM（Gemini/GPT併用で比較）→ 転移学習と段階的に拡張。

## result
Step 3B: 0% → Step 3B': 22.9% に改善。Task 1-5 すべて論文値再現以上。

<!-- id: 98076acc-63e0-4b08-b881-a14562cce472 -->
