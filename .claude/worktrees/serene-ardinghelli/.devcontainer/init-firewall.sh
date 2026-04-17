#!/usr/bin/env bash
set -euo pipefail
set -x                      # デバッグ：実行コマンドを表示
IFS=$'\n\t'

### 0. クリア
iptables -F; iptables -X
iptables -t nat -F; iptables -t nat -X
iptables -t mangle -F; iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

### 1. 必須ポート許可
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT          # DNS
iptables -A INPUT  -p udp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT          # SSH
iptables -A INPUT  -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
iptables -A INPUT  -i lo -j ACCEPT; iptables -A OUTPUT -o lo -j ACCEPT

### 2. ipset 作成
ipset create allowed-domains hash:net

### 3. GitHub IP を追加（重複許容）
gh_meta=$(curl -fsSL https://api.github.com/meta)
echo "$gh_meta" | jq -e '.web and .api and .git' >/dev/null

echo "Adding GitHub CIDR …"
echo "$gh_meta" |
  jq -r '(.web + .api + .git + .packages + .container_registries)[]' |
  aggregate -q |
  grep -E '^([0-9]+\.){3}[0-9]+/[0-9]+$' |
  while read -r cidr; do
      ipset add allowed-domains "$cidr" -exist    # ← ★重複でも OK
  done

### 4. ドメイン → IPv4（CNAME 再帰 1 段）
resolve_ipv4() {
  local h=$1 ip
  ip=$(dig +short A "$h" | grep -m1 -Eo '([0-9]+\.){3}[0-9]+')
  if [ -z "$ip" ]; then
    local cname=$(dig +short CNAME "$h" | head -n1)
    [ -n "$cname" ] && ip=$(dig +short A "$cname" | grep -m1 -Eo '([0-9]+\.){3}[0-9]+')
  fi
  echo "$ip"
}

domains=(
  vscode.cdn.azureedge.net
  az764295.vo.msecnd.net
  gallerycdn.vsassets.io
  ghcr.io
  registry.npmjs.org
  api.anthropic.com
  sentry.io
  statsig.anthropic.com
  statsig.com
  api.openai.com
  auth.openai.com
  cdn.openai.com
  api.cursor.dev
  chat.cursor.dev
  cdn.anthropic.com
)

for d in "${domains[@]}"; do
  echo "Resolving $d …"
  if ip=$(resolve_ipv4 "$d"); [[ -n $ip ]]; then
      ipset add allowed-domains "$ip" -exist       # ← ★重複でも OK
      echo "  → $ip"
  else
      echo "  ⚠  IPv4 未取得（CNAME だけ）: $d ― スキップ"
  fi
done

### 5. ホスト ⇆ コンテナ
HOST_IP=$(ip route | awk '/default/ {print $3; exit}')
HOST_NET=${HOST_IP%.*}.0/24
iptables -A INPUT  -s "$HOST_NET" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NET" -j ACCEPT

### 6. ポリシー = DROP → ホワイトリスト通過
iptables -P INPUT DROP; iptables -P OUTPUT DROP; iptables -P FORWARD DROP
iptables -A INPUT  -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

echo "✅ Firewall rules applied"

### 7. 動作テスト
curl -fsSL --connect-timeout 5 https://example.com >/dev/null 2>&1 && {
  echo "❌ example.com に繋がった → 失敗"; exit 1; } || echo "🛡 example.com ブロック OK"

curl -fsSL --connect-timeout 5 https://api.github.com/zen >/dev/null && \
  echo "✅ GitHub API 通過 OK" || { echo "❌ GitHub API に繋がらない"; exit 1; }
