# rikyu見積でAzure料金を公式未確認

- **type**: `failure`
- **date**: 2026-04-16
- **category**: quality / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: rikyu, documentation, llm-retroactive, llm-classified

## what_happened
FY27拡張のrikyu見積もり作成時、Azureインフラ費用（CosmosDB、App Service等）を公式料金ページで確認せずに数字を出してしまい、社長から『ちゃんとAzureの公式ページを確認した？』『CosmosDBもっと高いのでは？App Serviceは一つで大丈夫？』と指摘された。

## root_cause
見積もり金額を出す前に一次情報（クラウドベンダー公式料金表）で裏取りする手順が定着していなかった

## countermeasure
インフラ費用見積もりは必ずクラウドベンダー公式料金ページで単価を確認してから算出する

<!-- id: 0532bcb0-3567-40dd-8100-5ae476976c9c -->
