# Microsoft Fabric RAG ハンズオン — `ai.embed` + `ai.similarity` + Azure AI Search

> 所要時間: 約70分 / 前提: Fabric Lakehouse `focus_you` に `diary_entries` がある

## ゴール

Fabric の AI Functions（`ai.embed`, `ai.similarity`）と、必要に応じて Azure AI Search を使って、focus-you 日記の類似検索を実装する。3基盤の中で最もセットアップが多いが、MS エコシステム連携を体感するのが目的。

## Fabric で RAG を組む選択肢

Fabric には "Vector Search サービス" という単一製品がない。代わりに複数の選択肢がある:

| 選択肢 | 使いどころ | 手軽さ |
|---|---|---|
| **A. `ai.embed` + `ai.similarity`** | 小〜中規模、Lakehouse / Notebook 完結 | ◎ |
| **B. Azure AI Search 連携** | 大規模、エンタープライズ検索、ハイブリッド | ○（Azure側の構成が要る） |
| **C. Eventhouse (KQL) ベクトル検索** | リアルタイム、ストリーミングログ | △（KQL 学習要） |

本ハンズオンは **A** を中心に、B への橋渡しを示す。

公式: [Fabric AI Functions overview](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/overview) / [ai.embed](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/pandas/embed) / [ai.similarity](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/pandas/similarity) (accessed 2026-04-15)

---

## ステップ 1: Notebook 環境を整える（5分）

Fabric ワークスペース → Lakehouse `focus_you` → **Open Notebook**。

```python
import pandas as pd
import synapse.ml.fabric.ai_functions as ai  # Fabric AI Functions SDK

# Lakehouse のテーブルを pandas に
diary_df = spark.read.table("focus_you.diary_entries").toPandas()
print(diary_df.shape)
```

## ステップ 2: `ai.embed` で埋め込みを生成（10分）

```python
# entry_text 列をまとめて embedding 化
diary_df["embedding"] = ai.embed(
    diary_df["entry_text"],
    model="text-embedding-3-small",  # Fabric内蔵。別モデルも指定可
)

# 確認
print(len(diary_df["embedding"].iloc[0]))  # 1536 次元
```

保存:
```python
spark.createDataFrame(diary_df).write.mode("overwrite").saveAsTable(
    "focus_you.diary_with_embedding"
)
```

👉 **驚きポイント**: `ai.embed(column)` という1行で全行の埋め込みが得られる。OpenAI API を直接叩く必要がない（裏で呼ばれている）。

## ステップ 3: `ai.similarity` で類似検索（15分）

```python
query = "プロジェクトで上司と衝突してどうにも気が晴れない"
query_embedding = ai.embed([query])[0]

# 全行に類似度を計算
diary_df["similarity"] = ai.similarity(
    diary_df["embedding"],
    query_embedding,
)

top5 = diary_df.sort_values("similarity", ascending=False).head(5)
print(top5[["entry_date", "mood_score", "entry_text", "similarity"]])
```

**注意**: これは「全行スキャン × cosine 類似度」で、30日程度ならこれで十分。**1万行を超えたら** Azure AI Search または Eventhouse ベクトル検索に移行する。

## ステップ 4: 取得結果を要約（10分）

```python
# 取得した日付に紐づく予定を取得
dates = top5["entry_date"].tolist()
events_df = spark.read.table("focus_you.calendar_events").toPandas()
events_filtered = events_df[events_df["event_date"].isin(dates)]

# コンテキスト組み立て
context_lines = []
for _, row in top5.iterrows():
    day_events = events_filtered[events_filtered["event_date"] == row["entry_date"]]
    events_str = ", ".join(day_events["event_title"].tolist()) or "予定なし"
    context_lines.append(
        f"- {row['entry_date']} mood={row['mood_score']}: {row['entry_text'][:60]} 予定: {events_str}"
    )

prompt_context = "\n".join(context_lines)

# ai.generate_response で要約
summary_df = pd.DataFrame({
    "prompt": [
        f"以下は「気が晴れない」気分になっていた過去の日とその予定です。\n{prompt_context}\n\nこれらの日の共通点と、こういう気分の時に取ると効きそうな過ごし方を3行で要約してください。"
    ]
})
summary_df["summary"] = ai.generate_response(summary_df["prompt"])
print(summary_df["summary"].iloc[0])
```

## ステップ 5: Azure AI Search への橋渡し（省略可、15分）

1万行を超える規模なら Azure AI Search を裏に立てる:

1. Azure ポータル → AI Search サービスを作成（Free tier でOK）
2. Fabric Notebook から `azure-search-documents` SDK でインデックス作成・ドキュメント投入
3. Fabric AI Functions と Azure AI Search の両方を同じ Notebook から呼べる
4. ハイブリッド検索（BM25 + ベクトル）は Azure AI Search 側の `search_type="hybrid"` で指定

具体的な構築手順は Azure AI Search 側のドキュメントに丸投げ。ここでは "Fabric から外部検索を呼ぶのは自然" ということだけ押さえる。

## ステップ 6: Data Warehouse 内で AI Functions を使う（参考）

Fabric Warehouse 内でも `AI_CLASSIFY` / `AI_GENERATERESPONSE` といった **T-SQL AI Functions** が2026年時点で Preview 提供されている ([blog](https://blog.fabric.microsoft.com/en-US/blog/working-with-unstructured-text-in-fabric-data-warehouse-with-built-in-ai-functions-preview), 2026-04-15)。類似検索は `AI_GENERATEEMBEDDINGS` + 自前 cosine で組む形。パターンC で詳述する。

## コスト

- **AI Functions 消費**: Capacity Unit + 呼び出しトークン量換算
- **Embedding 生成**: 1回だけなら安い。全行に再適用する運用だと効いてくる
- **Azure AI Search を使う場合**: AI Search 側の価格（Free tier → Basic → Standard）

**節約Tips**:
- Embedding はキャッシュする（`ai.embed` の結果を Delta に保存して再利用）
- 類似度計算は Python/Pandas/Spark のローカル計算で十分なケースが多い
- 全行スキャンで耐える規模かどうかを最初に見積もる（1万行くらいが目安）

## 他2基盤との差分メモ

- **"サービス" としてのベクトル検索が無い**: Fabric 固有の Vector Search マネージドサービスは2026-04時点で存在しない（Azure AI Search と連携する設計）
- **Notebook 駆動**: Snowflake / Databricks はテーブル駆動で自動同期、Fabric は Notebook で能動的に呼ぶ構造
- **Azure AI Foundry / Azure AI Search との連携**: MS エコシステム統合が前提の設計で、Azure 資産がある組織では最強

## 公知情報の限界

- `ai.embed` の内部モデル選択肢と日本語性能は公式ドキュメントで限定的にしか触れられていない
- Fabric 内ネイティブの Vector Index サービスは2026-04時点で未提供（今後追加される可能性）
- Preview 機能が多く、個人試用アカウントでは動かない場合あり

## 壁打ちへの導線

- クライアントに「Fabric で RAG」と言う時、実際は "AI Functions + Azure AI Search" の組み合わせになる。この内部構成を隠すか、最初から説明するか
- Azure AI Search を別途契約する判断基準
- Fabric Notebook 完結 RAG と、Databricks Delta Sync RAG の運用負荷の差

## ネクストアクション

- [ ] `ai.embed` の結果をキャッシュして2回目以降のコスト差を実測
- [ ] 同じクエリに Snowflake Cortex Search / Databricks Vector Search / Fabric `ai.similarity` を投げて Recall の感覚を揃える
- [ ] 1万行スケールを想定した時の Azure AI Search 移行コストを見積もり

---

**Sources (accessed 2026-04-15)**:
- [Fabric AI Functions overview](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/overview)
- [ai.embed](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/pandas/embed)
- [ai.similarity](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/pandas/similarity)
- [ai.generate_response](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/pandas/generate-response)
- [Fabric Data Warehouse AI Functions (Preview)](https://learn.microsoft.com/en-us/fabric/data-warehouse/ai-functions)
- [AI Functions Enhancements GA blog](https://blog.fabric.microsoft.com/en-US/blog/29826/)
