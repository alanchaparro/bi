SHELL := /bin/sh

.PHONY: docker-build docker-up docker-down docker-logs docker-test docker-compile docker-smoke docker-validate

docker-build:
	docker compose build --no-cache

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs dashboard --tail=200

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
