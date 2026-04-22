# Prompt classification instruction repeated twice

- **type**: `failure`
- **date**: 2026-04-21
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
The same correction about classifying prompts with JSON tags (pj, etc.) was issued twice in succession, indicating the first attempt did not produce the expected output format

## root_cause
Agent likely failed to follow the structured output format on the first attempt — either producing free-text instead of JSON, missing required tag fields, or misunderstanding the classification schema

## countermeasure
When given a structured output instruction (e.g. 'output JSON with id and tags'), echo back the schema once for confirmation before processing, and validate each output object against the schema before returning

<!-- id: 8aeb291e-ec0b-4908-b5f1-9043d19b2b00 -->
