FROM python:3.12.15-alpine3.24

WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

RUN addgroup -S appgroup && adduser -S appuser -G appgroup -s /sbin/nologin -h /app

COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8080

ENTRYPOINT ["python", "main.py"]

