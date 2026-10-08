---


# Guía de Automatización: Migración y Ejecución Remota

Este flujo automatiza el aprovisionamiento, la transferencia de artefactos y el despliegue del stack de microservicios desde una máquina local hacia un servidor remoto (instancia EC2 o servidor Linux) mediante dos scripts de Bash: `migracion.sh` (orquestador local) y `ejecucion.sh` (ejecutor remoto).

---

## 1. Arquitectura del Flujo




[ Máquina Local ]                                     [ Servidor Remoto (EC2) ]
│                                                         │
migracion.sh                                                   │
├── 1. Valida clave SSH y conectividad                   │
├── 2. Crea directorios remotos (SSH) ───────────────────>│ mkdir -p ~/app/...
├── 3. Transfiere docker-compose.yml (SCP) ──────────────>│ ~/app/docker-compose.yml
├── 4. Transfiere .env por servicio (SCP) ───────────────>│ ~/app//.env
├── 5. Transfiere scripts SQL (SCP) ─────────────────────>│ ~/app/db/init-scripts/
├── 6. Transfiere entrypoint y da permisos (SCP/SSH) ────>│ ~/app/web/entrypoint.sh
├── 7. Transfiere ejecucion.sh (SCP/SSH) ────────────────>│ ~/ejecucion.sh
│                                                         │
└── 8. Invoca sesión interactiva (ssh -t) ───────────────>│ bash ~/ejecucion.sh
├── Instala Docker/Compose
├── Configura permisos
├── docker compose pull
└── docker compose up -d





## 2. Descripción de los Scripts

### A. `migracion.sh` (Ejecutado localmente)

Es el script orquestador encargado del empaquetado lógico y la sincronización de archivos hacia el host remoto mediante `ssh` y `scp`.

* **Validación de parámetros:** Recibe la clave privada `.pem`, la IP del servidor y, de manera opcional, el nombre de usuario SSH (usando `ubuntu` por defecto).
* **Búsqueda inteligente de claves:** Resuelve la clave SSH buscando en el directorio de ejecución actual o dentro del almacén `~/.ssh/`.
* **Aprovisionamiento de la estructura de directorios:** Conecta por SSH y genera el árbol de carpetas en `~/app/` necesario para alojar cada servicio, la base de datos y el proxy web.
* **Sincronización segmentada:**
  * Copia el manifiesto principal `docker-compose.yml`.
  * Recorre las carpetas locales (`api-clientes`, `api-facturas`, `api-pagos`, `api-tarjetas`, `api-transacciones`, `db`) y deposita sus respectivos archivos `.env` en directorios homónimos remotos para evitar mezclar credenciales.
  * Copia recursivamente los scripts de inicialización de base de datos (`db/init-scripts/*`).
  * Copia `web/entrypoint.sh` y `ejecucion.sh`, asignándoles permisos de ejecución (`chmod +x`).
* **Disparo remoto concatenado:** Ejecuta `ejecucion.sh` en el servidor utilizando la bandera `-t` en SSH. Esto reserva una pseudo-terminal (TTY), permitiendo el ingreso de contraseñas de `sudo` o prompts interactivos sin abortar la conexión.



### B. `ejecucion.sh` (Ejecutado en el servidor remoto)

Es el script encargado del aprovisionamiento del entorno de ejecución (runtime) y el ciclo de vida de los contenedores dentro del host de destino.

* **Actualización del sistema base:** Ejecuta `apt update` y `apt upgrade` para asegurar dependencias actualizadas e instala utilidades como `curl`.
* **Aprovisionamiento idempotente de Docker:** Evalúa si la utilidad `docker` ya se encuentra en el sistema; si no está presente, descarga y ejecuta el instalador oficial (`get-docker.sh`).
* **Gestión de privilegios:** Vincula al usuario remoto al grupo de sistema `docker` mediante `usermod -aG docker $USER`.
* **Hardening de archivos sensibles:** Aplica permisos restrictivos (`chmod 600`) sobre los archivos `.env` distribuidos para limitar la lectura exclusivamente al usuario propietario.
* **Ejecución sin reinicio de sesión (`sg docker`):** Resuelve la limitación de permisos inmediatos ejecutando el despliegue a través del subshell `sg docker -c "..."`. De esta forma, el usuario puede interactuar con el socket de Docker sin cerrar y reabrir la sesión SSH.
* **Lanzamiento de servicios:**
  * `docker compose pull`: Descarga las imágenes requeridas.
  * `docker compose up -d`: Levanta los contenedores en segundo plano.
  * `docker compose ps`: Reporta el estado de salud y operatividad de cada servicio.



## 3. Concatenación entre Scripts

La vinculación entre ambos scripts se logra en la fase final de `migracion.sh`:


# 1. Copia del script ejecutor a la raíz del home remoto
scp -i "$KEY_PATH" ejecucion.sh "${REMOTE_USER}@${EC2_IP}:~/ejecucion.sh"

# 2. Asignación de permisos de ejecución
ssh -i "$KEY_PATH" "${REMOTE_USER}@${EC2_IP}" "chmod +x ~/ejecucion.sh"

# 3. Disparo remoto con asignación de terminal (TTY)
ssh -t -i "$KEY_PATH" "${REMOTE_USER}@${EC2_IP}" "~/ejecucion.sh"



### Puntos clave de la concatenación:

1. **Paso de control transparente:** El operador solo ejecuta `migracion.sh` en su máquina local; una vez finalizada la transferencia de datos, el flujo transfiere el control de ejecución automáticamente al servidor.
2. **Uso del flag `-t`:** Garantiza la interactividad. Si el usuario en el servidor remoto exige contraseña para ejecutar comandos con `sudo`, el prompt se redirige a la terminal local del operador sin romper el flujo del script.
3. **Idempotencia:** Ambos scripts están diseñados para poder ejecutarse múltiples veces consecutivas; si un directorio o paquete ya existe, se actualiza o sobrescribe sin interrumpir la operación.

---

## 4. Modo de Uso

### Requisitos previos en la máquina local

* Permisos de ejecución en el script orquestador:

chmod +x migracion.sh




* Disponer de la clave `.pem` (en el directorio actual o en `~/.ssh/`).

### Sintaxis de ejecución


./migracion.sh <archivo-clave.pem> <IP_PUBLICA_O_PRIVADA> [usuario_remoto]



### Ejemplos

* **Con usuario predeterminado (`ubuntu`):**

./migracion.sh labsuser.pem 54.210.12.34



* **Con usuario personalizado:**

./migracion.sh mi_servidor.pem 192.168.0.225 agente_007




```

```
