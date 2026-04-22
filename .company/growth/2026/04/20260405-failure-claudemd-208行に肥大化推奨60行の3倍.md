# CLAUDE.md 208行に肥大化（推奨60行の3倍）

- **type**: `failure`
- **date**: 2026-04-05
- **category**: process / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: claude-md, harness

## what_happened
手順的記述を全てCLAUDE.mdに直書き→指示が埋もれ遵守率低下

## root_cause
分離する仕組みがなかった

## countermeasure
rules/に分離+PostToolUse Hookで200行超警告

## result
208行→64行に削減

<!-- id: 388374b0-d6c0-418f-9503-e1eee8700cfd -->
