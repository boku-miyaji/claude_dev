# 投票方式を3-2-1法に固定してUI簡素化

- **type**: `countermeasure`
- **date**: 2025-08-16
- **category**: process / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: ux, simplification
- **commits**: d9a68a9, c4beb90

## what_happened
投票方式の選択を可変にしていたが、UIの複雑性を下げるため3-2-1方式に固定化。選択コンポーネントも簡素化した。

## root_cause
選択肢の多さがUX複雑化とバグの温床になっていた

## countermeasure
投票方式を3-2-1に固定し、select componentを削除

## result
UIがシンプル化

<!-- id: 07f98ecc-7369-4c58-92c8-da1c49cb3787 -->
