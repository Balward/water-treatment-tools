# Shared Operations Users

Open **Apps > User Management** or `/operations-management/` on Operations Home. Add and edit first/last names, set users inactive, and reactivate users. No login is required. Removing a user means deactivation, preserving their stable ID and past records. Duplicate full names and stale revision writes are rejected.

The suite reuses the existing Plant Rounds directory at `data/plant-rounds/users.json`; no existing directory is replaced or separately imported. `/api/operations/users` and `/api/plant-rounds/users` are aliases for the same storage and revision checks. Existing backups and the suite persistent data mount continue to cover it. Legacy Plant Rounds user-management URLs remain compatible; its current navigation links to the central page.

Equipment status and General Comment saves use the shared active-user picker, remembering the last selected name on that device. Historical change-log corrections retain editable recorded names. Plant Rounds continues to require an active directory operator. Supply Inventory, Chemical Inventory and Placed Orders open an active-operator dropdown on focus or through the name field's chevron button. These fields are selection-only (readonly with inputmode=none), so tapping does not open a mobile text keyboard. Arrow keys and Enter also select a name. Directory failures show Retry Loading Names; manual name entry is not offered. Inventory reads the directory from `https://water.gibbhub.io`, using the suite's CORS API; its CSP permits that connection. Names load on page initialization and refresh when opening the picker. A 404 from the shared endpoint retries the legacy Plant Rounds endpoint for compatibility with older suite deployments.

The seven existing operators remain the initial directory. Inactive users are hidden from active choices; saved names are not rewritten when a person is renamed or made inactive.

Deploy **both** the suite and standalone inventory for this change:

```powershell
.\deploy.ps1 -Target All -Server gibbhub
```

Checks: `node scripts/check-plant-rounds-api.cjs`, `node scripts/check-live-ops.cjs`, `node scripts/check-operations-home.cjs`, and inventory tests/browser checks. These use temporary data.
