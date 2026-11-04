# Stage 1: Build dependencies
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime image
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
COPY . .

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONPATH=/app

EXPOSE 8000

# Shell form (not exec-array form) so $PORT actually gets substituted —
# Render, Railway, and most PaaS hosts assign a dynamic port via this env
# var and health-check against it; a hardcoded port here fails the deploy.
# Falls back to 8000 for plain `docker run` / docker-compose, where PORT
# isn't set.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
