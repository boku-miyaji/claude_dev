# Docker multi-stage uv の venv path 不一致対策

- **type**: `countermeasure`
- **date**: 2026-05-01
- **category**: devops / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: rikyu, backend, devops, auto-detected, daily-digest

## what_happened
Docker multi-stage build で uv が作成する venv の path が builder と runtime で不一致になり、コンテナ起動時に startup failure を起こした。

## root_cause
multi-stage build で uv の venv 配置 path が stage 間で揃っていなかった

## countermeasure
venv path を stage 間で統一する Dockerfile の修正を実施し、growth に countermeasure として記録。

## result
rikyu MVP のコンテナが Azure 上で正常起動するようになった。

<!-- id: 044a2988-a9f3-4427-9311-858a23f44609 -->
