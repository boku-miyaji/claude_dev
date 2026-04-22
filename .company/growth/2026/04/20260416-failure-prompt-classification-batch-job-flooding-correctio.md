# Prompt classification batch job flooding correction signals

- **type**: `failure`
- **date**: 2026-04-16
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch, claude-dev
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
The same prompt-classification instruction ('Classify each prompt... output JSON with id and tags') was logged 20 times as a [correction] signal, indicating a batch/loop job is repeatedly emitting identical entries rather than a genuine user correction.

## root_cause
A batch classifier (likely a hook or scheduled job that tags prompts) is being miscategorized as 'correction' feedback, or the same prompt is being re-submitted in a loop without deduplication, polluting the failure-signal stream.

## countermeasure
Exclude batch/system prompts from the correction-signal collector (filter by source or prompt fingerprint), and add deduplication so identical consecutive signals collapse into one before analysis.

<!-- id: 768d8dce-d45f-4ba7-8874-77d7a9b2f8b4 -->
