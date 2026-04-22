# devcontainerにpowerlevel10k導入

- **type**: `milestone`
- **date**: 2026-01-15
- **category**: tooling / **severity**: low
- **status**: active
- **source**: backfill
- **tags**: devcontainer, zsh, powerlevel10k, DX
- **commits**: d6b7fe6, c42d943, b32eeca, 6e373aa, cdb5ef5

## what_happened
devcontainer環境にpowerlevel10kとカスタムzsh設定を追加。ローカルPCと同じシェル体験をコンテナ内でも得られるように整備し、Tab補完の挙動も候補表示方式に調整した。

## root_cause
devcontainer内のシェル体験がローカルと乖離しており、生産性が落ちていた

## countermeasure
.p10k.zsh/.zshrcをDockerfile-cpuに組み込み、Tab補完を共通prefix+候補表示に変更

## result
ローカルと統一されたシェル環境が devcontainer で利用可能に

<!-- id: 8c67d8c6-73ba-422c-8801-56f95ca1ca4a -->
