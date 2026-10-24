# Equipment Status Board QR

`equipment-status-edit.svg` encodes `https://water.gibbhub.io/live-operations-dashboard/` directly. It opens the editor without `mode=tv` or an external redirect service.

Regenerate with `node scripts/generate-equipment-qr.cjs`. The generator uses the existing local QR library, square modules, medium error correction, and a four-module white margin. At the header's 82px size each module is two pixels wide. Keep the image white in both themes and avoid overlays or rounded clipping.

`scripts/check-live-ops.cjs` checks the link, asset, display size, and wall layout, and captures `preview/live-ops-qr.png` for scan verification. The replacement was independently decoded from this rendered screenshot before deployment.
