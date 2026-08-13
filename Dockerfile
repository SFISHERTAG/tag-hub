FROM python:3.11-slim

WORKDIR /app

# Copy application files
COPY success-portal.html .
COPY app.py .

# Install dependencies
RUN pip install --no-cache-dir Flask gunicorn

# Expose port (Cloud Run sets PORT env var, defaults to 8080)
EXPOSE 8080

# Run with gunicorn
CMD exec gunicorn --bind :${PORT:-8080} --workers 1 --threads 2 app:app
