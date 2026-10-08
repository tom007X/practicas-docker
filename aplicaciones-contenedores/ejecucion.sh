#!/usr/bin/env bash
set -e

echo "=== 1. Actualizando sistema e instalando dependencias ==="
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl

echo "=== 2. Instalando Docker ==="
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm -f get-docker.sh
fi

echo "=== 3. Agregando usuario al grupo docker ==="
sudo usermod -aG docker "$USER"

docker --version
docker compose version

cd ~/app

# Proteger variables de entorno
chmod 600 .env* */.env* 2>/dev/null || true

# 4. Iniciar sesión en Docker Hub solo si tus imágenes son privadas
# (Si son públicas, podés comentar la siguiente línea)
# docker login

echo "=== 5. Descargando y levantando contenedores ==="
# Usamos 'sg docker' para ejecutar el comando con el nuevo grupo sin reiniciar sesión
sg docker -c "docker compose pull && docker compose up -d && docker compose ps"
