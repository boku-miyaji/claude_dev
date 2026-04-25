# Skill/Hook/Rules の役割分担と棚卸し

- **type**: `decision`
- **date**: 2026-04-25
- **category**: organization / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, automation, auto-detected, daily-batch, llm-classified

## what_happened
現状の skill が活用されているか疑問が出たため全面見直しを実施。pptx系・diary・weekly-digest・auto-prep など使われていないものを削除、design・zenn は残す。skill が hook/rules にすべきものは移行。skill 利用回数を計測できるよう各 skill に一文を入れる運用を追加。

## result
skill 棚卸しと運用改善ルールが確立。hook/rules との境界が明確化

<!-- id: 3251d5bb-a760-4706-8701-a7181cd9f179 -->
