# 統合ワークスペース実装計画

## 概要
仕様書・ブロック図・回路図・BOM・検証の5ステップが1画面で完結し、右側にAIチャットパネルを配置した統合ワークスペースを実装する。

## UI構成
```
+------------------+----------------------------------+------------------+
| プロセス          |                                  |                  |
| ナビゲーション     |     メインコンテンツ              |  AIチャット       |
| (縦タブ)          |     (選択中のステップ)            |  パネル          |
|                  |                                  |                  |
| 1. 仕様書 ✓      |  +--------------------------+   |  コンテキスト選択 |
| 2. ブロック図 ●   |  | [Step 2: ブロック図]     |   |  会話履歴        |
| 3. 回路図         |  | - Mermaid図              |   |  入力欄          |
| 4. BOM           |  | - ブロック詳細           |   |                  |
| 5. 検証          |  +--------------------------+   |                  |
+------------------+----------------------------------+------------------+
```

---

## 実装計画

### Phase 1: 新コンポーネント作成

#### 1.1 CircuitSchematicPanel（回路図パネル）
**ファイル:** `frontend/src/components/workspace/CircuitSchematicPanel.tsx`

```typescript
interface CircuitSchematicPanelProps {
  projectId: string;
  blocks: CircuitBlock[];
  specification: RoughSpecificationResponse | null;
}
```

機能:
- ブロック選択 → そのブロックの回路図をSVGで生成・表示
- 生成ボタン押下でLLM呼び出し
- 既存API `useGenerateSchematic()` を使用

#### 1.2 BOMPanel（部品表パネル）
**ファイル:** `frontend/src/components/workspace/BOMPanel.tsx`

```typescript
interface BOMPanelProps {
  projectId: string;
  blocks: CircuitBlock[];
  schematics: CircuitSchematic[];
}
```

機能:
- 全ブロックのBOMを集約表示
- テーブル形式（Reference, Type, Value, Package, Manufacturer, Qty）
- CSVエクスポートボタン
- コスト集計表示

#### 1.3 VerificationPanel（検証パネル）
**ファイル:** `frontend/src/components/workspace/VerificationPanel.tsx`

機能:
- 設計チェックリスト表示
- 仕様との整合性確認
- 警告・推奨事項の表示

#### 1.4 IntegratedChatPanel（統合チャットパネル）
**ファイル:** `frontend/src/components/workspace/IntegratedChatPanel.tsx`

既存ChatPanelを改修:
- フローティングではなく固定配置
- 現在のステップに応じたコンテキスト自動選択
- 全プロセスのデータをコンテキストに含む

---

### Phase 2: ワークスペースページ改修

#### 2.1 統合ワークスペース
**ファイル:** `frontend/src/app/projects/[projectId]/workspace/page.tsx`

現在の2ペイン構成を3カラムに変更:

```tsx
<div className="h-full flex">
  {/* 左: プロセスナビゲーション */}
  <ProcessSidebar
    currentStep={activeStep}
    onStepChange={setActiveStep}
    processStates={processStates}
  />

  {/* 中央: ステップコンテンツ */}
  <main className="flex-1 overflow-hidden">
    {activeStep === 'specification' && <SpecificationPanel ... />}
    {activeStep === 'block_diagram' && <DiagramPanel ... />}
    {activeStep === 'circuit_schematic' && <CircuitSchematicPanel ... />}
    {activeStep === 'bom' && <BOMPanel ... />}
    {activeStep === 'verification' && <VerificationPanel ... />}
  </main>

  {/* 右: AIチャット */}
  <IntegratedChatPanel
    specification={specification}
    blockDiagram={blockDiagram}
    schematics={schematics}
  />
</div>
```

#### 2.2 プロセスサイドバー
**ファイル:** `frontend/src/components/workspace/ProcessSidebar.tsx`

```typescript
const PROCESS_STEPS = [
  { id: 'specification', name: '仕様書', icon: FileText },
  { id: 'block_diagram', name: 'ブロック図', icon: Layers },
  { id: 'circuit_schematic', name: '回路図', icon: Cpu },
  { id: 'bom', name: 'BOM', icon: List },
  { id: 'verification', name: '検証', icon: CheckCircle },
];
```

---

### Phase 3: 状態管理

#### 3.1 ワークスペース状態
統合ワークスペースでの状態共有:

```typescript
// 各ステップの出力データ
const [specification, setSpecification] = useState<RoughSpecificationResponse | null>(null);
const [blockDiagram, setBlockDiagram] = useState<BlockDiagramGenerateResponse | null>(null);
const [schematics, setSchematics] = useState<Map<string, CircuitSchematic>>(new Map());
const [activeStep, setActiveStep] = useState<ProcessStep>('specification');
```

#### 3.2 データフロー
```
仕様書 ──────> ブロック図 ──────> 回路図 ──────> BOM ──────> 検証
   │               │                │            │
   │               │                │            │
   └───────────────┴────────────────┴────────────┴──> AIチャット
                        (全データをコンテキストに)
```

---

## 変更対象ファイル

### 新規作成
- `frontend/src/components/workspace/ProcessSidebar.tsx`
- `frontend/src/components/workspace/CircuitSchematicPanel.tsx`
- `frontend/src/components/workspace/BOMPanel.tsx`
- `frontend/src/components/workspace/VerificationPanel.tsx`
- `frontend/src/components/workspace/IntegratedChatPanel.tsx`

### 修正
- `frontend/src/app/projects/[projectId]/workspace/page.tsx` - 3カラムレイアウトに変更

### 既存活用（変更なし）
- `frontend/src/components/workspace/SpecificationPanel.tsx`
- `frontend/src/components/workspace/DiagramPanel.tsx`
- `frontend/src/lib/api/circuit-schematic.ts`
- `frontend/src/lib/api/chat.ts`

---

## 実装順序

1. **ProcessSidebar** - プロセスナビゲーション
2. **IntegratedChatPanel** - ChatPanelを固定配置版に改修
3. **workspace/page.tsx** - 3カラムレイアウト
4. **CircuitSchematicPanel** - 回路図生成・表示
5. **BOMPanel** - 部品表表示
6. **VerificationPanel** - 検証チェックリスト

---

## 検証方法

1. **型チェック**
   ```bash
   cd frontend && npm run type-check
   ```

2. **UI動作確認**
   - プロジェクト選択 → ワークスペース表示
   - 左サイドバーでステップ切り替え
   - 各ステップのデータ生成・表示
   - 右チャットパネルで質問可能

3. **データフロー確認**
   - 仕様書作成 → ブロック図生成に自動反映
   - ブロック図完成 → 回路図生成可能
   - 全データがチャットコンテキストに含まれる
