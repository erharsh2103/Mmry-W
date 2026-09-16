FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY data_processing ./data_processing
COPY dashboards ./dashboards
COPY models ./models
COPY reports ./reports

RUN useradd --system --uid 10001 mmry && chown -R mmry /app
USER mmry

EXPOSE 8501
CMD ["python", "-m", "data_processing.pipeline"]
