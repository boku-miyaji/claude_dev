# カスケード更新機能 実装計画

## 概要

プロセス間の依存関係を管理し、途中からの入力や出力の修正が後続プロセスに自動伝播する仕組みを実装する。

## 要件

1. **途中入力**: 任意のプロセスステップから直接データを入力できる
   - 例: ラフ仕様書を直接入力 → ブロック図以降が更新対象になる
2. **カスケード更新**: 出力が修正されると、依存する後続プロセスが「stale」状態になる
3. **状態管理**: 各プロセスの状態（empty/valid/stale/pending/error）を追跡

## プロセス依存チェーン

```
Specification → Block Diagram → Detailed Diagram → Component Selection
(仕様決め)      (回路ブロック図)   (詳細回路図)        (主要部品選定)
```

---

## データベース設計

### 1. 新規テーブル: `process_states`

プロジェクトごとの各プロセスの現在状態を追跡

```python
class ProcessState(Base):
    __tablename__ = "process_states"

    id: UUID
    project_id: UUID (FK → projects)
    process_id: str (FK → process_definitions)
    current_execution_id: UUID (FK → process_executions, nullable)

    state: str  # empty, valid, stale, pending, error
    version: int  # 更新ごとにインクリメント
    input_version: int  # 上流プロセスのバージョン（生成時点）

    is_manual_input: bool  # 手動入力かどうか
    last_updated_at: datetime
    invalidated_at: datetime (nullable)
    invalidated_by_process_id: str (nullable)
```

### 2. 新規テーブル: `process_dependencies`

プロセス間の依存関係を定義

```python
class ProcessDependency(Base):
    __tablename__ = "process_dependencies"

    id: int (auto)
    upstream_process_id: str (FK)
    downstream_process_id: str (FK)
    is_required: bool = True
```

初期データ:
- specification_generation → block_diagram
- block_diagram → detailed_block_diagram
- detailed_block_diagram → component_selection

### 3. ProcessExecution への追加カラム

```python
# 既存テーブルに追加
parent_execution_id: UUID (FK, nullable)  # リファイン時の親
version: int = 1
is_manual_override: bool = False
```

---

## サービス層

### CascadeService (`backend/src/services/cascade.py`)

```python
class CascadeService:
    def get_project_state(project_id) -> dict:
        """プロジェクトの全プロセス状態を取得"""

    def invalidate_downstream(project_id, source_process_id, auto_cascade=False) -> list[str]:
        """下流プロセスを stale にマーク"""

    def update_process_state(project_id, process_id, execution_id, is_manual=False):
        """プロセス状態を更新（valid にセット、バージョンインクリメント）"""

    def get_cascade_preview(project_id, source_process_id) -> list:
        """更新の影響範囲をプレビュー"""

    def trigger_cascade(project_id, target_process_ids=None) -> list[UUID]:
        """stale プロセスの再生成をトリガー"""
```

### ProcessStateService (`backend/src/services/process_state.py`)

```python
class ProcessStateService:
    def get_current_output(project_id, process_id) -> dict | None:
        """現在の出力データを取得"""

    def get_input_for_process(project_id, process_id) -> dict | None:
        """上流プロセスの出力を入力として取得"""

    def set_manual_input(project_id, process_id, input_data, output_data) -> ProcessExecution:
        """手動入力を設定し、下流を無効化"""
```

---

## API設計

### 新規エンドポイント (`backend/src/routers/process_state.py`)

| Method | Path | 説明 |
|--------|------|------|
| GET | `/{project_id}/state` | プロジェクトの全プロセス状態取得 |
| GET | `/{project_id}/process/{process_id}/data` | 特定プロセスの現在データ取得 |
| GET | `/{project_id}/cascade-preview/{source_process_id}` | カスケード影響範囲プレビュー |
| POST | `/{project_id}/cascade/trigger` | カスケード更新トリガー |
| POST | `/{project_id}/manual-input` | 手動入力（任意プロセスに直接データ設定） |

### レスポンス例: GET /{project_id}/state

```json
{
  "processes": {
    "specification_generation": {
      "state": "valid",
      "version": 2,
      "is_manual_input": false,
      "last_updated_at": "2025-01-12T10:00:00Z",
      "current_execution_id": "uuid..."
    },
    "block_diagram": {
      "state": "stale",
      "version": 1,
      "invalidated_by_process_id": "specification_generation"
    },
    "detailed_block_diagram": { "state": "empty" },
    "component_selection": { "state": "empty" }
  },
  "pending_updates": [],
  "has_stale_processes": true
}
```

### 手動入力 POST /{project_id}/manual-input

```json
// Request
{
  "process_id": "block_diagram",
  "input_data": {},
  "output_data": {
    "blocks": [...],
    "connections": [...],
    "mermaid_diagram": "..."
  }
}

// Response
{
  "execution_id": "uuid...",
  "invalidated_processes": ["detailed_block_diagram", "component_selection"]
}
```

---

## 既存ルーターの修正

各プロセスルーター（specification.py, block_diagram.py等）に以下を追加:

```python
from src.services.cascade import CascadeService

# 処理成功後に追加
cascade_service = CascadeService(db)
cascade_service.update_process_state(
    project_id=project_id,
    process_id="specification_generation",
    execution_id=execution.id,
    is_manual=False,
)
cascade_service.invalidate_downstream(
    project_id=project_id,
    source_process_id="specification_generation",
)
```

---

## 実装ファイル一覧

### 新規作成

| ファイル | 内容 |
|----------|------|
| `backend/src/models/process_state.py` | ProcessState モデル |
| `backend/src/models/process_dependency.py` | ProcessDependency モデル |
| `backend/src/services/cascade.py` | CascadeService |
| `backend/src/services/process_state.py` | ProcessStateService |
| `backend/src/routers/process_state.py` | 状態管理API |
| `backend/src/schemas/process_state.py` | API スキーマ |

### 修正

| ファイル | 変更内容 |
|----------|----------|
| `backend/src/models/process.py` | ProcessExecution に新カラム追加 |
| `backend/src/models/__init__.py` | 新モデルのエクスポート |
| `backend/src/main.py` | 新ルーター登録 |
| `backend/src/init_db.py` | ProcessDependency 初期データ追加 |
| `backend/src/routers/specification.py` | カスケード状態更新追加 |
| `backend/src/routers/block_diagram.py` | カスケード状態更新追加 |
| `backend/src/routers/detailed_block_diagram.py` | カスケード状態更新追加 |
| `backend/src/routers/component_selection.py` | カスケード状態更新追加 |

---

## データフロー

### 1. 通常フロー（前から順に実行）

```
[仕様入力] → Specification valid (v1)
                    ↓ invalidate_downstream
             Block Diagram stale → [生成] → valid (v1, input_v=1)
                                       ↓ invalidate_downstream
                               Detailed Diagram stale → [生成] → valid
                                                             ↓
                                                   Component Selection → valid
```

### 2. 途中入力フロー（ブロック図を直接入力）

```
[ブロック図データ直接入力]
         ↓
  Block Diagram valid (v1, is_manual=true)
         ↓ invalidate_downstream
  Detailed Diagram stale
  Component Selection stale
         ↓ [ユーザーがカスケードトリガー]
  Detailed Diagram valid
  Component Selection valid
```

### 3. 出力修正フロー（仕様を再生成）

```
既存: Spec v1 → Block v1 → Detailed v1 → Component v1
                                        (全て valid)
         ↓
[仕様を再生成]
         ↓
Spec v2 (valid)
Block, Detailed, Component → stale
         ↓ [カスケードトリガー]
Block v2 (再生成, input_v=2)
Detailed v2
Component v2
```

---

## 検証方法

1. **API テスト**
```bash
# プロジェクト状態取得
curl http://localhost:8000/api/v1/projects/{id}/state

# 手動入力（ブロック図を直接設定）
curl -X POST http://localhost:8000/api/v1/projects/{id}/manual-input \
  -H "Content-Type: application/json" \
  -d '{"process_id": "block_diagram", "output_data": {...}}'

# カスケードプレビュー
curl http://localhost:8000/api/v1/projects/{id}/cascade-preview/specification_generation

# カスケード実行
curl -X POST http://localhost:8000/api/v1/projects/{id}/cascade/trigger \
  -d '{"target_process_ids": null}'  # null = 全 stale プロセス
```

2. **シナリオテスト**
   - 仕様→ブロック図→詳細図→部品選定 の順次実行
   - ブロック図の手動入力後、詳細図・部品選定が stale になることを確認
   - カスケードトリガーで下流が再生成されることを確認

3. **E2E テスト**
   - フロントエンドから状態表示・カスケード操作を確認

---

## 実装順序

1. **Phase 1**: モデル追加
   - ProcessState, ProcessDependency モデル作成
   - ProcessExecution 拡張
   - init_db.py に依存関係データ追加

2. **Phase 2**: サービス層
   - CascadeService 実装
   - ProcessStateService 実装

3. **Phase 3**: API追加
   - process_state.py ルーター作成
   - スキーマ作成
   - main.py に登録

4. **Phase 4**: 既存ルーター修正
   - 各プロセスルーターにカスケード更新ロジック追加

5. **Phase 5**: テスト・検証
   - API テスト
   - 一連のフローテスト
