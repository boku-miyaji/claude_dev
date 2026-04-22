# Foundry Markings代替は構造分離+RBAC+マスキング

- **type**: `decision`
- **date**: 2026-04-13
- **category**: architecture / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: rikyu, security, llm-retroactive, llm-classified

## what_happened
SOMPOケア案件でSnowflake/Databricksへの移行検討時、Foundry Markingsの完全代替は諦め、要配慮データのスキーマ分離、RBAC/ABAC、マスキングポリシーの3層組み合わせを両基盤共通の現実解として採用する方針を決定。

## result
Snowflake/Databricks両方で実現可能なアクセス制御アーキテクチャを確立

<!-- id: 420cedf6-ba5d-461d-9b36-be1a6debc7ee -->
