#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major === 20 && minor >= 19 ? 0 : 1)'; then
  echo "Node.js >=20.19 <21 is required; found $(node --version)." >&2
  exit 1
fi

npm ci
npm run build

echo "Codex environment setup completed."
