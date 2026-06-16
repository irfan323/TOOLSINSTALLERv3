# Image siap-deploy untuk aplikasi SPJ BOS Otomatis.
FROM python:3.11-slim

# Pustaka sistem yang dibutuhkan WeasyPrint (Pango/Cairo/GDK-PixBuf) + font.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
        libcairo2 libffi-dev fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Folder data & output dapat ditulis saat runtime.
RUN mkdir -p data output static/uploads

ENV PORT=8000 HOST=0.0.0.0 DEBUG=0
EXPOSE 8000

# 2 worker, timeout 120s agar pembuatan PDF besar tidak terputus.
CMD gunicorn --bind 0.0.0.0:${PORT} --workers 2 --timeout 120 app:app
