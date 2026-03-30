---
description: ナレッジ蓄積・昇格ルール。フィードバックや好みの検出時に適用。
globs: ["**/*"]
---

# ナレッジ蓄積ルール

> ユーザーとの対話から学習した知見を `~/.claude/knowledge/` に蓄積する。

## 蓄積先

- **ディレクトリ**: `~/.claude/knowledge/`
- **形式**: YAML

## 記録タイミング

1. **出力への修正・フィードバック**（最重要）
2. **汎用的な好み・方針の表明**
3. **デフォルト挙動への修正要望**

## 記録しないもの

- 単なるタスク指示、一般的なQ&A、一時的な情報

## YAML 構造

```yaml
metadata:
  date: "YYYY-MM-DD"
  project: "プロジェクト名"
  topic: "トピック概要"
decisions:
  - id: "DEC-001"
    context: "どういう状況で"
    question: "何を決めたか"
    answer: "どう決めたか"
    reasoning: "なぜそう決めたか"
preferences:
  - category: "カテゴリ"
    preference: "ユーザーの好み・指針"
instructions:
  - instruction: "具体的な指示内容"
    applies_to: "適用範囲"
```

## 昇格条件（CLAUDE.md への追加提案）

- 同じカテゴリの指示が **2回以上** 記録
- 「常に〜する」等の恒久的ルール
- プロジェクト横断で同じ指針が適用
