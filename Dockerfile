FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies from canonical requirements entrypoint.
# This ensures first-time Docker builds always install everything declared.
COPY requirements.txt ./requirements.txt
COPY requirements ./requirements
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose the dashboard port
EXPOSE 5000

# Start the dashboard server
CMD ["python", "start_dashboard.py"]
