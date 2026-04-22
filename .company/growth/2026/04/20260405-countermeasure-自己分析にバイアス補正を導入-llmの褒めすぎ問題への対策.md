# 自己分析にバイアス補正を導入 — LLMの「褒めすぎ」問題への対策

- **type**: `countermeasure`
- **date**: 2026-04-05
- **category**: quality / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: quality, self-analysis, bias-correction, multi-source, radar-chart, focus-you
- **commits**: b9244ee, 9a26f94, b368017, c7abc83

## what_happened
Self-Analysisページをダッシュボードグリッド+SVGレーダーチャートに刷新。さらに全分析プロンプトに構造的バイアス補正を追加。日記の質問も「分析バイアスを誘発しない」よう再設計。multi-source行動データ（prompt_log 1034件、タスク完了率、カレンダー）を統合。

## root_cause
LLMは自己分析で肯定的バイアスが強く、「ポジティブすぎる分析」になりがち。また単一データソースでは偏った分析になる。

## countermeasure
分析プロンプトに「ネガティブな側面も等しく扱うこと」「データに基づかない推測は明示すること」等のバイアス補正指示を追加。日記の質問を感情誘導しない中立的な表現に変更。

## result
AIによる自己分析は「バイアス補正」を明示的にプロンプトに組み込まないと信頼できない。データソースを複数統合することで分析の立体性が向上。

<!-- id: 6e190f6d-d000-440b-bb0a-0b1cac5e8a72 -->
