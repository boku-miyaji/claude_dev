# Native Tool 優先ルール

> このルールは常時有効。Bash を書きたくなったら、まず Read / Glob / Grep で代替できないか考える。

## 原則

**Bash の合成コマンド（`for` / `if` / `&&` / `|` / `sed -n` / `grep -r` / `find` 等）を書く前に、Claude Code ネイティブの Read / Glob / Grep ツールで代替できないか確認する。**

理由:
1. **承認ダイアログが出ない**（permission 不要）
2. **並列・最適化されてる**（ripgrep ベース、結果整形済み）
3. **壊れにくい**（シェル解釈の事故が起きない）
4. **意図が読みやすい**（`for` ループで何を集計してるのか後で辿れる）

## 置き換えマップ

| Bash でやりがち | Claude Code ネイティブで |
|----------------|----------------------|
| `find path/ -name "*.ext"` | `Glob(pattern="**/*.ext", path="path/")` |
| `grep -rn "pat" path/` | `Grep(pattern="pat", path="path/", output_mode="content", -n: true)` |
| `grep -l "pat" path/` | `Grep(pattern="pat", path="path/")` (files_with_matches) |
| `for f in *.ts; do grep ...; done` | `Grep(pattern="...", glob="**/*.ts")` |
| `sed -n '100,150p' file` | `Read(file_path="file", offset=100, limit=51)` |
| `head -N file` | `Read(file_path="file", limit=N)` |
| `tail -N file` | `Read(file_path="file", offset=<total-N>)`（要行数計算） |
| `cat file1 file2 file3` | 複数 `Read` を並列呼び出し |
| `ls path/` | `Glob(pattern="path/*")` |
| `wc -l file` | `Read` で読み切ってから行数カウント、または Bash 許容 |

## Bash を使うべきとき

Read / Glob / Grep で表現できない以下は Bash を使う:

- **シェル専用ツール**: `git`, `gh`, `npm`, `npx`, `curl`（`sb.sh` 推奨）, `pytest`, `supabase` CLI 等
- **スクリプト実行**: `.sh` / `.py` の呼び出し
- **Read/Grep で無理な変換**: `jq` の複雑なパイプ、awk 集計、データ加工
- **プロセス操作**: `kill`, `ps`, `lsof`

## 判断フロー

```
やりたい操作 → Read/Glob/Grep で表現できる？
   Yes → Claude Code ツールを使う
   No  → Bash を使う（シェルでしかできない場合のみ）
```

**迷ったら Read/Glob/Grep を先に試す。** Bashに逃げない。

## よくあるアンチパターン

- ❌ `find . -name "*.tsx" | xargs grep "useState"` → ✅ `Grep(pattern="useState", glob="**/*.tsx")`
- ❌ `for d in */; do cat "$d/README.md"; done` → ✅ `Glob("*/README.md")` で列挙 → 複数 Read を並列
- ❌ `sed -n '500,600p' large.ts` → ✅ `Read(offset=500, limit=101)`
- ❌ `head -30 file | grep "version"` → ✅ `Grep(pattern="version", path="file", head_limit=30)`
- ❌ `ls | wc -l` で件数確認 → ✅ `Glob("*")` で取得して配列長を見る
