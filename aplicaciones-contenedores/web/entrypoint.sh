#!/bin/sh
set -e

CERT_DIR="/etc/nginx/certs"
CERT_FILE="$CERT_DIR/nginx.crt"
KEY_FILE="$CERT_DIR/nginx.key"

mkdir -p "$CERT_DIR"

if [ ! -f "$KEY_FILE" ] || [ ! -f "$CERT_FILE" ]; then
    echo "[NGINX TLS] Generando certificado autofirmado..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=AR/ST=Cordoba/L=Cordoba/O=Universidad/OU=Sistemas/CN=localhost"
    chmod 600 "$KEY_FILE"
fi

# Arrancar NGINX directamente en primer plano como proceso principal (PID 1)
exec nginx -g "daemon off;"