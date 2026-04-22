# weekly-insights save エラーとビルド欠落

- **type**: `failure`
- **date**: 2026-04-14
- **category**: quality / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: bugfix, constraint, build, focus-you
- **commits**: a417754, 7f38151

## what_happened
週次分析バッチで save エラーが発生し、CHECK制約の拡張が必要だった。また dashboard のビルドに必要なソースファイルが untracked で欠落していたため、ビルドが通らない状態が一時発生した。

## root_cause
分析種別を追加した際に DB の CHECK 制約を拡張し忘れていた。新規コンポーネントを git add し忘れていた

## countermeasure
CHECK制約を拡張し、untracked だった dashboard ソースを追加コミット

## result
バッチの保存成功、ダッシュボードのビルドが復旧

<!-- id: d93fad52-2a2f-49d2-9330-40d5966b3dda -->
