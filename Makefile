SHELL := /bin/sh

.PHONY: docker-build docker-up docker-down docker-logs docker-test docker-compile docker-smoke docker-validate docker-up-dev docker-up-prod docker-api-test docker-openapi-export frontend-generate-types frontend-build docker-smoke-v1 docker-ci

docker-build:
	docker compose build --no-cache

docker-up:
	docker compose up -d

docker-up-dev:
	docker compose --profile dev up -d --build

docker-up-prod:
	docker compose --profile prod up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs dashboard --tail=200

docker-api-test:
	docker compose --profile dev run --rm dashboard python -m unittest tests.test_api_v1_brokers_config

docker-openapi-export:
	docker compose --profile dev run --rm dashboard python scripts/export_openapi_v1.py

frontend-generate-types:
	docker run --rm -v "$$(pwd):/work" -w /work/frontend node:20-alpine sh -lc "npm install --silent && npm run generate:types"

frontend-build:
	docker run --rm -v "$$(pwd):/work" -w /work/frontend node:20-alpine sh -lc "npm install --silent && npm run typecheck && npm run build"

docker-smoke-v1:
	docker compose --profile dev up -d api-v1
	docker compose --profile dev run --rm dashboard python -c "import urllib.request,json;u='http://api-v1:8000/api/v1/health';obj=json.loads(urllib.request.urlopen(u,timeout=10).read().decode('utf-8'));assert obj.get('ok') is True"
	docker compose --profile dev run --rm dashboard python -c "import urllib.request,json;u='http://api-v1:8000/api/v1/auth/login';data=json.dumps({'username':'admin','password':'admin123'}).encode('utf-8');req=urllib.request.Request(u,data=data,headers={'Content-Type':'application/json'},method='POST');obj=json.loads(urllib.request.urlopen(req,timeout=10).read().decode('utf-8'));assert obj.get('access_token')"

docker-test:
	docker compose run --rm dashboard python -m unittest discover -s tests -p "test_*.py"

docker-compile:
	docker compose run --rm dashboard python -m py_compile start_dashboard.py

docker-smoke:
	docker compose run --rm dashboard python -c "import urllib.request,sys;u='http://dashboard:5000/api/check-files';print(urllib.request.urlopen(u,timeout=10).read().decode('utf-8')[:300])"
	docker compose run --rm dashboard python -c "import urllib.request,urllib.error,json;u='http://dashboard:5000/analytics/movement/moroso-trend';\
try: urllib.request.urlopen(u,timeout=10)\
except urllib.error.HTTPError as e:\
 body=e.read().decode('utf-8');print(body[:300]);obj=json.loads(body);assert obj.get('error_code')=='FILTER_REQUIRED'"
	docker compose run --rm dashboard python -c "import urllib.request,urllib.error,json;u='http://dashboard:5000/analytics/anuales/summary';\
try: urllib.request.urlopen(u,timeout=10)\
except urllib.error.HTTPError as e:\
 body=e.read().decode('utf-8');print(body[:300]);obj=json.loads(body);assert obj.get('error_code')=='FILTER_REQUIRED'"

docker-validate: docker-up docker-compile docker-test docker-smoke

docker-ci: docker-up-dev docker-compile docker-test docker-api-test docker-smoke docker-smoke-v1 docker-openapi-export frontend-generate-types frontend-build
