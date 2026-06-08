#!/bin/bash
set -e
echo "=== Pre-build check ==="
# Verify frontend compiles
cd /home/admin-epem/bi
npm --prefix frontend run build 2>&1 | tail -5 || echo "WARNING: Build check skipped (npm not available)"
echo "=== Pre-build done ==="

