# polaris-circuit 部品推薦 Agent デモ改修仕様書

**作成日**: 2026-04-21
**対象**: polaris-circuit の部品推薦 Agent（DC/DC・LDO カテゴリ）
**目的**: 4つの実行結果（A/B/C/D）を受けての改修。社長レビューで指摘された「スコアが分かりにくい」「データシート熟読感が弱い」「緩和の根拠が薄い」を解消する
**前提**: デモ用途。精度は仮でよいが、見せ方・評価ロジック・根拠提示は本実装レベルに近づける
**引き渡し先**: polaris-circuit 担当チーム（本ドキュメントを仕様として実装してもらう）

---

## 1. 背景と問題認識

### 現状の実行結果（A/B/C/D）から見えた問題

| シナリオ | 入力 | 結果 | 問題 |
|---|---|---|---|
| A | 12V→3.3V, 1A, 効率90%↑ | TPS62090 推薦（適合度0.52） | **0.52 の意味不明**。上位3候補が同点で tie-breaker 不可視 |
| B | 12V→3.3V, 500mA, 効率90%↑, SO-8, fsw 500kHz↑ | 緩和して TPS54331（適合度0.52） | 緩和が90→85%と決め打ち。根拠不明 |
| C | 5V→3.3V, 300mA, Vdrop≤300mV, 低ノイズ, SOT-23 | 緩和2回でも候補なし | **SOT-23 を変えずに緩和。コメントで「パッケージ変更推奨」と言うが自分で試していない** |
| D | 12V→3.3V, 50mA, ノイズ10μVrms以下, SOT-23 | 緩和後も候補なし | **`LLM response invalid` が内部エラーのまま露出**。緩和刻みが10→30μVrmsで粗い |

### 根本原因の推定

1. **`curves` / `data_points` テーブルが未整備**（または活用されていない）→「データシート熟読感」が出ない
2. **スコア計算の内訳が可視化されていない**→ 0.52 の意味不明問題
3. **緩和のロジックがヒューリスティック**→ 順序・刻み・対象項目の根拠薄
4. **LLM 多面評価（推奨動作領域、errata）の痕跡が UI に無い**

---

## 2. DB スキーマ追加（必須セット）

### 2.1 既存テーブル（変更あり）

```sql
-- parts テーブル：以下のカラムを追加
ALTER TABLE parts ADD COLUMN lifecycle_status TEXT CHECK (lifecycle_status IN ('active','NRND','EOL','obsolete')) DEFAULT 'active';
ALTER TABLE parts ADD COLUMN release_year INT;
ALTER TABLE parts ADD COLUMN price_1k_usd DECIMAL(10,4);
ALTER TABLE parts ADD COLUMN features JSONB;  -- ["sync_rect", "enable", "pg", "soft_start"]
ALTER TABLE parts ADD COLUMN topology_variant TEXT;  -- "PWM", "PFM", "hysteretic"
ALTER TABLE parts ADD COLUMN theta_ja DECIMAL(6,2);  -- 熱抵抗 (℃/W)
ALTER TABLE parts ADD COLUMN theta_jc DECIMAL(6,2);
ALTER TABLE parts ADD COLUMN package_dimensions JSONB;  -- {"L":3.0,"W":3.0,"H":0.9}
```

### 2.2 新規テーブル

```sql
-- 推奨動作範囲（Safe Operating Area）
CREATE TABLE operating_envelope (
  id SERIAL PRIMARY KEY,
  part_id INT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  param_name TEXT NOT NULL,  -- "Vin", "Iout", "Tj", "Ta"
  min_val DECIMAL(12,4),
  max_val DECIMAL(12,4),
  typical_val DECIMAL(12,4),
  unit TEXT,
  conditions JSONB,  -- 測定条件（他パラメータの固定値）
  source_page INT,
  notes TEXT
);

-- Agent の推薦履歴（学習データ用）
CREATE TABLE recommendations (
  id SERIAL PRIMARY KEY,
  query_json JSONB NOT NULL,  -- ユーザーの元要件
  structured_spec JSONB NOT NULL,  -- LLM でパース後
  candidates JSONB NOT NULL,  -- 候補部品IDと各スコア
  relaxation_history JSONB,  -- 緩和の履歴
  final_pick INT REFERENCES parts(id),
  rescue_mode_used BOOLEAN DEFAULT FALSE,
  elapsed_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 既存テーブル（軽微な追加）

```sql
-- curves テーブル
ALTER TABLE curves ADD COLUMN extraction_method TEXT CHECK (extraction_method IN ('manual','vector','vlm','hand_picked'));
ALTER TABLE curves ADD COLUMN extraction_confidence DECIMAL(3,2);
ALTER TABLE curves ADD COLUMN verified_by_human BOOLEAN DEFAULT FALSE;
ALTER TABLE curves ADD COLUMN source_figure_id TEXT;  -- "Figure 5", "Fig. 12a"
ALTER TABLE curves ADD COLUMN curve_group_id UUID;  -- 条件違いをグループ化
```

### 2.4 仮データ投入計画（デモ用）

- DC/DC 5 部品 + LDO 3 部品 = **計 8 部品**
- 各部品につき主要 1-2 曲線（効率 vs Iout、または Noise vs Frequency）
- 各曲線につき 5-10 データポイントを **手動で打ち込み**
- すべて `extraction_method = 'hand_picked'`, `verified_by_human = TRUE`

#### 投入すべき8部品（推奨）

**DC/DC**:
1. TPS62090（TI, QFN-10, 20V, 3A）
2. LMR33630（TI, SO-PowerPAD-8, 36V, 3A）
3. TPS54331（TI, SO-8, 28V, 3A）
4. TPS62130（TI, QFN-16, 17V, 3A）
5. LMR14030（TI, HSOIC-8, 40V, 3.5A）

**LDO**:
1. LP5907-3.3（TI, SOT-23, 5.5V, 250mA, 低ノイズ）
2. TPS7A47（TI, VQFN-20, 36V, 1A, 超低ノイズ）
3. TLV733P（TI, SOT-23, 5.5V, 300mA, 標準）

---

## 3. P0 改修仕様（最優先、実装調査不要）

### 3.1 スコアの2階建て表示

**現状**: 「適合度 0.52（1.0=完全適合）」という単一スコアのみ。内訳不可視。

**改修**: 以下の2階建てに分離する。

```
┌─ 必須制約（ハードフィルタ）──────────┐
│ ✓ Vin_max: 20V  ≥ 要件 12V            │
│ ✓ Iout_max: 3A  ≥ 要件 1A             │
│ ✓ Tj_max: 150℃  ≥ 要件 125℃           │
│ ✓ Package: QFN-10 ∈ 許容セット         │
│ 4/4 必須制約 PASS                      │
└───────────────────────────────────────┘

┌─ 最適化達成度（ソフト評価）──────────┐
│ 効率 @ Iout=1A, Vin=12V, Tj=25℃       │
│   目標 ≥ 90.0%                          │
│   実績 94.4%                            │
│   マージン +4.4% ✓                      │
│                                        │
│ スイッチング周波数                      │
│   目標 ≥ 500kHz                         │
│   実績 2.5MHz                           │
│   マージン +400% ✓                      │
└───────────────────────────────────────┘
```

**実装**:
- `MandatoryCheck` と `OptimizationMetric` を別の型として定義
- UI 表示: 必須は緑✓/赤✗、最適化は目標値・実績値・マージンの3列
- **`0.52` 型の単一スコアは UI から削除**（内部ログには残してよい）

### 3.2 候補比較テーブル

**現状**: TOP1 のみ詳細表示、2位以下は文章でぼんやり「僅かに劣る」のみ。

**改修**: 候補 3 件を横並びテーブル表示。

```
| 項目           | 🏆 TPS62090 | TPS62130   | LMR33630   |
|----------------|-------------|------------|------------|
| 効率 @1A       | 94.4%       | 93.8%      | 93.9%      |
| マージン       | +4.4%       | +3.8%      | +3.9%      |
| Tj 余裕        | 25℃         | 15℃        | 30℃        |
| パッケージ     | QFN-10      | QFN-16     | SO-P-8     |
| 価格 (1k)      | $0.82       | $1.15      | $0.95      |
| ライフサイクル | active      | active     | active     |
| 総合順位       | 1           | 2          | 3          |
```

**実装**:
- バックエンド API `/api/recommend` のレスポンス形式に `comparison_table` フィールドを追加
- 各行のキーは仕様カテゴリに応じて動的生成（DC/DC と LDO で異なる）
  - DC/DC: 効率・Tj余裕・パッケージ・価格・fsw
  - LDO: ノイズ・ドロップアウト・PSRR・パッケージ・価格

### 3.3 内部エラーメッセージの非表示

**現状**: シナリオ D で `LLM response invalid` がユーザー UI に露出。

**改修**:
- Agent ループ内のエラーログは **内部ログにのみ記録**
- UI には **ユーザー向け統一メッセージ**を出す:
  - LLM 応答異常 → 「判定を打ち切りました（内部で一時的なエラー）」
  - max_iter 到達 → 「探索を打ち切りました（緩和の余地が尽きたため）」
  - 候補ゼロ → 「該当部品が見つかりませんでした」
- ログには `internal_error_code` として分類保存（後で分析可能に）

### 3.4 緩和の刻みを細かく

**現状**: 効率 90→85%（-5%）、ノイズ 10→30μVrms（3倍）のように**ジャンプ**。

**改修**: 緩和は段階的に、1回あたりの変化を制限する。

```python
# 緩和刻みの定義
RELAX_STEPS = {
    "efficiency_min": [0.02, 0.05, 0.10],   # 2%, 5%, 10% 刻み
    "noise_max": [1.5, 2.0, 3.0],            # 1.5倍, 2倍, 3倍
    "vdropout_max": [1.3, 1.7, 2.5],
    "vin_max": [1.1, 1.2, 1.5],              # 1.1倍, 1.2倍, 1.5倍
    "tj_max_delta": [5, 10, 15],             # +5℃, +10℃, +15℃
    "package": "categorical_expand"           # SOT-23 → +SOT-223 → +TO-252
}
```

- 最初は最小刻みで緩和（2%、+5℃など）。それでもダメなら次の刻み。
- 各緩和ステップでログに `relaxation_amount` と `reason` を記録

### 3.5 緩和の順序をユーザー NOTES 起点に

**現状**: 緩和順序が固定的（例えば Vin_max を先に緩める）。ユーザーの意図が反映されない。

**改修**:
- ユーザー入力の NOTES（「ノイズは小さい方がいい」等）を LLM でパース → **優先保持パラメータ** を抽出
- 優先保持パラメータは **緩和の最後** に回す
- 緩和順序の決定ロジック:
  1. LLM が NOTES から `prioritized_params` を抽出
  2. `prioritized_params` 以外を **重要度低い順** に緩める（Vin_max > Tj > Iout > 効率 > ノイズ）
  3. それでもダメな場合のみ `prioritized_params` に手を付ける
- 緩和時の UI 表示:
  > 「ノイズ要件を優先保持するため、まずパッケージを SOT-23 → SOT-223 に拡大します」

---

## 4. P1 改修仕様（デモ品質に必須）

### 4.1 Evidence ログ形式の UI 露出

**現状**: 「効率94.4%」と数値は出るが、出所不明。

**改修**: 各スペック数値の横に **必ず出所** を添える。

```
効率 @ Iout=1A, Vin=12V, Tj=25℃
  実績: 94.4%
  📄 出典: TPS62090 データシート p.7 Figure 5
         (efficiency_vs_iout, conditions: Vin=12V, Tj=25℃)
         curve_id=101, interpolated from 6 points
```

**実装**:
- 補間関数 `interpolate_curve(curve_id, x)` の戻り値に `evidence` フィールドを含める:
  ```python
  {
    "value": 94.4,
    "evidence": {
      "curve_id": 101,
      "datasheet_page": 7,
      "figure_id": "Figure 5",
      "conditions": {"Vin": 12, "Tj": 25},
      "interpolated_from": 6,
      "method": "linear"
    }
  }
  ```
- UI: Evidence を折りたたみ可能なアコーディオンで表示（デフォルト閉じる）

### 4.2 曲線補間の実装

**現状**: おそらく未実装（UI に補間痕跡なし）。

**改修**: scipy.interpolate で実装。

```python
from scipy.interpolate import interp1d

def interpolate_curve(curve_id: int, target_x: float, method: str = "linear"):
    """
    curves + data_points から値を取得し、補間で target_x の y を返す
    """
    points = db.query(
        "SELECT x, y FROM data_points WHERE curve_id = %s ORDER BY x", curve_id
    )
    xs = [p.x for p in points]
    ys = [p.y for p in points]

    # 範囲外の場合は警告
    if target_x < min(xs) or target_x > max(xs):
        return {
            "value": None,
            "out_of_range": True,
            "warning": f"target_x={target_x} outside curve range [{min(xs)},{max(xs)}]"
        }

    f = interp1d(xs, ys, kind=method)
    y_value = float(f(target_x))

    return {
        "value": y_value,
        "evidence": {
            "curve_id": curve_id,
            "interpolated_from": len(xs),
            "method": method
        }
    }
```

- 範囲外の場合は「外挿なし、警告付き」で返す（安全側）
- `method` は `linear` (デフォルト) / `cubic` を選択可能

### 4.3 パッケージも緩和候補に含める

**現状**: シナリオ C で「SOT-23 変更を推奨」とコメントしながら自分で試していない。

**改修**: パッケージも緩和ロジックの対象に含める。

```python
# パッケージの緩和階層（小→大）
PACKAGE_RELAXATION = {
    "SOT-23": ["SOT-23", "SOT-23-5", "SOT-23-6"],           # 第1段階
    "SOT-223": ["SOT-23", "SOT-223"],                        # 第2段階: より大きい
    "TO-252": ["SOT-23", "SOT-223", "TO-252"],              # 第3段階: さらに大
}
```

- ユーザーが「SOT-23」を指定しても、候補ゼロの場合に段階的に拡張
- UI 表示:
  > 「SOT-23 では候補が見つからないため、SOT-223 まで拡大して再検索します（熱設計余裕のため）」

---

## 5. P2 改修仕様

### 5.1 LLM 多面評価結果の UI 表示

**現状**: LLM 多面評価（推奨動作領域・errata・application note 確認）の痕跡が UI に無い。

**改修**: 候補ごとに以下のチェック結果を表示。

```
┌─ LLM 多面評価（TPS62090）──────────────┐
│ ✓ 推奨動作領域: Iout=1A は推奨範囲内    │
│ ✓ 軽負荷動作: PFM モードで効率維持      │
│ ✓ 高温時の注意: Tj=125℃ は余裕あり      │
│ ✓ Errata: 既知の問題なし                 │
│ ✓ Application Note: 車載向けに推奨      │
│ 5/5 passes                              │
└────────────────────────────────────────┘
```

**実装**:
- LLM プロンプトに「以下の観点で各候補を評価せよ」と明示:
  1. Recommended Operating Conditions に入っているか
  2. 軽負荷・高温での注意書きがないか
  3. errata（既知問題）がないか
  4. Application Note の推奨用途と整合するか
- レスポンスは構造化 JSON で返させる:
  ```json
  {
    "checks": [
      {"category": "operating_envelope", "result": "pass", "detail": "..."},
      {"category": "light_load", "result": "pass", "detail": "..."},
      ...
    ]
  }
  ```

### 5.2 救済モード戦略の可視化

**現状**: 「no viable candidate → 緩和」の流れが UI には出るが、救済戦略の分類（緩和/カテゴリ切替/妥協候補）が不明瞭。

**改修**: 救済モードに入ったら、Agent が選んだ戦略を明示。

```
🚨 候補ゼロ → 救済モード発動
戦略選択: 「戦略A: 条件緩和」を選択
  理由: NOTES に「ノイズ小さい方がいい」とあり、カテゴリ切替は回避。
       まずパッケージを SOT-23 → SOT-223 に緩和して再試行。

[戦略オプション一覧]
  🟢 戦略A: 条件緩和  ← 選択中
  ⚪ 戦略B: カテゴリ切替（LDO → DC/DC）
  ⚪ 戦略C: 妥協候補提示（最も惜しい候補 + 不足項目）
```

---

## 6. データシート抽出項目の更新（仮データ投入用）

手動で8部品分を打ち込む際、以下を確実に入れる:

### 6.1 parts テーブル
- `part_number`, `manufacturer`, `category`, `package`
- `max_ratings`: `{"Vin_max":..., "Iout_max":..., "Tj_max":...}`
- `specs`: `{"Vin_min":..., "fsw_typical":..., "noise_uVrms":...}`
- `lifecycle_status`: `"active"` （デモ全部これで OK）
- `release_year`: 実際の年（TI 製品なら 2012-2020 が多い）
- `price_1k_usd`: Digi-Key で検索した値（デモなので目安でOK）
- `features`: 例 `["sync_rect", "enable", "pg"]`
- `theta_ja`: データシートの Thermal Information 表から
- `package_dimensions`: JEDEC 標準寸法

### 6.2 curves + data_points
- DC/DC は主要2曲線: `efficiency_vs_iout` (@Tj=25℃), `efficiency_vs_iout` (@Tj=85℃)
- LDO は主要2曲線: `noise_vs_frequency`, `dropout_vs_iout`
- 各曲線 5-10 点を手動で読み取り

### 6.3 operating_envelope
- `Vin`, `Iout`, `Tj` の推奨範囲を Recommended Operating Conditions 表から転記

---

## 7. プロンプト変更例（LLM Agent 向け）

### 7.1 System Prompt（変更後）

```
あなたは電子部品推薦 Agent です。以下のルールに従ってください:

1. **スコア表示**: 必須制約（pass/fail）と最適化達成度（目標に対する実績のマージン%）を
   分けて提示すること。0.0-1.0 の単一スコアは使わない。

2. **Evidence**: すべての数値には出典を明示せよ。
   形式: 「効率 94.4% (データシート p.7 Fig.5, Vin=12V, Tj=25℃ 条件)」

3. **緩和**: 緩和が必要な場合、ユーザーの NOTES に記載された優先項目を
   最後に緩めること。緩和は最小刻みから試すこと。

4. **パッケージ**: ユーザー指定パッケージで候補ゼロの場合、
   熱設計余裕のため段階的に大きいパッケージに拡張せよ。

5. **多面評価**: 候補ごとに以下 5 項目をチェックせよ:
   - Recommended Operating Conditions に入っているか
   - 軽負荷・高温での注意書きの有無
   - Errata の有無
   - Application Note の推奨用途との整合
   - ライフサイクル（active/NRND/EOL）

6. **救済モード**: 候補ゼロの場合、選んだ戦略（A:緩和 / B:カテゴリ切替 / C:妥協候補）
   と選択理由を明示せよ。

7. **内部エラー**: LLM 応答異常等の内部エラーメッセージをユーザー向け出力に
   含めてはならない。統一メッセージに置換せよ。
```

### 7.2 構造化出力スキーマ

```json
{
  "main_recommendation": {
    "part_id": 1,
    "part_number": "TPS62090",
    "mandatory_checks": [
      {"param": "Vin_max", "required": 12, "actual": 20, "pass": true}
    ],
    "optimization_metrics": [
      {
        "metric": "efficiency_at_1A",
        "target": 0.90,
        "actual": 0.944,
        "margin_pct": 4.4,
        "evidence": {"curve_id": 101, "page": 7, "figure": "Figure 5"}
      }
    ],
    "llm_multifaceted_eval": {
      "checks": [...],
      "pass_count": 5,
      "total": 5
    }
  },
  "alternatives": [...],
  "relaxation_history": [...],
  "rescue_mode": null  // or {"strategy": "A", "reason": "..."}
}
```

---

## 8. UI 改修のモック（テキストベース）

### 8.1 通常ケース（候補あり）

```
┌─────────────────────────────────────────────────────┐
│ 🏆 推薦: TPS62090                                    │
├─────────────────────────────────────────────────────┤
│ 必須制約                                              │
│   ✓ Vin_max (20V ≥ 12V)                              │
│   ✓ Iout_max (3A ≥ 1A)                               │
│   ✓ Tj_max (150℃ ≥ 125℃)                            │
│   ✓ Package (QFN-10 ∈ {QFN-10, SO-8, TSOP-8})        │
│   4/4 passes                                          │
├─────────────────────────────────────────────────────┤
│ 最適化達成度                                          │
│   効率 @1A   目標 ≥90%  実績 94.4%  ✓ +4.4%          │
│     📄 p.7 Fig.5 (Vin=12V, Tj=25℃)                   │
│   fsw        目標 ≥500kHz 実績 2.5MHz ✓              │
├─────────────────────────────────────────────────────┤
│ LLM 多面評価                                          │
│   ✓ 推奨動作領域  ✓ 軽負荷  ✓ 高温  ✓ errata なし   │
│   ✓ App Note: 車載向け推奨                            │
├─────────────────────────────────────────────────────┤
│ 候補比較                                              │
│ | 項目     | TPS62090 | TPS62130 | LMR33630 |        │
│ | 効率     | 94.4%    | 93.8%    | 93.9%    |        │
│ | Tj 余裕  | 25℃      | 15℃      | 30℃      |        │
│ | パッケ   | QFN-10   | QFN-16   | SO-P-8   |        │
│ | 価格     | $0.82    | $1.15    | $0.95    |        │
└─────────────────────────────────────────────────────┘
```

### 8.2 救済モード発動ケース

```
┌─────────────────────────────────────────────────────┐
│ 🚨 候補ゼロ → 救済モード                              │
├─────────────────────────────────────────────────────┤
│ 戦略選択: A. 条件緩和                                 │
│ 理由: NOTES「ノイズ小さい方がいい」を優先保持。        │
│      まずパッケージを SOT-23 → SOT-223 に拡大。       │
├─────────────────────────────────────────────────────┤
│ 緩和履歴                                              │
│   Round 1: SOT-23 指定 → 0件                          │
│   Round 2: パッケージ SOT-23 → SOT-223 → 0件          │
│   Round 3: Vdropout_max 300mV → 400mV → 2件           │
├─────────────────────────────────────────────────────┤
│ 🏆 推薦: TLV73333 (緩和後)                            │
│   ※ ユーザー要件の Vdropout_max を 33% 緩和して発見   │
└─────────────────────────────────────────────────────┘
```

---

## 9. 実装順序と見積もり

| フェーズ | 内容 | 見積もり | 担当 |
|---|---|---|---|
| Phase 1 | DB スキーマ追加（DDL 実行、仮データ手動投入） | 0.5日 | polaris-circuit 担当 |
| Phase 2 | P0 改修（スコア2階建て、比較テーブル、エラー非表示、緩和刻み、緩和順序） | 1.5日 | polaris-circuit 担当 |
| Phase 3 | P1 改修（evidence ログ、曲線補間、パッケージ緩和） | 1.5日 | polaris-circuit 担当 |
| Phase 4 | P2 改修（LLM 多面評価、救済モード可視化） | 1日 | polaris-circuit 担当 |
| Phase 5 | 動作確認、デモ用シナリオ 10 件でリグレッション | 0.5日 | polaris-circuit 担当 |
| **合計** | | **5日** | |

---

## 10. 評価計画（改修後のリグレッションテスト）

改修後、以下 10 シナリオで期待挙動を確認する:

| # | 入力 | 期待挙動 |
|---|------|---------|
| 1 | 12V→3.3V, 1A, 効率90%↑ | TPS62090 推薦、必須✓、効率94.4% evidence 付き |
| 2 | 12V→3.3V, 500mA, 効率90%↑, SO-8, fsw 500kHz↑ | 緩和1回で TPS54331、緩和履歴 UI 表示 |
| 3 | 5V→3.3V, 300mA, Vdrop≤300mV, 低ノイズ, SOT-23 | 救済モード「戦略A: パッケージ緩和」を選択 |
| 4 | 12V→3.3V, 50mA, ノイズ10μVrms以下, SOT-23 | 緩和を段階的に（10→15→20→30）、最終「該当なし、最も惜しい候補」|
| 5 | 24V→12V, 3A, 効率90%↑ | DC/DC 推薦、evidence 付き |
| 6 | 5V→3.3V, 100mA, 超低ノイズ | LDO 推薦（LP5907 or TPS7A47） |
| 7 | 5V→1.8V, 500mA | カテゴリ自動判定（DC/DC）|
| 8 | 12V→3.3V, 50mA, 低ノイズ | カテゴリ切替（LDO） |
| 9 | 100V→12V, 1A | 候補なし、救済モード「妥協候補提示」|
| 10 | 3.3V→2.5V, 100mA, ドロップアウト極低 | LDO ドロップアウト特性評価 |

各シナリオで以下を確認:
- [ ] スコア2階建て表示が機能
- [ ] 比較テーブルが 3 件表示
- [ ] Evidence ログに出典ページ・図番号
- [ ] 緩和がある場合、順序がユーザー NOTES を尊重
- [ ] 救済モード時、戦略選択と理由を明示
- [ ] 内部エラーメッセージが UI に露出しない

---

## 11. 参考: DIVE 論文との差分

本改修は DIVE 論文（2026, RSC）のワークフローを電子部品選定にアダプトしたもの。差分は以下:

| 項目 | DIVE 論文 | polaris-circuit |
|---|---|---|
| 対象 | 未知の新組成を設計 | 既存部品から選定 |
| XGBoost による性能予測 | 必須（未知組成のため） | **不要**（既存部品の性能はデータシートに記載済） |
| DB 規模 | 30,435 エントリ | 8-15 部品（デモ） |
| VLM による図抽出 | Stage 1-3 の3段階 | `vlm-plot-extractor` で代替、今回は手動投入 |
| Agent ループ | DB 検索 + XGBoost + LLM | DB 検索 + 曲線補間 + LLM |

**本命（将来）の差別化**:
- 「データシート熟読」を evidence log で可視化
- 曲線補間で「条件点の実値」を返す（スペック値ではない）
- LLM 多面評価で「数値 OK だが文脈 NG」を弾く

---

# handoff
handoff:
  - to: polaris-circuit 担当チーム
    context: "本仕様書に基づき Phase 1-5 を順次実装。5日見積もり"
    tasks:
      - "Phase 1: DB スキーマ追加 + 8 部品分の仮データ手動投入"
      - "Phase 2: P0 改修（UI スコア2階建て、比較テーブル、エラー非表示、緩和刻み/順序）"
      - "Phase 3: P1 改修（evidence ログ、scipy による曲線補間、パッケージ緩和）"
      - "Phase 4: P2 改修（LLM 多面評価チェック UI、救済モード戦略可視化）"
      - "Phase 5: 10 シナリオでリグレッションテスト"
  - to: PM 部
    tasks:
      - "polaris-circuit 改修タスクを Supabase tasks テーブルに登録"
      - "Phase 1-5 をマイルストーンとしてトラッキング"
