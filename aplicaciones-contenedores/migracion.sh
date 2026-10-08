#!/usr/bin/env bash
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Uso: $0 <nombre_clave_o_ruta> <IP_REMOTA> [usuario_remoto]"
    exit 1
fi

KEY_INPUT="$1"
EC2_IP="$2"
REMOTE_USER="${3:-ubuntu}"

if [ -f "$KEY_INPUT" ]; then
    KEY_PATH="$KEY_INPUT"
elif [ -f "$HOME/.ssh/$KEY_INPUT" ]; then
    KEY_PATH="$HOME/.ssh/$KEY_INPUT"
elif [ -f "$HOME/.ssh/${KEY_INPUT}.pem" ]; then
    KEY_PATH="$HOME/.ssh/${KEY_INPUT}.pem"
else
    echo "Error: No se encontró el archivo de clave: $KEY_INPUT"
    exit 1
fi

chmod 400 "$KEY_PATH"
TARGET="${REMOTE_USER}@${EC2_IP}:~/app"

echo "=== Conectando como '${REMOTE_USER}' a ${EC2_IP} ==="

echo "=== 1. Creando estructura de carpetas ==="
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "${REMOTE_USER}@${EC2_IP}" \
  "mkdir -p ~/app/api-clientes \
            ~/app/api-facturas \
            ~/app/api-pagos \
            ~/app/api-tarjetas \
            ~/app/api-transacciones \
            ~/app/db/init-scripts \
            ~/app/web"

echo "=== 2. Copiando docker-compose.yml ==="
if [ -f "docker-compose.yml" ]; then
    scp -i "$KEY_PATH" docker-compose.yml "${TARGET}/"
fi

echo "=== 3. Copiando archivos .env ==="
SERVICES=("api-clientes" "api-facturas" "api-pagos" "api-tarjetas" "api-transacciones" "db")
for service in "${SERVICES[@]}"; do
    if [ -f "${service}/.env" ]; then
        scp -i "$KEY_PATH" "${service}/.env" "${TARGET}/${service}/.env"
    fi
done

echo "=== 4. Copiando scripts de base de datos ==="
if [ -d "db/init-scripts" ]; then
    scp -r -i "$KEY_PATH" db/init-scripts/* "${TARGET}/db/init-scripts/"
fi

echo "=== 5. Copiando web/entrypoint.sh y asignando permisos ==="
if [ -f "web/entrypoint.sh" ]; then
    scp -i "$KEY_PATH" web/entrypoint.sh "${TARGET}/web/entrypoint.sh"
    ssh -i "$KEY_PATH" "${REMOTE_USER}@${EC2_IP}" "chmod +x ~/app/web/entrypoint.sh"
fi

echo "=== 6. Copiando ejecucion.sh y asignando permisos ==="
if [ -f "ejecucion.sh" ]; then
    scp -i "$KEY_PATH" ejecucion.sh "${REMOTE_USER}@${EC2_IP}:~/ejecucion.sh"
    ssh -i "$KEY_PATH" "${REMOTE_USER}@${EC2_IP}" "chmod +x ~/ejecucion.sh"
fi

echo "=== 7. iniciar ejecucion.sh  ==="

    ssh -t -i "$KEY_PATH" "${REMOTE_USER}@${EC2_IP}" "~/ejecucion.sh"


echo "=== Despliegue finalizado con éxito ==="
