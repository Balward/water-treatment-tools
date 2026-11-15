# Northglenn SOP Editor 0.2.2

The `word-sop-conversion` skill includes a dependency-free Node.js 22+ DOCX extractor, the SOP Creator model, embedded image export, and a separate image-placement and metadata audit. Named procedure headings can populate the Creator's Section Heading field. If the converter blocks export after extraction, it writes the audit and original media for review.

Run the conversion skill's script with `node skills/word-sop-conversion/scripts/docx-to-sop.mjs source.docx --out OUTPUT_DIRECTORY`. No Office installation, network service, or npm install is required. Use a new output directory each time. For a Word-open file on Windows, make a read-only snapshot using a file stream opened with `FileShare.ReadWrite` before running the converter.

The extraction script preserves native PNG/JPEG/WebP bytes, captions and procedure text. When migrating a Word SOP to the Northglenn writing format, the skill adds an editorial proposal with imperative wording, numbered steps, lettered substeps, and Section Headings. Review the complete proposal and approve the revisions before generating a revised backup. Explicit extraction-only requests can return the faithful backup directly after source and image checks.

The plugin needs an execution-capable host with access to the uploaded DOCX and Node.js. A plain chat without file execution cannot run the bundled converter. Installation/update into the existing ChatGPT plugin must use that plugin's verified ID or its original managed-source release process; do not create a second plugin or edit the installed cache as a substitute.

The schema snapshot must stay synchronized with `apps/sop-creator/model.js`. Validate future changes with `node --test scripts/sop-word-conversion.test.mjs` from the water-treatment-tools repository. Test documents and conversion results belong in ignored `deployment/` and are not shipped inside the plugin.
