# focus-you マルチユーザー対応 Permission Model 設計（Early Stage）

> 作成: 2026-04-24 | タスク: #137
> MCP Roadmap の Enterprise Readiness（audit trails, SSO, gateway patterns）に備えた早期設計

## 基本方針: Mnemonic Sovereignty（記憶主権）をRLSで表現する

**原則**: ユーザーの日記・記憶・分析データは、そのユーザーのみがアクセスできる。
- 管理者であっても個人の記憶には触れない（RLSで技術的に保証）
- AIエージェントが記憶を読むのは、本人が明示的に許可した文脈のみ

```sql
-- 全個人データテーブルに共通するRLSパターン
CREATE POLICY "owner_only" ON diary_entries
  FOR ALL USING (auth.uid() = user_id);

-- 将来: チーム共有の場合は明示的なshare設定を要求
CREATE POLICY "explicit_share" ON diary_entries
  FOR SELECT USING (
    auth.uid() = user_id
    OR id IN (SELECT item_id FROM shares WHERE grantee_id = auth.uid() AND item_type = 'diary')
  );
```

## MCP Enterprise Readiness への対応計画

### 1. Audit Trails（監査ログ）

**現状**: `activity_log` テーブルに手動記録（Hook経由）  
**目標**: MCP serverレベルで自動記録（誰がどのリソースにいつアクセスしたか）

```
mcp_audit_log テーブル（将来設計）:
  user_id, resource_type, resource_id, action, timestamp, mcp_server, tool_name
```

### 2. SSO Integration

**現状**: Supabase Auth（Google OAuth）のみ  
**目標**: MCP gateway 経由でSSOプロバイダー（SAML/OIDC）と接続可能な設計に

**早期対応**: AuthページでOIDCフロー対応の余地を残す（hardcodeしない）

### 3. Gateway Patterns

**現状**: 各ツール（focus-you, claude_dev）が直接Supabaseに接続  
**目標**: MCP server がゲートウェイになり、アクセス制御・レート制限・監査を一元管理

```
[Claude Code] → [MCP Gateway Server] → [Supabase / External APIs]
                       |
                  audit logging
                  rate limiting
                  permission check
```

## フェーズ計画

| Phase | タイミング | 内容 |
|-------|-----------|------|
| 現在 | - | RLS でオーナー隔離は完成。単一ユーザー本番運用中 |
| Phase 1 | 次 quarter | MCP server 移行（sb.sh → supabase MCP）+ audit_log 自動記録 |
| Phase 2 | 来期 | マルチユーザー招待モデル（shares テーブル設計） |
| Phase 3 | 商用化時 | SSO / OIDC 対応、per-user plan 制御 |

## 既存アーキテクチャとの整合性

- `verify_jwt = false` + 関数内 `getUser()` パターンは新体系でも維持
- Mnemonic Sovereignty: `diary_entries`, `emotion_analysis`, `ceo_insights` の RLS は絶対に外さない
- 管理者バイパス設計は不可。データ修正は本人認証必須

## 参考

- MCP Roadmap: https://modelcontextprotocol.io/development/roadmap
- Mnemonic Sovereignty 概念: ByteRover / Memory Survey 論文（`.company/CLAUDE.md`）
- 現行RLSルール: `.claude/rules/supabase-access.md`
