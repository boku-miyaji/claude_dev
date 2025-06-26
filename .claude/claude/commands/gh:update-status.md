---
allowed-tools: >
  Bash(gh issue edit:*),
  Bash(gh issue comment:*),
  Bash(gh project:*),
  Bash(gh label create:*),
  Bash(gh label list:*),
  Bash(jq:*),
  Bash(tr:*),
  Bash(sed:*)
description: |
  Update an Issue’s status in Projects V2 **and** sync its labels.
  Usage: `/gh:update-status <issue_number_or_url> <Backlog|Design|Dev|Review|Done>`
---

## Parsed arguments
- **Issue**  : `$ISSUE`   (1st token)
- **Status** : `$STATUS`  (2nd token)

## Label mapping
| Status   | Labels to apply |
| -------- | --------------- |
| Backlog  | task, needs-design |
| Design   | needs-design |
| Dev      | in-dev |
| Review   | needs-review |
| Done     | done |

## Steps
1. Ensure required labels exist  
   ```bash
   gh label create <name> --color C2E0C6 --force
   ```

2. Replace Issue labels to match `$STATUS`.

3. Update Projects item’s **Status** field  
   ```bash
   gh project item-edit --id <ITEM_ID> \
     --field-id <STATUS_FIELD_ID> --value "$STATUS"
   ```

4. **Return**  
   ```
   🔄 Issue #$ISSUE set to $STATUS
   ```
