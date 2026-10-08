```markdown
# Patrón Entrypoint Wrapper para Bootstrap de TLS en NGINX

Este script implementa un patrón conocido como **Entrypoint Wrapper para Bootstrap de TLS**. Consiste en delegar la creación del certificado SSL/TLS al momento exacto en que arranca el contenedor por primera vez (*runtime*), en lugar de hornearlo dentro de la imagen durante el `docker build` o exigir que se cree manualmente en la máquina anfitriona antes de hacer `docker compose up`.

Nos parecio la manera más automatizada y segura de errores manuales.

---

## Script de Referencia

```sh
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

```

---

## Ventajas

* **Portabilidad absoluta (*Zero-Config / Clone & Run*):**
Cualquier integrante del equipo o evaluador que clone el repositorio puede ejecutar `docker compose up` y disponer de HTTPS de inmediato, sin ejecutar comandos previos de `openssl` en su máquina anfitriona ni depender de dependencias locales en Windows, macOS o Linux.
* **Seguridad del repositorio (No almacena claves privadas en Git):**
Evita el error habitual de generar `nginx.key` y `nginx.crt` en local y comitearlos al control de versiones para que Docker los copie. Con este script, la clave privada se genera directamente dentro del contenedor.
* **Inmutabilidad y desacoplamiento de la imagen Docker:**
La imagen producida en el `Dockerfile` queda limpia de certificados temporales o fechas de vencimiento fijas en tiempo de compilación. Es posible reutilizar la misma imagen base en desarrollo, testing o staging sin reconstruirla.
* **Idempotencia (`if [ ! -f ... ]`):**
El script verifica la presencia previa de los archivos antes de crearlos. Si se monta un volumen persistente en `/etc/nginx/certs` (o tras un reinicio del contenedor), detecta el certificado existente y omite su regeneración.
* **Manejo correcto de señales del sistema (`exec nginx -g "daemon off;"`):**
La instrucción `exec` hace que el binario de NGINX reemplace al proceso del script de shell, asumiendo el **PID 1** dentro del contenedor. Esto permite que las señales del kernel (`SIGTERM`, `SIGINT`) emitidas por `docker stop` o `docker compose down` lleguen directamente a NGINX para ejecutar un cierre limpio de conexiones (*graceful shutdown*).
* **Permisos restrictivos automáticos (`chmod 600`):**
Asegura que el archivo de clave privada (`nginx.key`) solo sea legible por el dueño del proceso, impidiendo accesos no autorizados por otros usuarios dentro del contenedor.

---

## Desventajas y Limitaciones

* **Certificado autofirmado (Sin cadena de confianza en navegadores):**
Al no estar validado por una Autoridad Certificadora (CA) pública reconocida, navegadores como Chrome o Firefox reportarán advertencias (`SEC_ERROR_UNKNOWN_ISSUER` o `NET::ERR_CERT_AUTHORITY_INVALID`). En llamadas automatizadas o pruebas vía consola, se requiere ignorar la verificación SSL explícitamente (ej. `curl -k` o `curl --insecure`).
* **Inadecuado para entornos de producción reales:**
En producción no se utilizan certificados autofirmados generados en tiempo de arranque. En su lugar se emplean:
* Un contenedor complementario con **Certbot** para renovaciones automáticas con Let's Encrypt.
* Inyección desde gestores de secretos (HashiCorp Vault, AWS Secrets Manager, Kubernetes Secrets).
* Terminación TLS centralizada en balanceadores de carga o Ingress Controllers (Cloudflare, AWS ALB, Traefik).


* **Sobrecarga de herramientas en la imagen de NGINX:**
Requiere instalar el paquete `openssl` en la imagen base para ejecutar la generación, sumando dependencias y megabytes adicionales al artefacto final.
* **Regeneración de clave en contenedores efímeros sin volumen:**
Si no se persiste `/etc/nginx/certs` con un volumen de Docker, cada ejecución de `docker compose down && docker compose up` genera un par de claves nuevo con distinta huella digital (*fingerprint*), invalidando excepciones de seguridad previamente agregadas en el navegador.

---

