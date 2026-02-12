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

docker-validate: docker-up docker-compile docker-test docker-smoke
