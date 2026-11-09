# Export validation contract

Perform with an execution tool, not by visual inspection alone:

1. Parse original and generated JSON with strict JSON parser; verify wrapper fields and document object.
2. Recursively diff original and final JSON; preserve object keys and array order. Produce a list of changed JSON pointers and before/after values.
3. Require changed-pointer set to equal approved text-edit pointers; ensure new value equals approved text exactly. Reject missing/unapproved/extra changes.
4. Verify every unchanged field (including all IDs, images, tags, embedded data, metadata, revision numbers/history) has deep equality. Unknown fields are protected too.
5. Serialize, reparse, and repeat equality/diff checks. Ensure final downloadable file is the exact tested file.
6. Report pass/fail for each check, changed-field count, and any limitations. Do not claim schema-specific import compatibility without a real app importer/schema test.

An optional implementation may compare using a recursive walker that emits JSON pointers for differing leaves, and also flags object key additions/removals, type changes, and array order/length changes. For text-only workflows reject any structural diff, even if user says the prose is acceptable.
