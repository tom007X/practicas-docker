# TP 2026 — Parte 1: Dockerización y despliegue en AWS EC2 🐳

## Contexto

*FinTech Nova* decidió migrar su plataforma a una arquitectura de microservicios políglota:
cada equipo elige el lenguaje que mejor le sirve para su dominio. El resultado son **6
microservicios** que ustedes tienen que dockerizar, subir a Docker Hub y desplegar juntos en una
instancia EC2 de AWS, expuestos únicamente por HTTPS.

Se les entrega el código fuente de los 6 microservicios, **ya funcionando en local** (sin
Docker). El trabajo del TP es dockerizarlos, orquestarlos y desplegarlos — no modificar la lógica
de negocio.

## Arquitectura

```
                         ┌─────────────────────────┐
                         │   web (Vite + NGINX)    │  <- unica puerta de entrada (HTTPS, puerto host)
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
                      │            │   (tipo de    │                │   (geo-       │
                      │            │    cambio)    │                │    localiz.)  │
                      ▼            ▼               ▼                ▼               ▼
                 ┌─────────────────────────────────────────────────────────────────────────┐
                 │                    UNA SOLA instancia de MariaDB                        │
                 │   db_clientes | db_pagos | db_facturas | db_transacciones | db_tarjetas │
                 └─────────────────────────────────────────────────────────────────────────┘
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
- **Todo se despliega en una única instancia EC2 de AWS**, accesible **solo por HTTPS**.

### Grupos de 5 integrantes

Si el grupo es de 5, deben sumar un **7º microservicio: un segundo frontend** (`web2/`, con la
tecnología que prefieran: React, Angular, HTML estático servido con NGINX, etc.). No hace falta
que consuma las APIs; alcanza con que sea accesible. Reglas:

- Lleva su propio `Dockerfile` y `.dockerignore` (multistage si necesita compilar), se sube a
  Docker Hub (**7 imágenes** en total) y entra al `docker-compose.yml` con los mismos requisitos
  que el resto: `env_file` si corresponde, network compartida, límites de recursos y
  `restart: always`.
- Se accede **solo por HTTPS**, igual que el resto del stack. Pueden exponerlo como una ruta del
  NGINX de `web` (por ejemplo `/web2/`) o con un segundo puerto HTTPS publicado (443 u 8443).
  Si eligen lo segundo, tiene que estar abierto en el Security Group y documentado. El puerto 80
  sigue cerrado.
- Se refleja en todo lo demás: diagrama de arquitectura, `deploy.sh`, `curl` de la sección
  "Probar" y README del grupo.

> 💡 **Este stack es un caso de referencia, no una obligación cerrada.** Pueden usar otros
> microservicios, agregar/quitar alguno o construir su propio frontend, siempre que el resultado
> siga demostrando lo mismo que se evalúa acá: dockerización correcta de varios servicios en
> lenguajes distintos, orquestación con `docker-compose.yml`, una base de datos compartida,
> manejo de secretos y despliegue funcional en EC2 detrás de HTTPS. El objetivo del TP es que
> entiendan y sepan explicar el despliegue, no que reproduzcan esta aplicación puntual.

## Microservicios

La siguiente tabla describe el caso de referencia (dentro de "aplicaciones-contenedores"). Si arman su propia variante (ver nota
anterior), ajústenla a su stack real, pero **respeten la misma lógica**: varios lenguajes, una
DB compartida y al menos una dependencia de una API externa.

| Carpeta                | Lenguaje / stack          | Entidad (ABM)      | Llama a una API externa |
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
- Ningún certificado TLS — lo generan ustedes (ver punto 1 de la Consigna).
- Nada de infraestructura en AWS (la instancia EC2 la crean ustedes).

## Consigna

### 1. Dockerizar cada microservicio
Para cada uno de los 6 (`db`, las 5 `api-*` y `web`), escribir su `Dockerfile` y su
`.dockerignore` (para no mandar `node_modules/`, `venv/`, `target/`, `bin/`/`obj/`, `.git/`,
`.env` ni certificados/claves privadas al build context):

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
  `nginx`. El `web/nginx/nginx.conf` que se entrega trae ya armados los 5 proxys a las APIs,
  pero **es un punto de partida, no el archivo final**: van a tener que extenderlo para servir
  HTTPS (ver punto siguiente).

Todas las APIs escuchan en el puerto `8080` por defecto (variable `PORT`).

#### 🔒 HTTPS obligatorio (única puerta de entrada)

El stack completo se expone **solo por HTTPS**. El TLS se termina en `web`/NGINX — las 5 APIs
siguen hablando HTTP puro puertas adentro de la red de Docker, no hace falta (ni se espera)
que cada una tenga su propio certificado.

- Generen un certificado autofirmado (self-signed). Como no hay un dominio propio y la IP de la
  instancia puede cambiar entre sesiones del sandbox (ver más abajo), **alcanza con un CN/SAN
  genérico** — no hace falta que coincida con la IP real. La advertencia de "certificado no
  confiable" del navegador es esperada y no resta puntos.
- **Cómo y cuándo generar el certificado y la clave privada queda a criterio del grupo**:
  puede hacerse en build-time (dentro del `Dockerfile`, con OpenSSL) o en runtime (por ejemplo
  desde un entrypoint al levantar el contenedor). Documenten y justifiquen la decisión en
  `SEGURIDAD.md`.
  > ⚠️ **Ojo si lo generan en build-time:** como la imagen de `web` va a ser pública en Docker
  > Hub (ver punto 2), una clave privada generada dentro del `Dockerfile` queda embebida y
  > descargable por cualquiera. Para un certificado autofirmado de un TP el riesgo real es bajo,
  > pero choca con el principio de "nunca hardcodear secretos" que pedimos en el resto del TP.
  > Si eligen este camino, que sea una decisión consciente y explicada en `SEGURIDAD.md`, no un
  > efecto colateral sin notar.
- NGINX debe escuchar HTTPS en el puerto **443 u 8443** (a elección del grupo, sean consistentes
  en `docker-compose.yml`, Security Group y documentación). **El puerto 80 no se usa ni se abre
  en ningún lado** — nada de HTTP sin cifrar, ni siquiera para redirigir.

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

Al finalizar deberían tener **6 imágenes públicas** en su cuenta de Docker Hub (públicas para
simplificar el `pull` en la EC2 — no hace falta manejar credenciales adicionales de Docker Hub
en la instancia).

### 3. Orquestar todo con `docker-compose.yml`
Escribir un `docker-compose.yml` en la raíz de `tp-2026/` que:
- Use las 6 imágenes de **Docker Hub** (no `build:` local — el compose que corra en la EC2 va a
  hacer `docker compose pull` + `docker compose up -d`).
- Defina una network compartida para los 6 servicios.
- Use `env_file` para las credenciales de cada servicio (nunca hardcodeadas en el compose).
- La(s) API que necesite conectarse a la DB tiene que apuntar `DB_HOST` al nombre del contenedor
  de la DB (recuerden: es una sola instancia, 5 bases).
- Solo `web` publica puerto al host, y **únicamente el puerto HTTPS elegido (443 u 8443)**.
- Agregue **límites de recursos** (`deploy.resources.limits`, cpus y memoria) a cada servicio —
  piensen que la instancia EC2 va a tener recursos limitados corriendo 6 contenedores + la DB al
  mismo tiempo (Java/Spring Boot en particular puede necesitar ajustar el heap de la JVM).
- `restart: always` en los 6 servicios.

### 4. Desplegar en una instancia EC2 de AWS Academy

- Crear una instancia EC2 en el **AWS Academy Learner Lab (Sandbox)**: tipo `t3.medium`, con
  Ubuntu Server 26 o Amazon Linux 2023.
- Configurar el **Security Group** para permitir únicamente:
  - SSH (22), solo desde su IP.
  - El puerto HTTPS elegido (443 u 8443), desde `0.0.0.0/0` para poder mostrar el TP.
  - Nada más — en particular, **el puerto 80 queda cerrado**.
- Conectarse por SSH (o consola WEB) e instalar Docker + el plugin de Docker Compose.
- Copiar a la instancia: `docker-compose.yml`, los `.env` de cada servicio (**nunca** subirlos al
  repositorio git), el certificado/clave TLS (tampoco al repositorio) y `db/init-scripts/` (los
  necesita el contenedor de la DB).
- `docker login`, `docker compose pull`, `docker compose up -d`.
- Verificar que los 6 contenedores estén `Up` (`docker compose ps`).

> ⚠️ **Particularidad del sandbox — leer antes de empezar:** el AWS Academy Learner Lab tiene un
> límite de **2 horas por sesión**, y cada vez que lo relanzan reciben una instancia nueva: la
> IP pública, el Security Group y el par de llaves SSH **no se mantienen entre sesiones**.
> Pueden relanzar el sandbox tantas veces como necesiten para ir ajustando su configuración, pero
> planifiquen el trabajo dentro de esa ventana de 2 horas por intento. Justamente por esto, el
> `deploy.sh` (punto 7 de "Puntos de entrega") tiene que dejar la instancia lista de cero —
> incluyendo instalar Docker y el plugin de Compose — para no repetir todo a mano en cada sesión.

### 5. Probar
Desde su máquina, contra la IP pública de la EC2 (con `-k` porque el certificado es
autofirmado):
```sh
curl -k https://<ip-publica-ec2>:<puerto>/
curl -k https://<ip-publica-ec2>:<puerto>/api/clientes
curl -k https://<ip-publica-ec2>:<puerto>/api/pagos
curl -k https://<ip-publica-ec2>:<puerto>/api/facturas
curl -k https://<ip-publica-ec2>:<puerto>/api/transacciones
curl -k https://<ip-publica-ec2>:<puerto>/api/tarjetas
```
Y abrir la web desde el navegador para probar el ABM de las 5 entidades de punta a punta.

📸 **Hagan esto dentro de una misma sesión del sandbox** y tomen las capturas de estas pruebas
en ese momento — son las que van a documentar en el `README.md` y mostrar en la presentación
(ver "Metodología de TP").

## Puntos de entrega

### 1. Archivos ignorados correctamente
- `.gitignore` en la raíz del repo (ya viene armado como base — revisen que cubra lo necesario,
  incluyendo certificados y claves privadas si los generan como archivos sueltos). Pueden
  ayudarse de esta [página](https://www.toptal.com/developers/gitignore/).

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
- **Portada con los apellidos y/o legajos de los integrantes del grupo**, visible en el frontend
  desplegado (validación mínima de autoría del trabajo).
- **Diagrama de arquitectura** de cómo quedó desplegado el stack en la EC2: la instancia, la
  network compartida, los 6 contenedores (`web` + las 5 `api-*` + `db`), el HTTPS como único
  punto de entrada y las 2 llamadas a APIs externas (tipo de cambio y geolocalización) saliendo
  hacia afuera de la instancia. No hace falta una herramienta específica (draw.io, Excalidraw,
  una foto de un dibujo a mano, etc. — todo vale), pero tiene que reflejar la arquitectura real
  que desplegaron, no la de este README.
- Sección con **posibles mejoras** que identifiquen.
- Links a Docker Hub (las 6 imágenes) y a los demás `.md` (`ERRORES.md`, `SEGURIDAD.md`,
  `AWS_EC2.md`).
- **Capturas de pantalla** de la aplicación funcionando en AWS y de los `curl`/Postman contra los
  5 endpoints a través de la web pública, tomadas durante una sesión real del sandbox. No hay
  demo en vivo durante la presentación: estas capturas son la evidencia de funcionamiento y se
  muestran en pantalla al exponer.

### 5. Glosario de errores
- Un archivo `ERRORES.md`: con los errores que se les presentaron (build, conexión a la DB
  compartida, HTTPS/certificado, permisos/Security Group en la EC2, etc.) y cómo los resolvieron.

### 6. Documentación de Seguridad
- Un archivo `SEGURIDAD.md`:
  - Cómo gestionaron los secretos (`env_file`, nunca hardcodeados) y cómo los llevaron a la EC2
    sin subirlos al repositorio.
  - Cómo y cuándo generaron el certificado/clave TLS (build-time o runtime) y por qué eligieron
    esa opción, incluyendo cómo evitaron subir la clave privada al repositorio.
  - Resultados de escaneos de seguridad si corrieron alguno (Trivy/Checkov) — no es obligatorio,
    pero se valora.
  - Buenas prácticas aplicadas (usuarios no-root en los Dockerfiles, imágenes base oficiales,
    Security Group de la EC2 acotado a los puertos necesarios) [OWASP Docker Top 10](https://owasp.org/www-project-docker-top-10/).

### 7. Script de ejecución
- Un `deploy.sh` (o `deploy.py`) que automatice, de punta a punta: dejar la instancia lista
  (instalar Docker y el plugin de Docker Compose), el build de las 6 imágenes, el push a Docker
  Hub y el deploy remoto a la EC2 (`docker compose pull` + `up -d`).
- Tiene que incluir alguna prueba de que todo quedó levantado bien (los `curl` de la sección
  "Probar"), no alcanza con un `docker compose ps`.
  > **Reproducibilidad:** el script debe poder correrse de punta a punta de forma independiente
  > (por ejemplo, contra una instancia nueva del sandbox). No se va a exigir una demostración en
  > vivo en la presentación, pero es un requisito real de calidad del TP — un script que solo
  > funciona "a mano, con ajustes" no cumple el objetivo.

### 8. Evidencia de la configuración de AWS
- Un archivo `AWS_EC2.md` con:
  - IP pública (o DNS) de la instancia, **correspondiente a la última sesión** en la que
    probaron todo (ver nota del sandbox más abajo).
  - Sistema operativo / AMI de la EC2 (Ubuntu Server 26 o Amazon Linux 2023).
  - Datos de la VPC y la subred donde corre la instancia.
  - Security Group: reglas de **entrada** y de **salida** (puerto, protocolo, origen/destino) —
    SSH acotado a su IP, HTTPS abierto, puerto 80 cerrado.
  - Cómo se conectaron a la instancia (SSH, con qué usuario).
  - Qué tuvieron que configurar en la instancia **antes** de poder levantar los contenedores
    (instalar Docker, el plugin de Docker Compose, `docker login`, etc.).
  - Capturas de la configuración desde la consola web (Security Group con las reglas de
    entrada/salida, detalle de la instancia) o, si usaron **AWS CLI**, los comandos que
    ejecutaron. Cualquiera de las dos formas es válida y no afecta la nota.

> ⚠️ **Recordatorio del sandbox:** como cada relanzamiento del Learner Lab genera una instancia,
> IP, Security Group y llaves nuevas, tomen todas las capturas de una **misma sesión** y después
> redacten la documentación tranquilos, offline, con esos datos. No hace falta que la IP
> documentada siga viva al momento de entregar el TP.

## Material
- Documentación oficial correspondiente (Docker, Docker Compose, Docker Hub, AWS EC2, AWS
  Academy).
- Clases. [Material extra](https://labsys.frc.utn.edu.ar/gitlab/desarrollo-y-operaciones-devops/material/material-de-lectura)
- Chat GPT / Claude (importante que entiendan las respuestas que están copiando/utilizando).

## Metodología de TP
- Las soluciones propuestas serán presentadas en vivo, durante el horario de clases, de forma
  presencial. El grupo entero participa, y el resto de la clase puede hacer preguntas o
  comentarios. Usaremos esto para feedback grupal: **¿Qué salió bien? ¿Qué se podría mejorar?**
- Todos los puntos solicitados deberán quedar en los repositorios creados y distribuidos para
  este TP; un proyecto que no tenga su última versión subida a la rama `main` (o la rama default)
  no será considerado al momento de cargar la nota.
- **No hay ejecución en vivo del stack en AWS.** En clase, cada grupo va a mostrar su
  documentación y las capturas de pantalla (incluyendo las de los `curl`/navegador contra la IP
  pública), y va a explicar las decisiones de diseño: por qué esa arquitectura, cómo manejaron
  los secretos y el certificado TLS, cómo resolvieron la conexión a la DB compartida. Duración:
  10-15 minutos por grupo. Durante la presentación se pueden hacer preguntas conceptuales a
  **cualquier integrante**, rotando entre todos — la nota individual depende de cómo cada uno
  explica lo realizado y demuestra los conocimientos adquiridos, más allá de qué parte haya
  programado.
- Grupos de 4 integrantes: es esperable que una persona sea responsable de dos microservicios;
  aun así, **todos deben poder explicar la arquitectura completa**, no solo su parte.
- Grupos de 5 integrantes: deben **agregar un 7º microservicio, un segundo frontend** (ver
  "Grupos de 5 integrantes" en "Arquitectura").

### Criterios de Evaluación
- Funcionalidad del stack completo, verificada a través de la documentación y las capturas de
  pantalla (no en vivo).
- Calidad de la dockerización (multistage donde corresponde, imágenes livianas, buenas
  prácticas).
- HTTPS correctamente configurado como único punto de acceso al stack.
- Manejo de secretos y seguridad (variables de entorno, certificado TLS, Security Group,
  usuarios no-root).
- Documentación clara (`README.md`, `ERRORES.md`, `SEGURIDAD.md`, diagrama de arquitectura) y
  script de ejecución reproducible.
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
4. En la EC2, ¿cómo evitaron subir las contraseñas de la base de datos (y el certificado TLS) al
   repositorio git?