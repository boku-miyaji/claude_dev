# rikyu MVP の CI/CD は SP なしで build & push のみ自動化、deploy は local az CLI で社長実行

- **type**: `decision`
- **date**: 2026-05-01
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: rikyu, azure, ci-cd, github-actions, acr, container-apps, auth

## what_happened
GitHub Actions から Container Apps を deploy するには通常 Service Principal が必要だが、社長アカウントは Contributor 権限のみで Microsoft.Authorization/roleAssignments/write を持たないため az ad sp create-for-rbac が AuthorizationFailed で失敗した。Phase 1 中盤で IT に SP 発行を依頼予定。

## countermeasure
GitHub Actions は ACR Admin User の username/password を Secrets に登録し、build & push のみ実行する（dorny/paths-filter で api/worker 個別ビルド）。Container App の image 更新 (az containerapp update) は社長が local の az CLI で実行する mvp/scripts/deploy.sh を用意。Container App と ACR の credential 連携は az containerapp registry set で一度だけ実行する mvp/scripts/setup-acr-credentials.sh を用意。Phase 1 中盤で SP が来たら deploy ステップを GitHub Actions に統合する。

## result
5/1 MVP のデモ準備をブロックせず開発ループを回せる。完全自動化は Phase 1 中盤に持ち越し。

<!-- id: d088d990-363e-4df7-9599-04ce84c65a62 -->
