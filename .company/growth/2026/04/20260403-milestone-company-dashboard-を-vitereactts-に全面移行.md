# company-dashboard を Vite+React+TS に全面移行

- **type**: `milestone`
- **date**: 2026-04-03
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: react, vite, migration, dashboard, zustand, focus-you
- **commits**: dcad590, 7bccee5, b834c30, 6989f6f, df8c71d, d050954, 660f103

## what_happened
旧 legacy HTML ベースの company-dashboard を Vite+React+TypeScript にスキャフォールドし、Phase 0〜4 で Shell/Auth、共通UI、カスタムhooks、Tasks/Companies/HowItWorks/Knowledge 等を段階的に React 化。最終的に Zustand で状態管理を集約した。

## root_cause
legacy 実装がスケールせず、システム化して管理をしっかりしたいという社長判断（プロンプト#3-4）でB案（React移行）を選択。

## countermeasure
Phase 0-4 の段階移行 + Vercel 自動デプロイ + Edge Function 経由のAPIキー隠蔽 + Zustand 集中管理。

## result
React ベースの新ダッシュボードが稼働し、以降の機能追加（Self-Focus Platform 等）の土台になった。

<!-- id: eca235e0-d31b-4d94-a457-c25da0e0c3e5 -->
