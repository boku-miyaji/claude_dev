# 07. Frontend Integration - フロントエンド連携設計

> **目的**: フロントエンドとバックエンドの連携パターン、APIクライアント、状態管理を定義

---

## 1. 技術スタック

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Stack                               │
├─────────────────────────────────────────────────────────────────┤
│  Framework    : Next.js 14+ (App Router)                       │
│  Language     : TypeScript                                      │
│  State Mgmt   : TanStack Query (React Query)                   │
│  HTTP Client  : Axios                                          │
│  Styling      : Tailwind CSS                                   │
│  Components   : shadcn/ui                                      │
│  Diagrams     : Mermaid, React Flow                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. ディレクトリ構造

```
frontend/src/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # ルートレイアウト
│   ├── page.tsx                 # ホーム
│   ├── projects/
│   │   ├── page.tsx             # プロジェクト一覧
│   │   ├── new/page.tsx         # 新規作成
│   │   └── [id]/
│   │       ├── page.tsx         # プロジェクト詳細
│   │       └── workspace/
│   │           ├── layout.tsx   # ワークスペースレイアウト
│   │           ├── page.tsx     # 概要
│   │           └── [process]/page.tsx  # プロセスページ
│   └── prompts/
│       └── page.tsx             # プロンプト管理
│
├── components/
│   ├── layout/                  # レイアウト
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── ui/                      # 汎用UI（shadcn/ui）
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Dialog.tsx
│   │   └── ...
│   ├── project/                 # プロジェクト関連
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectList.tsx
│   │   └── ProjectForm.tsx
│   ├── process/                 # プロセス関連
│   │   ├── ProcessStepper.tsx
│   │   ├── ProcessPanel.tsx
│   │   └── ProcessStatus.tsx
│   └── diagram/                 # 図表関連
│       ├── MermaidDiagram.tsx
│       └── FlowDiagram.tsx
│
├── lib/
│   ├── api/                     # APIクライアント
│   │   ├── client.ts           # Axiosインスタンス
│   │   ├── projects.ts         # プロジェクトAPI
│   │   ├── processes.ts        # プロセスAPI
│   │   ├── prompts.ts          # プロンプトAPI
│   │   └── metrics.ts          # メトリクスAPI
│   ├── hooks/                   # カスタムフック
│   │   ├── useProject.ts
│   │   ├── useProcess.ts
│   │   └── usePrompt.ts
│   └── utils/
│       ├── format.ts           # フォーマット
│       └── validation.ts       # バリデーション
│
├── types/                       # TypeScript型定義
│   ├── api.ts                  # API共通型
│   ├── project.ts
│   ├── process.ts
│   └── prompt.ts
│
├── config/
│   └── index.ts                # 設定
│
└── styles/
    └── globals.css             # グローバルスタイル
```

---

## 3. APIクライアント

### 3.1 Axiosインスタンス

```typescript
// lib/api/client.ts
import axios, { AxiosError, AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5分（LLM呼び出し用）
});

// リクエストインターセプター
apiClient.interceptors.request.use(
  (config) => {
    // 認証トークン付与
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // デバッグログ
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// レスポンスインターセプター
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response;

      // 401: 認証エラー
      if (status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }

      // エラーレスポンスを整形
      const errorData = data as { error?: { code: string; message: string } };
      throw new ApiError(
        errorData.error?.code || 'UNKNOWN_ERROR',
        errorData.error?.message || 'An error occurred',
        status
      );
    }

    throw new ApiError('NETWORK_ERROR', 'Network error occurred', 0);
  }
);

// カスタムエラークラス
export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

### 3.2 API関数

```typescript
// lib/api/projects.ts
import { apiClient } from './client';
import type { Project, ProjectCreate, ProjectUpdate, PaginatedResponse } from '@/types/project';

export const projectsApi = {
  // 一覧取得
  list: async (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<PaginatedResponse<Project>> => {
    const response = await apiClient.get('/projects', { params });
    return response.data;
  },

  // 詳細取得
  get: async (id: string): Promise<Project> => {
    const response = await apiClient.get(`/projects/${id}`);
    return response.data;
  },

  // 作成
  create: async (data: ProjectCreate): Promise<Project> => {
    const response = await apiClient.post('/projects', data);
    return response.data;
  },

  // 更新
  update: async (id: string, data: ProjectUpdate): Promise<Project> => {
    const response = await apiClient.patch(`/projects/${id}`, data);
    return response.data;
  },

  // 削除
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },
};

// lib/api/processes.ts
import { apiClient } from './client';
import type { ProcessState, ProcessExecution, ProcessInput } from '@/types/process';

export const processesApi = {
  // 全プロセス状態取得
  getStates: async (projectId: string): Promise<ProcessState[]> => {
    const response = await apiClient.get(`/projects/${projectId}/processes`);
    return response.data;
  },

  // プロセス実行
  execute: async (
    projectId: string,
    processId: string,
    input: ProcessInput
  ): Promise<ProcessExecution> => {
    const response = await apiClient.post(
      `/projects/${projectId}/processes/${processId}/execute`,
      input
    );
    return response.data;
  },

  // 実行履歴取得
  getHistory: async (
    projectId: string,
    processId: string
  ): Promise<ProcessExecution[]> => {
    const response = await apiClient.get(
      `/projects/${projectId}/processes/${processId}/history`
    );
    return response.data;
  },

  // 状態リセット
  reset: async (
    projectId: string,
    processId: string,
    cascade?: boolean
  ): Promise<void> => {
    await apiClient.post(
      `/projects/${projectId}/processes/${processId}/reset`,
      { cascade }
    );
  },
};
```

---

## 4. TanStack Query フック

### 4.1 プロジェクトフック

```typescript
// lib/hooks/useProject.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import type { Project, ProjectCreate, ProjectUpdate } from '@/types/project';

// クエリキー
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: object) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

// プロジェクト一覧
export function useProjects(params?: { page?: number; status?: string }) {
  return useQuery({
    queryKey: projectKeys.list(params || {}),
    queryFn: () => projectsApi.list(params),
  });
}

// プロジェクト詳細
export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsApi.get(id),
    enabled: !!id,
  });
}

// プロジェクト作成
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProjectCreate) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

// プロジェクト更新
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdate }) =>
      projectsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

// プロジェクト削除
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
```

### 4.2 プロセスフック

```typescript
// lib/hooks/useProcess.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { processesApi } from '@/lib/api/processes';
import type { ProcessInput, ProcessExecution } from '@/types/process';

// クエリキー
export const processKeys = {
  all: ['processes'] as const,
  states: (projectId: string) => [...processKeys.all, 'states', projectId] as const,
  history: (projectId: string, processId: string) =>
    [...processKeys.all, 'history', projectId, processId] as const,
};

// プロセス状態一覧
export function useProcessStates(projectId: string) {
  return useQuery({
    queryKey: processKeys.states(projectId),
    queryFn: () => processesApi.getStates(projectId),
    enabled: !!projectId,
    refetchInterval: 5000, // 5秒ごとに自動更新
  });
}

// プロセス実行
export function useExecuteProcess(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      processId,
      input,
    }: {
      processId: string;
      input: ProcessInput;
    }) => processesApi.execute(projectId, processId, input),
    onSuccess: () => {
      // 状態を再取得
      queryClient.invalidateQueries({
        queryKey: processKeys.states(projectId),
      });
    },
  });
}

// 実行履歴
export function useProcessHistory(projectId: string, processId: string) {
  return useQuery({
    queryKey: processKeys.history(projectId, processId),
    queryFn: () => processesApi.getHistory(projectId, processId),
    enabled: !!projectId && !!processId,
  });
}
```

---

## 5. 型定義

```typescript
// types/api.ts
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// types/project.ts
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: Project['status'];
  metadata?: Record<string, unknown>;
}

// types/process.ts
export interface ProcessState {
  processId: string;
  state: 'empty' | 'pending' | 'valid' | 'stale' | 'error';
  version: number;
  lastUpdatedAt: string;
  invalidatedAt: string | null;
  invalidatedBy: string | null;
}

export interface ProcessExecution {
  id: string;
  processId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown> | null;
  reasoning: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ProcessInput {
  data: Record<string, unknown>;
  options?: Record<string, unknown>;
}
```

---

## 6. コンポーネント例

### 6.1 プロセスステッパー

```typescript
// components/process/ProcessStepper.tsx
'use client';

import { useProcessStates } from '@/lib/hooks/useProcess';
import { cn } from '@/lib/utils';

interface ProcessStepperProps {
  projectId: string;
  currentProcess?: string;
  onSelectProcess: (processId: string) => void;
}

const PROCESSES = [
  { id: 'specification', name: '仕様書分析', icon: '📋' },
  { id: 'block_diagram', name: 'ブロック図', icon: '🔲' },
  { id: 'detailed_block', name: '詳細設計', icon: '📐' },
  { id: 'circuit', name: '回路図', icon: '⚡' },
  { id: 'bom', name: 'BOM', icon: '📦' },
];

export function ProcessStepper({
  projectId,
  currentProcess,
  onSelectProcess,
}: ProcessStepperProps) {
  const { data: states, isLoading } = useProcessStates(projectId);

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  const stateMap = new Map(states?.map((s) => [s.processId, s]));

  return (
    <div className="flex items-center space-x-2">
      {PROCESSES.map((process, index) => {
        const state = stateMap.get(process.id);
        const isActive = currentProcess === process.id;
        const isCompleted = state?.state === 'valid';
        const isStale = state?.state === 'stale';
        const isError = state?.state === 'error';

        return (
          <div key={process.id} className="flex items-center">
            {index > 0 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-1',
                  isCompleted ? 'bg-green-500' : 'bg-gray-300'
                )}
              />
            )}
            <button
              onClick={() => onSelectProcess(process.id)}
              className={cn(
                'flex items-center px-3 py-2 rounded-lg transition-colors',
                isActive && 'bg-blue-100 border-blue-500 border',
                isCompleted && !isActive && 'bg-green-50',
                isStale && 'bg-yellow-50',
                isError && 'bg-red-50'
              )}
            >
              <span className="mr-2">{process.icon}</span>
              <span className="text-sm font-medium">{process.name}</span>
              {isCompleted && <span className="ml-2 text-green-500">✓</span>}
              {isStale && <span className="ml-2 text-yellow-500">⚠</span>}
              {isError && <span className="ml-2 text-red-500">✗</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

### 6.2 プロセス実行パネル

```typescript
// components/process/ProcessPanel.tsx
'use client';

import { useState } from 'react';
import { useExecuteProcess } from '@/lib/hooks/useProcess';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';

interface ProcessPanelProps {
  projectId: string;
  processId: string;
  initialInput?: Record<string, unknown>;
}

export function ProcessPanel({
  projectId,
  processId,
  initialInput,
}: ProcessPanelProps) {
  const [input, setInput] = useState(
    JSON.stringify(initialInput || {}, null, 2)
  );
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const executeMutation = useExecuteProcess(projectId);

  const handleExecute = async () => {
    try {
      const parsedInput = JSON.parse(input);
      const execution = await executeMutation.mutateAsync({
        processId,
        input: { data: parsedInput },
      });
      setResult(execution.outputData);
    } catch (error) {
      console.error('Execution failed:', error);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-2">入力</h3>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={15}
          className="font-mono text-sm"
        />
        <Button
          onClick={handleExecute}
          disabled={executeMutation.isPending}
          className="mt-4 w-full"
        >
          {executeMutation.isPending ? '実行中...' : '実行'}
        </Button>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-2">出力</h3>
        {executeMutation.isPending ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : result ? (
          <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : (
          <div className="text-gray-400 text-center py-8">
            実行結果がここに表示されます
          </div>
        )}
      </Card>
    </div>
  );
}
```

---

## 7. 状態管理パターン

### 7.1 サーバー状態 vs クライアント状態

```typescript
// TanStack Query = サーバー状態
// - プロジェクト一覧
// - プロセス状態
// - 実行結果

// useState/useReducer = クライアント状態
// - フォーム入力
// - UI状態（モーダル開閉など）
// - 一時的な選択状態
```

### 7.2 楽観的更新

```typescript
// lib/hooks/useProject.ts

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdate }) =>
      projectsApi.update(id, data),

    // 楽観的更新
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });

      const previousProject = queryClient.getQueryData<Project>(
        projectKeys.detail(id)
      );

      queryClient.setQueryData<Project>(projectKeys.detail(id), (old) => ({
        ...old!,
        ...data,
      }));

      return { previousProject };
    },

    // エラー時にロールバック
    onError: (err, variables, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(
          projectKeys.detail(variables.id),
          context.previousProject
        );
      }
    },

    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(variables.id),
      });
    },
  });
}
```

---

## 8. エラーハンドリング

```typescript
// components/ErrorBoundary.tsx
'use client';

import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <h2 className="text-lg font-semibold text-red-800">エラーが発生しました</h2>
      <p className="mt-2 text-red-600">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        再試行
      </button>
    </div>
  );
}

export function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ReactErrorBoundary
      onReset={reset}
      FallbackComponent={ErrorFallback}
    >
      {children}
    </ReactErrorBoundary>
  );
}
```

---

## 9. 関連ドキュメント

- [06-API-DESIGN.md](./06-API-DESIGN.md) - APIエンドポイント
- [01-SYSTEM-ARCHITECTURE.md](./01-SYSTEM-ARCHITECTURE.md) - 全体構成
