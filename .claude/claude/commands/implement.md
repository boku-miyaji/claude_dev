---
allowed-tools: >
  Bash(git add:*),
  Bash(git commit:*),
  Bash(npm:*),
  Bash(pip:*),
  Bash(echo:*)
description: |
  Implement code & tests for `$ARGUMENTS` following TDD。
---

1. **Generate failing tests** → `tests/`
2. 実装 → `src/`
3. `npm test` もしくは `pytest` がパス
4. コミット  
   ```bash
   git add .
   git commit -m "feat: $ARGUMENTS"
   ```
5. **Return**  
   ```
   🧪 Tests ✔ (<passed>/<total>), committed <files> changes
   ```
