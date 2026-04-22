# データ鮮度マップ + 知識分類体系の確立

- **type**: `milestone`
- **date**: 2026-04-05
- **category**: architecture / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: architecture, freshness, knowledge-taxonomy, tacit-knowledge, update-chain
- **commits**: 526b0d9, e50dcd8

## what_happened
全データを更新メカニズム別に分類するData Freshness Map（Auto/User-triggered/Manual）と、更新の連鎖を可視化するUpdate Chain Mapを作成。さらにrikyuプロジェクトの知識分類フレームワーク（Data/Knowledge/Tacit Knowledge、Skill×KnowledgeBase 2層モデル、C1-C3コード化レベル）をHD全体に適用。8つの暗黙知アイテムを特定。

## root_cause
データの鮮度管理が属人的で、どのデータがいつ更新されるか不明瞭だった。また「データ」「知識」「暗黙知」の区別がなく、蓄積戦略が曖昧だった。

## countermeasure
How It WorksにFreshness Map/Update Chain/Knowledge Taxonomyセクションを追加。暗黙知の捕捉状況を追跡するTK-001〜008を定義。

## result
「何がAuto更新で、何がManualで陳腐化リスクがあるか」を可視化したことで、メンテナンス戦略が明確に。知識の3層構造（Data→Knowledge→Tacit）で蓄積の優先順位が付けられるようになった。

<!-- id: 0f38e10a-5978-4ac0-804f-e70e9d5f96a2 -->
