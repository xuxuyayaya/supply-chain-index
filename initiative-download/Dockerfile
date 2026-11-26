FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends fonts-wqy-zenhei && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir reportlab==4.4.9
WORKDIR /app
COPY initiative-download/server.py initiative-download/content.json ./
CMD ["python", "server.py"]
