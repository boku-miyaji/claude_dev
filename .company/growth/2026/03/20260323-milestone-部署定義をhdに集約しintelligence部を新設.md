# 部署定義をHDに集約しintelligence部を新設

- **type**: `milestone`
- **date**: 2026-03-23
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: organization, refactor, departments, intelligence, polaris-circuit
- **commits**: f72958d

## what_happened
PJ別（circuit/foundry/rikyu）に散在していた部署CLAUDE.mdを.company/departments/配下に集約。併せて情報収集専任のintelligence部を新設し、sources.yaml/preferences.yamlで収集対象を定義した。

## root_cause
PJごとに部署定義が重複し、メンテナンスコストと整合性リスクが増大していた

## countermeasure
HD単一のdepartments/へ集約し、PJ側はCLAUDE.mdを軽量化

## result
26ファイルで+334/-550の純減。部署定義の単一ソース化を達成

<!-- id: aeda7aed-10ff-4847-91c4-5ba4b9425dfd -->
