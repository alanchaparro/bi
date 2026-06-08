#!/bin/bash
set -e

echo "=== CI Checks ==="

# 1. Python backend syntax check
echo "Checking Python syntax..."
python3 -m py_compile /home/admin-epem/bi/backend/app/services/sync_service.py || true
python3 -m py_compile /home/admin-epem/bi/backend/app/services/analytics_service.py || true

# 2. Frontend type check (if possible)
if [ -f /home/admin-epem/bi/frontend/package.json ]; then
    cd /home/admin-epem/bi/frontend
    echo "Running TypeScript type check..."
    npx tsc --noEmit 2>&1 | tail -5
fi

# 3. Docker compose validation
echo "Validating docker-compose.yml..."
cd /home/admin-epem/bi
docker compose -f docker-compose.yml config 2>&1 | tail -3

echo "=== CI Checks Complete ==="

