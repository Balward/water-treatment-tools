# Northglenn SOP Editor 0.2.0

This is an update of the installed `northglenn-sop-editor` 0.1.0 package, preserving its identity and existing JSON-review skill. It adds `word-sop-conversion` with a dependency-free Node.js 22+ DOCX extractor, the actual SOP Creator model, embedded image export, and a separate image-placement/metadata audit.

Run the conversion skill's script with `node skills/word-sop-conversion/scripts/docx-to-sop.mjs source.docx --out OUTPUT_DIRECTORY`. No Office installation, network service, or npm install is required. Use a new output directory each time. For a Word-open file on Windows, make a read-only snapshot using a file stream opened with `FileShare.ReadWrite` before running the converter.

The script preserves native PNG/JPEG/WebP bytes, captions and procedure text. It does not rasterize unsupported formats, resize oversized images, or claim to resolve ambiguous layouts without review. The skill requires complete-source inspection and image audit before handoff. Existing JSON editing still uses the original approval-controlled workflow; requested faithful Word conversion does not require a redundant export confirmation.

The plugin needs an execution-capable host with access to the uploaded DOCX and Node.js. A plain chat without file execution cannot run the bundled converter. Installation/update into the existing ChatGPT plugin must use that plugin's verified ID or its original managed-source release process; do not create a second plugin or edit the installed cache as a substitute.

The schema snapshot must stay synchronized with `apps/sop-creator/model.js`. Validate future changes with `node --test scripts/sop-word-conversion.test.mjs` from the water-treatment-tools repository. Test documents and conversion results belong in ignored `deployment/` and are not shipped inside the plugin.
