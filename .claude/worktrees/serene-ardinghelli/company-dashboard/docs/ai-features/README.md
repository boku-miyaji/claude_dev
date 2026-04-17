# AI機能ドキュメント

> 最終更新: 2026-04-05

company-dashboard に搭載されている5つのLLM機能の詳細仕様書です。
全機能は Supabase Edge Function (`ai-agent`) 経由で OpenAI API を呼び出します。

## 共通アーキテクチャ

```
ブラウザ (React Hook)
  |
  | aiCompletion() -- src/lib/edgeAi.ts
  |
  v
Supabase Edge Function: ai-agent (mode: completion)
  |
  | Authorization: Bearer <session_token>
  |
  v
OpenAI API (デフォルトモデル: gpt-5-nano)
```

- API キーはサーバーサイド (Edge Function 環境変数) にのみ存在し、ブラウザには露出しない
- 全機能が `src/lib/edgeAi.ts` の `aiCompletion()` を唯一のエントリポイントとして使用する

## 機能一覧

| # | 機能名 | ドキュメント | ソースコード | DB保存 |
|---|--------|-------------|-------------|--------|
| 1 | [感情分析](./emotion-analysis.md) | emotion-analysis.md | `useEmotionAnalysis.ts` | emotion_analysis + diary_entries.wbi |
| 2 | [自己分析](./self-analysis.md) | self-analysis.md | `useSelfAnalysis.ts` | self_analysis |
| 3 | [朝の一言](./morning-briefing.md) | morning-briefing.md | `useMorningBriefing.ts` | なし (Zustand Store キャッシュ) |
| 4 | [夢進捗検出](./dream-detection.md) | dream-detection.md | `useDreamDetection.ts` | なし (UI Toast のみ) |
| 5 | [週次ナラティブ](./weekly-narrative.md) | weekly-narrative.md | `useWeeklyNarrative.ts` | weekly_narratives |

## 共通ライブラリ

| ファイル | 役割 |
|---------|------|
| `src/lib/edgeAi.ts` | Edge Function 呼び出しラッパー (`aiCompletion`) |
| `src/lib/aiPartner.ts` | AI パートナーのペルソナ定義・プロンプトビルダー |
| `src/stores/briefing.ts` | 朝の一言の Zustand ストア (24時間キャッシュ) |

## ドキュメント同期チェック

[SYNC_CHECK.md](./SYNC_CHECK.md) にコードとドキュメントの整合性チェック手順を記載しています。
