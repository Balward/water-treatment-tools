# Schema source and preservation

The current SOP Creator schema is documented in `../../word-sop-conversion/references/json-structure.md`, with its executable snapshot at `../../word-sop-conversion/scripts/sop-model.cjs`. This supersedes the earlier statement that the app?s photo format is unknown. For existing JSON backups, still inventory the actual uploaded file and preserve unknown fields, IDs, images and metadata. Do not normalize or reconstruct the source object to export an edit.

## Original preservation guidance

# Northglenn SOP JSON structure — confirmed vs unknown

Confirmed top-level wrapper:

```json
{"format":"northglenn-sop","version":1,"document":{}}
```

`document` holds the complete SOP. The installed app schema is now documented in the sibling conversion skill; uploaded backups can still contain unfamiliar fields. Never treat illustrative field names as verified schema. On first real upload, recursively inventory the exact keys, types, paths, counts, and positions for Purpose, Background, Notes, Safety, Equipment, groups, steps, substeps, images, IDs, tags, and revision metadata. Record a schema profile from that specific file. Protect all unknown fields by default. Do not infer that `version` is a string; expected value is numeric `1`.

For JSON pointer paths use RFC 6901 escaping (`~` -> `~0`, `/` -> `~1`). Maintain exact pointers in the approval ledger. Any change to array length/order or object shape requires separate structural authorization and is out of scope for default text-only exports.
