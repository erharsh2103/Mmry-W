FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TF_CPP_MIN_LOG_LEVEL=2

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY api ./api
COPY inference ./inference
COPY preprocessing ./preprocessing
COPY services ./services
COPY training ./training
COPY models ./models
COPY main.py .

RUN useradd --system --uid 10001 mmry && chown -R mmry /app
USER mmry

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
