# Dockerfile
FROM python:3.11-slim

# avoid buffering, helpful for logs
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5000

WORKDIR /app

# Install system deps needed for many Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy application code
COPY . .

# Create a non-root user (optional but recommended)
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# Expose the port (Render uses PORT env var automatically)
EXPOSE 5000

# Use gunicorn for production. Render provides PORT env var; fallback to 5000.
CMD exec gunicorn "app:app" \
    --bind "0.0.0.0:${PORT:-5000}" \
    --workers 4 \
    --threads 2 \
    --timeout 120
