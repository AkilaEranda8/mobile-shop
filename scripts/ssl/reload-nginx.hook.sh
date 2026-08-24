#!/bin/bash
# Certbot deploy/post hook — reload nginx after a successful renewal.
set -euo pipefail
if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx
fi
