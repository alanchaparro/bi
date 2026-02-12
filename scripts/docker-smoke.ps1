docker compose up -d
docker compose run --rm dashboard python -c "import urllib.request; print(urllib.request.urlopen('http://dashboard:5000/api/check-files', timeout=10).read().decode('utf-8')[:300])"
docker compose run --rm dashboard python -c "import urllib.request; print(urllib.request.urlopen('http://dashboard:5000/analytics/movement/moroso-trend?un=S/D', timeout=15).read().decode('utf-8')[:300])"
