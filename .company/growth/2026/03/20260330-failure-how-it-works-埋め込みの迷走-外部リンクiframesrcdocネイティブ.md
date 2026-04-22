# How it Works 埋め込みの迷走 — 外部リンク→iframe→srcdoc→ネイティブ

- **type**: `failure`
- **date**: 2026-03-30
- **category**: tooling / **severity**: low
- **status**: resolved
- **source**: manual
- **tags**: tooling, iframe, security-headers, spa, claude-dev
- **commits**: 0718690, 635ccd1, fd10f20, 9ada1d8, 6d402e3

## what_happened
How it Worksページを外部リンクで開く→ダッシュボード内に埋め込みたい→iframeで埋め込み→X-Frame-Options DENYでブロック→SAMEORIGINに変更→srcdoc方式→最終的にネイティブページに書き直し、と4段階の迷走。

## root_cause
最初から「ダッシュボード内に表示する」要件を明確にせず、後付けで埋め込もうとした。

## countermeasure
最終的にレガシーSPA内のネイティブページとして書き直し。iframeの制約を回避。

## result
「どこに表示するか」は最初に決める。後からiframeで埋め込もうとすると、セキュリティヘッダーやCORS問題にぶつかる。

<!-- id: 0ca41974-b989-4824-bea2-a5d0adab46a4 -->
