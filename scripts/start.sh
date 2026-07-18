#!/bin/bash
set -Eeuo pipefail
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
PORT=3000
cd "${COZE_WORKSPACE_PATH}"
echo "Starting AI Training Platform on port ${PORT}..."
PORT=${PORT} node dist/server.js
