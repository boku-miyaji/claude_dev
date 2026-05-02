# rikyu UI設計はDDLに合わせる(案A採用)

- **type**: `decision`
- **date**: 2026-05-02
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, ddl, ui-design, auto-detected, daily-batch, llm-classified

## what_happened
PoC UIとMVP DDLでデータ構造が不整合。mapper（変換層）案を社長が拒否（「夫妻になる」=二重メンテで破綻する懸念）。どちらか根本的に治す方向で議論し、全機能を見せるため案A（DDL基準でUIを合わせる）を採用。

## root_cause
PoC UIとMVP DDLが別個に設計され乖離。mapperで繋ぐと二重メンテで破綻

## countermeasure
案A採用：DDLをSoTとしてUIを合わせる。7軸の整理 + 命名規則統一 + Vertical Slice戦略

## result
store.tsxの17メソッド対応表を引き継ぎ資料化

<!-- id: a665b056-c57d-47f2-aff0-4f3f0758c6a8 -->
