# Export validation contract

Perform with an execution tool, not by visual inspection alone:

1. Parse original and generated JSON with strict JSON parser; verify wrapper fields and document object.
2. Recursively diff original and final JSON. Produce a list of changed JSON pointers and before/after values. For text-only revisions, preserve object keys and array order.
3. For text-only revisions, require the changed-pointer set to equal the approved text-edit pointers and each new value to equal the approved text exactly. Reject missing or unapproved changes.
4. Verify every unchanged field (including all IDs, images, tags, embedded data, metadata, revision numbers/history) has deep equality. Unknown fields are protected too.
5. Serialize, reparse, and repeat equality/diff checks. Ensure final downloadable file is the exact tested file.
6. Report pass/fail for each check, changed-field count, and any limitations. Do not claim schema-specific import compatibility without a real app importer/schema test.

For text-only revisions, reject structural differences. If the user separately authorized specific structural changes, apply steps 2–4 with an ID-based comparison in addition to the pointer diff. Require every added, removed, or moved section, step, or substep to match the approved ledger. Verify retained objects by ID, exact authorized sequence and destinations, and deep equality of all photos and tables. Check the final document with the SOP Creator model before re-importing.
