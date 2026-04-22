# バッチ分類プロンプトが[correction]として誤検知

- **type**: `failure`
- **date**: 2026-04-12
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch

## what_happened
Hookのfailure-signal検出器が、バッチ処理で呼ばれるプロンプト分類・成長記録アナリストのシステムプロンプトを「修正フィードバック」として279件も記録している。実際はユーザーからの修正ではなく、claude --print経由のバッチLLM呼び出しのプロンプト本文。

## root_cause
failure-signal検出ロジックが、ユーザープロンプトとバッチ/サブプロセス経由のLLM呼び出しプロンプトを区別していない。claude CLIでバッチ実行される分類タスクのinputを[correction]シグナルとして誤分類している。

## countermeasure
signal検出hookで (1) プロンプト送信元(インタラクティブ vs バッチ)を識別、(2) 分類・アナリスト系の既知システムプロンプトをパターン除外、(3) claude --print 由来のプロンプトはシグナル収集対象から除外する。該当hookスクリプトを特定して除外ルールを追加。

<!-- id: 781b690b-af9c-4f7d-9ec5-c3390756984a -->
