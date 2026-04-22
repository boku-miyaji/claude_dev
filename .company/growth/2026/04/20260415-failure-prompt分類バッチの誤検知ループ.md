# Prompt分類バッチの誤検知ループ

- **type**: `failure`
- **date**: 2026-04-15
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch

## what_happened
プロンプト分類バッチの内部指示文（'Classify each prompt...'）が206件すべて'correction'信号として誤検知され、失敗シグナルとして蓄積された

## root_cause
失敗シグナル収集hookが、バッチ処理のシステムプロンプト内にある'correction'や類似キーワードをユーザー修正と誤認している。バッチ由来のプロンプトとユーザー由来のプロンプトを区別していない

## countermeasure
シグナル収集スクリプトでバッチ処理由来のプロンプト（claude --print経由、分類タスク等）を除外フィルタに追加。session_typeやsourceでフィルタし、同一文言の連続重複もデデュープする

<!-- id: 4d092e0e-2ab7-4930-8c5a-766b08114961 -->
