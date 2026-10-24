#!/usr/bin/env bash
# Rebuild source already installed on Unraid. Upload new changes from Windows
# using deploy.ps1 -Target Suite (or All).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
exec bash ./deploy-unraid.sh --installed-source
