# GAT推論がAUCと実性能で乖離

- **type**: `failure`
- **date**: 2026-03-25
- **category**: quality / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: polaris-circuit, llm-retroactive, llm-classified

## what_happened
学習時AUCは高く出ていたが、実際の回路設計タスクでGATが意味のある指示を出せないケースが複数発生。LLM生成の学習データに偏りがあり、多様性・実データ不足が原因の可能性。

## root_cause
学習データが全てLLM生成の推奨回路で、対応ICも限定的。実回路の多様性を反映していない

<!-- id: d56273b8-5c8f-4565-acd9-0474e1ffb3d7 -->
