# Prompt classification signals misclassified as corrections

- **type**: `failure`
- **date**: 2026-04-13
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch, claude-dev

## what_happened
A batch classification prompt (tagging prompts with pj/category) was repeatedly logged as a 'correction' failure signal 77 times, polluting the failure-signal stream.

## root_cause
The signal detector treats any prompt containing classification/tagging instructions as a user correction, with no filter for system batch jobs or deduplication of identical repeated prompts.

## countermeasure
Add an allowlist/pattern filter in the signal detector to exclude batch classification prompts (e.g., prompts starting with 'Classify each prompt'), and deduplicate identical consecutive signals before recording.

<!-- id: d1010b83-2751-42a3-a0fd-c0cda72e7764 -->
