docker compose build --no-cache
docker compose up -d
docker compose run --rm dashboard python -m py_compile start_dashboard.py
docker compose run --rm dashboard python -m unittest discover -s tests -p "test_*.py"
docker compose run --rm dashboard python -c "import urllib.request; print(urllib.request.urlopen('http://dashboard:5000/api/check-files', timeout=10).read().decode('utf-8')[:300])"
docker compose run --rm dashboard python -c "import urllib.request; print(urllib.request.urlopen('http://dashboard:5000/analytics/movement/moroso-trend?un=S/D', timeout=15).read().decode('utf-8')[:300])"
