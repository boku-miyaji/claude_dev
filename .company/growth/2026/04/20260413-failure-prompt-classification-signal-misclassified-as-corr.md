# Prompt classification signal misclassified as correction

- **type**: `failure`
- **date**: 2026-04-13
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch

## what_happened
A batch prompt-tagging instruction ('Classify each prompt... output JSON with id and tags') was repeatedly logged as a [correction] failure signal 218 times, polluting the failure analysis pipeline.

## root_cause
The signal detector treats any prompt containing directive keywords (e.g., 'Classify', 'output JSON') as a user correction, without distinguishing system/batch prompts from actual user feedback on Claude's output.

## countermeasure
Add a source filter to the failure-signal collector: exclude prompts originating from batch/classification jobs (tag them with a job_id or skip prompts matching known templates), and require a preceding assistant turn before classifying a prompt as a [correction].

<!-- id: 75c598e9-8099-4cac-a514-882bdeb156e5 -->
