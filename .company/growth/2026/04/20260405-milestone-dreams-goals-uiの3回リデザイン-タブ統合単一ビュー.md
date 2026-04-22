# Dreams & Goals UIの3回リデザイン — タブ→統合→単一ビュー

- **type**: `milestone`
- **date**: 2026-04-05
- **category**: tooling / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: tooling, dreams, goals, wishlist, ui-iteration, auto-classification, claude-dev
- **commits**: 42bdfe6, 1e76dcf, 128ed5e, d9c3f9d, e0f8dd0, c66ef6c, e5bce26, 38d4d29, 5f8e438, 3cbce4e, 3554149

## what_happened
まずDreams/Goalsをタブ型UIに統合→しかし切替が面倒→タブを廃止して単一ビューに統合→Wishlist連携も追加して最終形に。dream/goal/wishのセレクター付き統一追加フォーム、各種の説明テキストと具体例も追加。GPT-5 nanoによる自動カテゴリ分類とバックグラウンドAI分類も実装。

## root_cause
最初から正解のUIは分からない。タブ型→統合型と試行錯誤して初めて「タブ切替はこの規模では不要」と分かった。

## countermeasure
3回のイテレーションを恐れず実行。最終的にdream/goal/wishの3タイプを1画面で自然に扱えるUIに到達。

## result
UIデザインは「試してから判断」が最速。設計段階で悩むより、実装して触って判断するサイクルが有効。AI自動分類はバックグラウンド実行にすることで追加時のUXを損なわない。

<!-- id: ab517f19-4877-4ef2-8412-3d52a7e6ed55 -->
