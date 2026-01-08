---
allowed-tools: >
  Bash(mkdir:*),
  Bash(cat:*),
  Write(*),
  Read(*)
description: |
  新しいリポジトリ作成時にdocs配下の雛形ディレクトリとREADMEを作成する
  引数: プロジェクト名 (例: /init-docs my-project)
---

## 引数

$ARGUMENTS

## 実行手順 🤖

### 1. プロジェクト名の取得

引数からプロジェクト名を取得します。引数がない場合は現在のディレクトリ名を使用します。

```bash
PROJECT_NAME="${1:-$(basename $(pwd))}"
echo "📦 プロジェクト名: $PROJECT_NAME"
```

### 2. docsディレクトリ構造の作成

標準的なドキュメント構造を作成します。

```bash
mkdir -p docs/{00-specifications/{designs,diff},01-getting-started,02-architecture,03-features,04-api-reference,05-external-services,06-deployment,07-contributing,08-security}
```

### 3. 各セクションのREADME.mdを作成

#### docs/README.md (メインドキュメント)

```markdown
# ${PROJECT_NAME} Documentation

**Version**: 0.1.0 | **Last Updated**: $(date +%Y-%m-%d)

[Brief description of the project]

---

## Quick Navigation

| Section | Description |
|---------|-------------|
| [Specifications](./00-specifications/README.md) | Requirements and design documents |
| [Getting Started](./01-getting-started/README.md) | Setup guides for local development |
| [Architecture](./02-architecture/README.md) | System design and tech stack |
| [Features](./03-features/README.md) | Feature specifications |
| [API Reference](./04-api-reference/README.md) | API documentation |
| [External Services](./05-external-services/README.md) | External service integrations |
| [Deployment](./06-deployment/README.md) | Docker and CI/CD guides |
| [Contributing](./07-contributing/README.md) | Development guidelines |
| [Security](./08-security/README.md) | Security and privacy |

---

## What is ${PROJECT_NAME}?

[Add project description here]

---

## Quick Start

\`\`\`bash
# Clone
git clone https://github.com/YOUR_USERNAME/${PROJECT_NAME}.git
cd ${PROJECT_NAME}

# Install
npm install

# Configure
cp .env.example .env

# Run
npm run dev
\`\`\`

---

## Documentation Structure

\`\`\`
docs/
├── README.md                      # This file
│
├── 00-specifications/             # Requirements & Design
│   ├── README.md                  # Overview
│   ├── requirements.md            # Requirements definition
│   ├── functional-spec.md         # Functional specifications
│   ├── designs/                   # Design documents
│   └── diff/                      # Specification diffs
│
├── 01-getting-started/            # Setup & Configuration
│   ├── README.md                  # Overview
│   ├── local-setup.md             # Local development
│   └── environment-variables.md   # Configuration reference
│
├── 02-architecture/               # System Design
│   ├── README.md                  # Architecture overview
│   ├── tech-stack.md              # Technology stack
│   └── data-model.md              # Data model/ER diagram
│
├── 03-features/                   # Feature Specifications
│   └── README.md                  # Feature overview
│
├── 04-api-reference/              # API Documentation
│   └── README.md                  # API overview
│
├── 05-external-services/          # Service Integrations
│   └── README.md                  # Services overview
│
├── 06-deployment/                 # Deployment Guides
│   ├── README.md                  # Deployment overview
│   ├── docker.md                  # Docker configuration
│   └── ci-cd.md                   # GitHub Actions
│
├── 07-contributing/               # Development Guide
│   └── README.md                  # Contributing guidelines
│
└── 08-security/                   # Security & Privacy
    └── README.md                  # Security overview
\`\`\`

---

## License

[Add license information]

---

**Maintained by**: [Your Name]
```

#### 00-specifications/README.md

```markdown
# Specifications

Requirements and design documents.

## Contents

- [Requirements](./requirements.md) - Feature requirements and acceptance criteria
- [Functional Spec](./functional-spec.md) - Detailed functional specifications
- [Designs](./designs/) - Design documents and ADRs
- [Diffs](./diff/) - Specification change tracking
```

#### 01-getting-started/README.md

```markdown
# Getting Started

Setup guides for local development.

## Contents

- [Local Setup](./local-setup.md) - Local development environment setup
- [Environment Variables](./environment-variables.md) - Configuration reference

## Prerequisites

- Node.js 18+
- npm or yarn
- [Other prerequisites]

## Quick Start

\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`
```

#### 02-architecture/README.md

```markdown
# Architecture

System design and technical architecture.

## Contents

- [Tech Stack](./tech-stack.md) - Technology choices and rationale
- [Data Model](./data-model.md) - Database schema and relationships

## Overview

[High-level architecture description]
```

#### 03-features/README.md

```markdown
# Features

Feature specifications and implementation details.

## Feature List

| Feature | Status | Description |
|---------|--------|-------------|
| [Feature 1] | 🔜 Planned | [Description] |
```

#### 04-api-reference/README.md

```markdown
# API Reference

API documentation and reference.

## Base URL

\`\`\`
http://localhost:3000/api
\`\`\`

## Authentication

[Authentication method]

## Endpoints

[List of endpoints]
```

#### 05-external-services/README.md

```markdown
# External Services

External service integrations and setup.

## Services

[List of external services]
```

#### 06-deployment/README.md

```markdown
# Deployment

Deployment guides and configuration.

## Contents

- [Docker](./docker.md) - Docker configuration
- [CI/CD](./ci-cd.md) - GitHub Actions setup

## Deployment Options

- Local development
- Docker
- Cloud platforms
```

#### 07-contributing/README.md

```markdown
# Contributing

Development guidelines and contribution workflow.

## Development Workflow

1. Create a feature branch
2. Make changes
3. Write tests
4. Submit PR

## Code Style

Follow the project's code style guidelines.

## Commit Convention

Use Conventional Commits format:

- \`feat:\` New features
- \`fix:\` Bug fixes
- \`docs:\` Documentation
- \`test:\` Tests
- \`refactor:\` Refactoring
```

#### 08-security/README.md

```markdown
# Security

Security and privacy guidelines.

## Security Practices

[Security best practices for this project]

## Reporting Security Issues

[How to report security vulnerabilities]
```

### 4. 各セクションごとに個別ファイルを作成

これらの詳細ファイルは、プロジェクトの進行に応じて段階的に作成していきます。

### 5. 完了メッセージ

```bash
echo "✅ ドキュメント雛形の作成が完了しました"
echo ""
echo "📂 作成されたディレクトリ構造:"
tree docs -L 2
echo ""
echo "📝 次のステップ:"
echo "  1. docs/README.md のプロジェクト説明を編集"
echo "  2. 各セクションの README.md に詳細を追加"
echo "  3. 必要に応じて個別のドキュメントファイルを作成"
```

## 使用例

```bash
# プロジェクト名を指定して実行
/init-docs my-awesome-project

# 引数なし（現在のディレクトリ名を使用）
/init-docs
```

## 生成されるディレクトリ構造

```
docs/
├── README.md
├── 00-specifications/
│   ├── README.md
│   ├── designs/
│   └── diff/
├── 01-getting-started/
│   └── README.md
├── 02-architecture/
│   └── README.md
├── 03-features/
│   └── README.md
├── 04-api-reference/
│   └── README.md
├── 05-external-services/
│   └── README.md
├── 06-deployment/
│   └── README.md
├── 07-contributing/
│   └── README.md
└── 08-security/
    └── README.md
```

## 注意事項

- 既存の docs ディレクトリがある場合は上書きしません
- プロジェクトの性質に応じて不要なセクションは削除してください
- テンプレートは基本的な構造のみで、詳細は後から追加していきます
