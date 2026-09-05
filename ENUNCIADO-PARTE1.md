# TP 2026 — Parte 1: Dockerización y despliegue en AWS EC2

## Contexto

*FinTech Nova* decidió migrar su plataforma a una arquitectura de microservicios políglota:
cada equipo elige el lenguaje que mejor le sirve para su dominio. El resultado son **6
microservicios** que ustedes tienen que dockerizar, subir a Docker Hub y desplegar juntos en una
instancia EC2 de AWS.

Se les entrega el código fuente de los 6 microservicios, **ya funcionando en local** (sin
Docker). El trabajo del TP es dockerizarlos, orquestarlos y desplegarlos — no modificar la lógica
de negocio.

## Arquitectura

```
                         ┌─────────────────────────┐
                         │   web (Vite + NGINX)     │  <- unica puerta de entrada (puerto host)
                         └────────────┬────────────┘
             /api/clientes│  /api/pagos│  /api/facturas│  /api/transacciones│ /api/tarjetas
                          ▼            ▼             ▼                ▼             ▼
                 ┌──────────┐ ┌──────────┐  ┌───────────┐  ┌────────────────┐ ┌───────────┐
                 │api-      │ │api-      │  │api-       │  │api-            │ │api-       │
                 │clientes  │ │pagos     │  │facturas   │  │transacciones   │ │tarjetas   │
                 │(Python)  │ │(Node)    │  │(Java)     │  │(Go)            │ │(.NET)     │
                 └────┬─────┘ └────┬─────┘  └─────┬─────┘  └───────┬────────┘ └─────┬─────┘
                      │            │  \            │                │  \            │
                      │            │   \_ API      │                │   \_ API      │
                      │            │     externa   │                │     externa   │
                      │            │   (tipo de     │                │   (geo-       │
                      │            │    cambio)     │                │    localiz.)  │
                      ▼            ▼               ▼                ▼               ▼
                 ┌───────────────────────────────────────────────────────────────────┐
                 │                    UNA SOLA instancia de MariaDB                    │
                 │   db_clientes | db_pagos | db_facturas | db_transacciones | db_tarjetas │
                 └───────────────────────────────────────────────────────────────────┘
```

- **6 microservicios**: 1 web + 5 APIs, cada API en un lenguaje distinto.
- **Dos APIs llaman a una API externa pública** (de terceros, fuera del stack): `api-pagos`
  convierte ARS→USD con una API de tipo de cambio, `api-transacciones` geolocaliza la IP de
  origen. Si esa API externa falla, el ABM no se rompe (guardan el dato igual, sin el campo
  enriquecido).
- **Una sola instancia de base de datos** (un solo contenedor MariaDB) hospeda **5 bases
  distintas**, una por microservicio (`db_clientes`, `db_pagos`, `db_facturas`,
  `db_transacciones`, `db_tarjetas`) — no son 5 contenedores de base de datos, es 1 contenedor
  con 5 esquemas.
- **Todo se despliega en una única instancia EC2 de AWS.**

## Microservicios

| Carpeta                | Lenguaje / stack          | Entidad (ABM)   | Llama a una API externa |
|-------------------------|----------------------------|------------------|:---:|
| `api-clientes/`         | Python (Flask)             | clientes         |     |
| `api-pagos/`            | Node.js (Express)          | pagos            | ✅ (tipo de cambio) |
| `api-facturas/`         | Java (Spring Boot)         | facturas         |     |
| `api-transacciones/`    | Go (net/http estándar)     | transacciones    | ✅ (geolocalización) |
| `api-tarjetas/`         | .NET (ASP.NET Core Minimal API) | tarjetas    |     |
| `web/`                  | Vite (JS vanilla)          | —                |     |
| `db/`                   | MariaDB (1 instancia, 5 bases) | —            |     |

Cada `api-*/README.md` y `web/README.md` explica cómo levantar ESE microservicio en local (sin
Docker) para poder desarrollarlo/probarlo antes de dockerizarlo.

## Lo que NO se les da (es la consigna del TP)
- Ningún `Dockerfile` (ni en `db/`, ni en ninguna `api-*/`, ni en `web/`).
- Ningún `.dockerignore` — también lo escriben ustedes, por cada microservicio.
- Ningún `docker-compose.yml`.
- Nada de infraestructura en AWS (la instancia EC2 la crean ustedes).

## Consigna

### 1. Dockerizar cada microservicio
Para cada uno de los 6 (`db`, las 5 `api-*` y `web`), escribir su `Dockerfile` y su
`.dockerignore` (para no mandar `node_modules/`, `venv/`, `target/`, `bin/`/`obj/`, `.git/` ni
`.env` al build context):

- **`db/`**: imagen base `mariadb:11.8.9-ubi9`. Copiar `db/init-scripts/` a
  `/docker-entrypoint-initdb.d` (el script `00-databases.sh` crea las 5 bases y da permisos al
  usuario de aplicación; los `.sql` numerados del 01 al 05 crean cada tabla). Volumen
  persistente.
- **`api-clientes/`** (Python): instalar `requirements.txt`. Pensar si conviene un entorno
  virtual dentro de la imagen.
- **`api-pagos/`** (Node): `npm ci`. Necesita salida a internet en runtime (llama a la API de
  tipo de cambio).
- **`api-facturas/`** (Java/Maven): acá el multistage no es opcional si quieren una imagen final
  liviana — compilar con una imagen de Maven+JDK, correr con una imagen de JRE.
- **`api-transacciones/`** (Go): compila a un binario estático. Multistage típico: compilar con
  `golang:1.22` (o similar), copiar solo el binario a una imagen final mínima
  (`alpine`/`scratch`). Necesita salida a internet en runtime (llama a la API de
  geolocalización).
- **`api-tarjetas/`** (.NET): multistage típico también — `dotnet publish` con la imagen del SDK,
  correr con la imagen `aspnet` (runtime).
- **`web/`** (Vite): multistage — `npm run build` con una imagen de `node`, servir `dist/` con
  `nginx` usando `web/nginx/nginx.conf` (ya armado, con los 5 proxys a las APIs).

Todas las APIs escuchan en el puerto `8080` por defecto (variable `PORT`).

### 2. Generar las imágenes y subirlas a Docker Hub
Crearse una cuenta en [Docker Hub](https://hub.docker.com/) si no tienen. Para cada uno de los 6
microservicios:

```sh
docker build -t <usuario-dockerhub>/<nombre-servicio>:1.0.0 -f <servicio>/Dockerfile .
docker login
docker push <usuario-dockerhub>/<nombre-servicio>:1.0.0
```

Por ejemplo, para `api-clientes`: `docker build -t miusuario/api-clientes:1.0.0 -f
api-clientes/Dockerfile .` (el build se corre desde la raíz de `tp-2026/`, igual que en las
clases/prácticas anteriores).

Al finalizar deberían tener 6 imágenes públicas (o privadas, según elijan) en su cuenta de Docker
Hub.

### 3. Orquestar todo con `docker-compose.yml`
Escribir un `docker-compose.yml` en la raíz de `tp-2026/` que:
- Use las 6 imágenes de **Docker Hub** (no `build:` local — el compose que corra en la EC2 va a
  hacer `docker compose pull` + `docker compose up -d`).
- Defina una network compartida para los 6 servicios.
- Use `env_file` para las credenciales de cada servicio (nunca hardcodeadas en el compose).
- La(s) API que necesite conectarse a la DB tiene que apuntar `DB_HOST` al nombre del contenedor
  de la DB (recuerden: es una sola instancia, 5 bases).
- Solo `web` publica puerto al host.
- Agregue **límites de recursos** (`deploy.resources.limits`, cpus y memoria) a cada servicio —
  piensen que la instancia EC2 va a tener recursos limitados (free tier) corriendo 6 contenedores
  + la DB al mismo tiempo.
- `restart: always` en los 6 servicios.

### 4. Desplegar en una instancia EC2 de AWS
- Crear una instancia EC2 (Ubuntu Server LTS, `t3.micro` o similar — free tier).
- Configurar el **Security Group** para permitir SSH (22, solo desde su IP) y el puerto donde
  publiquen `web` (por ejemplo 80 u 8080, desde `0.0.0.0/0` para poder mostrar el TP).
- Conectarse por SSH e instalar Docker + el plugin de Docker Compose.
- Copiar a la instancia: `docker-compose.yml`, los `.env` de cada servicio (**nunca** subirlos al
  repositorio git) y `db/init-scripts/` (los necesita el contenedor de la DB).
- `docker login`, `docker compose pull`, `docker compose up -d`.
- Verificar que los 6 contenedores estén `Up` (`docker compose ps`).

### 5. Probar
Desde su máquina, contra la IP pública de la EC2:
```sh
curl http://<ip-publica-ec2>:<puerto>/
curl http://<ip-publica-ec2>:<puerto>/api/clientes
curl http://<ip-publica-ec2>:<puerto>/api/pagos
curl http://<ip-publica-ec2>:<puerto>/api/facturas
curl http://<ip-publica-ec2>:<puerto>/api/transacciones
curl http://<ip-publica-ec2>:<puerto>/api/tarjetas
```
Y abrir la web desde el navegador para probar el ABM de las 5 entidades de punta a punta.

## Puntos de entrega

### 1. Archivos ignorados correctamente
- `.gitignore` en la raíz del repo (ya viene armado como base — revisen que cubra lo necesario). Pueden ayudarse de esta
  [página](https://www.toptal.com/developers/gitignore/).

### 2. Por cada uno de los 6 microservicios
- `Dockerfile`: multistage donde corresponda (ver la sección "Consigna" — Java, Go, .NET y la web
  con Vite casi seguro lo necesitan; Python y Node, depende cómo lo resuelvan).
- `.dockerignore` si hace falta.

### 3. `docker-compose.yml`
- Usa las 6 imágenes **ya creadas y subidas a Docker Hub** — no es válido que el compose las
  buildee (nada de `build:` ni `docker compose up --build`).

### 4. Un `README.md` propio del grupo
(No confundir con este enunciado — es la documentación de SU solución.)
- Explicación/introducción de la solución y las decisiones de diseño que tomaron.
- **Diagrama de arquitectura** de cómo quedó desplegado el stack en la EC2: la instancia, la
  network compartida, los 6 contenedores (`web` + las 5 `api-*` + `db`) y las 2 llamadas a APIs
  externas (tipo de cambio y geolocalización) saliendo hacia afuera de la instancia. No hace
  falta una herramienta específica (draw.io, Excalidraw, una foto de un dibujo a mano, etc. —
  todo vale), pero tiene que reflejar la arquitectura real que desplegaron, no la de este README.
- Sección con **posibles mejoras** que identifiquen.
- Links a Docker Hub (las 6 imágenes), a la IP pública de la EC2, y a los demás `.md`
  (`ERRORES.md`, `SEGURIDAD.md`, `AWS_EC2.md`).
- Capturas o salidas de `curl`/Postman probando los 5 endpoints a través de la web pública.

### 5. Glosario de errores
- Un archivo `ERRORES.md`: con los errores que se les presentaron (build, conexión a la DB
  compartida, permisos/Security Group en la EC2, etc.) y cómo los resolvieron.

### 6. Documentación de Seguridad
- Un archivo `SEGURIDAD.md`:
  - Cómo gestionaron los secretos (`env_file`, nunca hardcodeados) y cómo los llevaron a la EC2
    sin subirlos al repositorio.
  - Resultados de escaneos de seguridad si corrieron alguno (Trivy/Checkov) — no es obligatorio,
    pero se valora.
  - Buenas prácticas aplicadas (usuarios no-root en los Dockerfiles, imágenes base oficiales,
    Security Group de la EC2 acotado a los puertos necesarios) [OWASP Docker Top 10](https://owasp.org/www-project-docker-top-10/).

### 7. Script de ejecución
- Un `deploy.sh` (o deploy.py) que automatice el build de las 6 imágenes, el push a Docker Hub y,
  de ser posible, el deploy remoto a la EC2 (`docker compose pull` + `up -d`).
- Tiene que incluir alguna prueba de que todo quedó levantado bien (los `curl` de la sección
  "Probar"), no alcanza con un `docker compose ps`.
  > **Importante (reproducibilidad)**: en la presentación se puede pedir dar de baja todos los
  > contenedores/volúmenes/red de la EC2 y volver a levantar todo desde cero con este script.

### 8. Evidencia de la configuración de AWS
- Un archivo `AWS_EC2.md` con:
  - IP pública (o DNS) de la instancia.
  - Sistema operativo / AMI de la EC2.
  - Datos de la VPC y la subred donde corre la instancia.
  - Security Group: reglas de **entrada** y de **salida** (puerto, protocolo, origen/destino).
  - Cómo se conectaron a la instancia (SSH, con qué usuario).
  - Qué tuvieron que configurar en la instancia **antes** de poder levantar los contenedores
    (instalar Docker, el plugin de Docker Compose, `docker login`, etc.).
  - Si usaron **AWS CLI** para crear o configurar algo (instancia, Security Group, etc.), los
    comandos que ejecutaron; si lo hicieron desde la consola web, capturas de esa configuración
    (Security Group con las reglas de entrada/salida, detalle de la instancia).

### 9. Para pensar / responder
- Respuestas a la sección "Para pensar / responder" de más abajo.

## Material
- Documentación oficial correspondiente (Docker, Docker Compose, Docker Hub, AWS EC2).
- Clases. [Material extra](https://labsys.frc.utn.edu.ar/gitlab/desarrollo-y-operaciones-devops/material/material-de-lectura)
- Chat GPT / Claude (importante que entiendan las respuestas que están copiando/utilizando).

## Metodología de TP
- Las soluciones propuestas serán presentadas en vivo, durante el horario de clases, de forma
  presencial. El grupo entero participa, y el resto de la clase puede hacer preguntas o
  comentarios. Usaremos esto para feedback grupal: **¿Qué salió bien? ¿Qué se podría mejorar?**
- Todos los puntos solicitados deberán quedar en los repositorios creados y distribuidos para
  este TP; un proyecto que no tenga su última versión subida a la rama `main` (o la rama default)
  no será considerado al momento de cargar la nota.
- En clase, cada grupo va a mostrar el stack corriendo **en la instancia EC2** (no en local),
  haciendo las pruebas de `curl`/navegador en vivo contra la IP pública, y explicando las
  decisiones de diseño (por qué esa arquitectura, cómo manejaron los secretos, cómo resolvieron
  la conexión a la DB compartida). Duración: 10-15 minutos por grupo. Durante la presentación se
  pueden hacer preguntas conceptuales.

### Criterios de Evaluación
- Funcionalidad del stack completo corriendo en la EC2.
- Calidad de la dockerización (multistage donde corresponde, imágenes livianas, buenas
  prácticas).
- Manejo de secretos y seguridad (variables de entorno, Security Group, usuarios no-root).
- Documentación clara (`README.md`, `ERRORES.md`, `SEGURIDAD.md`, diagrama de arquitectura) y
  script de ejecución.
- Presentación y trabajo en equipo.
> Hay una nota grupal y una nota individual para evaluar la participación de todos los
> integrantes.

>Si hay dudas, no duden en contactarnos por los medios establecidos.

## Para pensar / responder
1. ¿Qué ventajas y qué desventajas tiene compartir una sola instancia de MariaDB para los 5
   microservicios, en vez de un contenedor de DB por microservicio?
2. ¿Qué microservicios necesitan un Dockerfile multistage para tener una imagen final liviana, y
   cuáles no lo necesitan tanto? ¿Por qué?
3. `api-pagos` y `api-transacciones` dependen de una API pública externa. ¿Qué pasa con el ABM si
   esa API externa está caída? ¿Cómo lo manejaron en el código?
4. En la EC2, ¿cómo evitaron subir las contraseñas de la base de datos al repositorio git?
5. Si tuvieran que exponer este stack de forma segura en internet (no solo para mostrar el TP),
   ¿qué le agregarían? (pensar en HTTPS, secrets, límites de recursos, backups del volumen de la
   DB, etc.)
