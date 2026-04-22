# カレンダーall-dayデフォルト問題 — 4連続fixでも直らない

- **type**: `failure`
- **date**: 2026-04-05
- **category**: quality / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: quality, calendar, ux, event-delegation, dom, boolean-attributes, claude-dev
- **commits**: 6cded13, 6da0811, a8e7f2f, 8cf2851, f0a37c4, 80c3528

## what_happened
時間セルをクリックしてイベント作成する際、常にall-day=trueになるバグ。(1)スマートデフォルト修正→(2)明示的にfalse渡し→(3)triple-guard追加→(4)clickハンドラをbody delegationから各セル直接attachに変更、と4回修正してようやく解決。

## root_cause
イベント委任（body delegation）でクリックイベントを処理していたため、セルのdata属性が正しく取得できず、デフォルトのall-day=trueにフォールバックしていた。

## countermeasure
イベント委任を廃止し、各時間セルに直接clickハンドラをattach。さらにel()ヘルパーのboolean属性（checked/disabled）をプロパティとして設定するよう修正。

## result
「イベント委任」はパフォーマンス面で有利だが、data属性の取得が不安定になるケースがある。DOM操作では「直接attach」が確実。また、HTMLのboolean属性はsetAttribute()ではなくプロパティ代入が正しい。

<!-- id: 00fde021-2580-4302-8a6e-a8909b2fdffe -->
