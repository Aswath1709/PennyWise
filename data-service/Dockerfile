# Python Data Service Dockerfile
FROM python:3.11-slim

# Security: Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

WORKDIR /app

# Install system dependencies for PDF processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY --chown=appuser:appgroup . .

# Create uploads directory and writable matplotlib cache
RUN mkdir -p /app/uploads /app/.config/matplotlib \
    && chown -R appuser:appgroup /app/uploads /app/.config/matplotlib

# Tell matplotlib to use the writable cache dir
ENV MPLCONFIGDIR=/app/.config/matplotlib

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Start the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
