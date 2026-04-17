# 00 トライアル・課金を避ける運用ガイド

> **最初に読む。** ここで事故ると財布が痛む。3基盤とも「無料で触り続ける」ルートはあるが、クセがある。

## TL;DR

| 基盤 | 推奨ルート | 課金リスク | クレカ要否 |
|------|----------|-----------|-----------|
| **Snowflake** | 30日/$400クレジット トライアル | 低（終了後は自動suspend） | 不要 |
| **Databricks** | Free Edition（無期限・Community Edition の後継） | 実質ゼロ | 不要 |
| **Microsoft Fabric** | 60日試用 → ただし新規テナント制限あり。詰まったら PAYG + F2 時間課金 | 中（F2 は起動時間課金） | F2ルートでは必要 |

---

## 1. Snowflake

### サインアップ手順

1. <https://signup.snowflake.com/> にアクセス（アクセス日: 2026-04-15）
2. 氏名・メール・会社名（個人なら適当でよい）を入力
3. **Edition は「Standard」を選ぶ**（Enterprise は機能が多いが学習にはStandardで十分。Cortex AIも使える）
4. **Cloud は AWS + ap-northeast-1 (Tokyo)** を推奨（東京リージョンが学習体験として素直）
5. メール内の Activation リンクを踏んで初期パスワード設定
6. 完了するとブラウザで Snowsight（Web UI）が開く

### トライアル条件

- **期間**: 30日 または **$400 クレジット消費** のどちらか早い方で終了
- **クレカ**: 不要（そのまま使うだけなら請求は発生しない）
- 公式: [Trial accounts | Snowflake Documentation](https://docs.snowflake.com/en/user-guide/admin-trial-account)（アクセス日: 2026-04-15）

### 課金を避けて触り続ける方法

- トライアル終了後、アカウントは **自動で suspend される**。明示的に「Convert to paid」しない限り課金は発生しない
- **触り続けたい場合の手段**:
  - (a) 終了前に **DROP してデータを破棄** → 再度別メールで新規トライアル開始（規約上グレーだが技術的に可能）
  - (b) `COMPUTE_WH` などのウェアハウスは **AUTO_SUSPEND=60秒** に設定してクレジット浪費を防ぐ（トライアル中の延命テク）
  - (c) 本気で学ぶなら素直にトライアルを使い切って、終わったら別のメールで再スタート

### ハマりどころ

- **$400 クレジットは思ったより減る**。Cortex AI で大きなモデル（`llama3.1-405b`など）を連打すると数十ドル単位で溶ける。学習時は `claude-haiku-4-5` や `llama3.1-8b` など小さいモデル推奨
- Snowflake Notebooks / Streamlit in Snowflake は **ウェアハウスが動いている間ずっとクレジット消費**。閉じる前に `ALTER WAREHOUSE ... SUSPEND;` を習慣に
- トライアル期間中に Hybrid Tables を触ると storage + compute の両方でクレジット消費が通常テーブルより重い

---

## 2. Databricks Free Edition

### 重要: Community Edition は 2026-01-01 に廃止済み

2025年6月に **Free Edition** が新登場。**Community Edition は 2026-01-01 で retire**。移行未済のユーザーはアクセス不可。

- 公式告知: [PSA: Community Edition retires at the end of 2025](https://community.databricks.com/t5/announcements/psa-community-edition-retires-at-the-end-of-2025-move-to-free/td-p/141888)（アクセス日: 2026-04-15）

### サインアップ手順

1. <https://signup.databricks.com/> にアクセス（アクセス日: 2026-04-15）
2. **「Get started with Free Edition」を選択**（14日トライアルのFull版ではなく Free Edition）
3. メール + Google/Microsoft アカウントで認証（OTP のみ。SSO/SCIM は Free では使えない）
4. 完了するとワークスペースが1個プロビジョニングされる

### Free Edition の仕様と制限

- **無期限・クレカ不要・商用利用不可**（学習・ホビーのみ）
- **Serverless コンピュートのみ**（Classic/GPUは使えない）
- **1ワークスペース / 1メタストア**
- **日次の計算・ストレージクォータあり**。超過すると翌日までコンピュート停止
- **SLA対象外・サポート対象外**
- **非アクティブが続くとアカウント削除される可能性**

公式: [Databricks Free Edition limitations | Databricks on AWS](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations)（アクセス日: 2026-04-15）

### 課金リスク

- 実質ゼロ。Free Edition は **クレカ登録自体がない** ので請求が発生する経路がない
- 注意: サインアップ時に間違えて「14-day Trial（Premium相当）」を選ぶと、**終了時に payment method を求められる**。Free Edition を明示的に選ぶこと

### ハマりどころ

- Free Edition は **GPUが使えない**ので、DBRX を自分でファインチューニングしたいとかは無理。推論（`ai_query` 経由）はOK
- Unity Catalog は触れるが、External Location の登録や Delta Sharing は制限あり
- Genie / AI/BI ダッシュボードは Free でも触れる（2025年末にFree対応を拡大）

---

## 3. Microsoft Fabric

**個人で触るのが一番難しい基盤。** 2025年途中から新規テナント制限が強化されたため、素直に試用できない可能性が高い。

### ルートA: 公式60日試用（動けばラッキー）

1. <https://app.fabric.microsoft.com/> にアクセス（アクセス日: 2026-04-15）
2. アカウントマネージャから「Start trial」
3. 動けば **64 CU の試用 Capacity + 1TB OneLake ストレージ**が付く

公式: [Start a Microsoft Fabric free trial with a personal email](https://learn.microsoft.com/en-us/fabric/fundamentals/free-trial-account-personal-email)（アクセス日: 2026-04-15）

**ただし制約**: 新規作成（90日未満）の Entra ID / M365 テナントには **試用 Capacity がプロビジョニングされない**。学習目的で使い捨てテナントを作る行為を MS がブロックしている。

参考: [Fabric trial capacity | Microsoft Learn](https://learn.microsoft.com/en-us/fabric/fundamentals/fabric-trial)（アクセス日: 2026-04-15）

### ルートB: Azure PAYG + F2 Capacity（確実だが時間課金）

1. 既存の個人 Azure アカウント（PAYG）を使う
2. Azure Portal で **Fabric Capacity (F2)** を作成
3. 不要なときは **必ず「Pause」** する（Running 状態だけ課金）

- **F2 料金**: 約 **$0.35/時間**（= Pause し忘れると1日$8.4 = 約1,260円）
- 週末ハンズオン中だけ Resume → 終わったら即 Pause。**2.5hで $0.875（約130円）**

公式: [Understand Microsoft Fabric Licenses](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)（アクセス日: 2026-04-15）

### 課金リスク

- **F2 の pause 忘れが最大の事故源**。Azure Portal のカレンダーアラートで「日曜22時に通知」を仕込むこと
- OneLake のストレージは容量課金だが、データ数GB程度なら月数十円レベル

### ハマりどころ

- Fabric は **Power BI Pro 権限が別途必要**な操作がある（レポート共有など）。個人学習ではレポートは自分で見るだけにしてPro課金を回避
- Copilot は **F64 以上で使えていた制限が 2025-04 以降 F2 以上に解放済み**。F2 で Copilot が触れる
- 参考: [Copilot and AI Capabilities will be accessible to all paid SKUs in Microsoft Fabric](https://blog.fabric.microsoft.com/en-US/blog/copilot-and-ai-capabilities-now-accessible-to-all-paid-skus-in-microsoft-fabric/)（アクセス日: 2026-04-15）

---

## 事前準備チェックリスト（ハンズオン開始前）

- [ ] 3基盤のサインアップを済ませ、Web UI にログインできる状態
- [ ] Snowflake: `COMPUTE_WH` の `AUTO_SUSPEND=60` に設定
- [ ] Databricks: Free Edition であることを確認（14-day Trialではない）
- [ ] Fabric: ルートA が動かなかったら **迷わずルートB**。Azure PAYG の請求上限アラートを $10 で設定
- [ ] `sample-data/` の3CSVをローカルに保存済み

## 公知情報の限界

- 価格・無料枠は**月次で変わる**。特に Databricks Free Edition のクォータ具体値は公式ページに数値が明記されていない時期があり、体感で判断する必要がある
- Fabric の新規テナント制限は**運用ポリシー**であり、MS が予告なく緩和・強化しうる
- 「Free Edition が商用利用不可」は明記済みだが、**受託案件の検証目的** が商用に該当するかは曖昧。本番商談で使うなら正規契約を推奨

## 壁打ちモードへの導線

- 「クライアントが **コストに敏感な中小企業** だった場合、この3基盤のどれが **一番安く始められる**と説明するか？」
- 「**試用が切れたあと**、どの基盤が**学習を継続しやすい**か。自分の経験を語れるか？」
- 「Fabric の pause 運用は **エンタープライズで現実的か**？ 社内運用チームがやりきれるか？」

## 結論

- 事故らずに3基盤触るルートは **Snowflake(30日) → Databricks Free(無期限) → Fabric F2(PAYG時間課金)**
- **Fabric は pause し忘れに最大警戒**
- 全部で財布から出るのは **最悪でも数百円**に収まる設計
