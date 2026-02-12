FROM python:3.10-slim

WORKDIR /app

# Install system dependencies if any (none needed for now but good to have)
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy minimal runtime requirements and install
COPY requirements/runtime.txt ./requirements/runtime.txt
RUN pip install --no-cache-dir -r requirements/runtime.txt

# Copy the rest of the application
COPY . .

# Expose the dashboard port
EXPOSE 5000

# Start the dashboard server
CMD ["python", "start_dashboard.py"]
