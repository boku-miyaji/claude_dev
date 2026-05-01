# Docker multi-stage + uv で venv path 不一致による startup 失敗

- **type**: `countermeasure`
- **date**: 2026-05-01
- **category**: devops / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, docker, uv, multi-stage, shebang, container-apps, deploy, manual-record

## what_happened
rikyu MVP の Container Apps deploy 時、'exec /home/rikyu/app/.venv/bin/uvicorn: no such file or directory' で StartUp probe が 113 回失敗。/health に curl が hold する症状で、ingress 設定や DB firewall は正常だが replica が ready にならず到達不能だった。

## root_cause
builder stage で WORKDIR /app + uv sync により /app/.venv にスクリプトが作られ、shebang に絶対パス '#!/app/.venv/bin/python' が焼き込まれる。runtime stage で WORKDIR /home/rikyu/app に変えて /home/rikyu/app/.venv に COPY すると、shebang は元のパスを指したままで /app/.venv/bin/python は runtime に存在しない → uvicorn 起動瞬間に exec failure。

## countermeasure
multi-stage Docker + uv では builder と runtime の WORKDIR/venv path を統一する（両方 /app/.venv）。runtime stage で USER 切替前に /app の所有権を非 root user に渡す。テンプレートとして mvp/api/Dockerfile + mvp/worker/Dockerfile に確定形を残した。同じパターンを使う他 PJ も同じ構造に揃える。

<!-- id: ee369cd7-f945-45bb-8bf4-4637e4b4f3ce -->
