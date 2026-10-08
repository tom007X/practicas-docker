# Registro de Errores y Soluciones

# ERRORES AL CREAR Y LEVANTAR LAS APP POR DOCKERFILE Y DOCKER COMPOSE



### 1. Puertos innecesarios en Docker Compose
* **Error:** Duda sobre exponer los puertos de cada API (`ports:`) para alcanzarlas con `curl`.
* **Causa:** Desconocer que Nginx actúa como Reverse Proxy dentro de la red interna de Docker.
* **Solución:** Exponer únicamente el puerto seguro (`8443` o `443`) en Nginx. Las APIs permanecen ocultas en la red privada y Nginx rutea internamente vía `proxy_pass`.




### 2. api-tarjetas (C# / .NET 8) - 

### Archivo de proyecto inexistente
* **Error:** `MSBUILD : error MSB1009: Project file does not exist. Switch: MiApp.csproj`.
* **Causa:** El `Dockerfile` intentaba compilar un archivo con nombre genérico que no coincidía con el nombre real del archivo `.csproj` o su ruta en el contexto.
* **Solución:** Reemplazar `MiApp.csproj` por el nombre exacto (`ApiTarjetas.csproj`) o ejecutar `dotnet publish` sin argumentos para que detecte el único proyecto del directorio.




### 3. Ensamblado principal no encontrado
* **Error:** `The application to execute does not exist: '/app/ApiTarjetas.dll'`.
* **Causa:** Desalineación entre la publicación y la imagen base; se publicó con `--self-contained` sin activar Native AOT (`<PublishAot>`), generando un ejecutable AppHost en vez de la DLL esperada por la imagen de runtime estándar.
* **Solución:** Compilar en modo dependiente del framework usando `/p:UseAppHost=false`, empaquetar sobre `aspnet:8.0-alpine` y definir el arranque con `ENTRYPOINT ["dotnet", "ApiTarjetas.dll"]`.



### 4. api-transacciones (Go 1.22) - 

### Paquete no importado
* **Error:** `./geolocation.go:23:12: undefined: os`.
* **Causa:** Se invocó `os.Getenv("GEO_KEY")` para leer la variable de entorno sin haber declarado el paquete estándar en la sección de imports.
* **Solución:** Agregar `"os"` dentro del bloque `import (...)` en `geolocation.go`.

### Formateo de URL e interpolación
* **Error:** Concatenación inválida dentro de `fmt.Sprintf` e intento de interpolación de variables al estilo shell (`${GEO_KEY}`).
* **Causa:** Confundir la sintaxis de reemplazo de cadenas de Go con la interpolación de bash/shell scripts.
* **Solución:** Usar los especificadores `%s` correspondientes: `fmt.Sprintf("https://.../%s?access_key=%s", ip, geoKey)`.




### 6. web_nginx (NGINX) - 
### Fallo de resolución DNS interna
* **Error:** `[error] 10#10: *6 api-transacciones could not be resolved (2: Server failure)`.
* **Causa:** Nginx y la API de transacciones no compartían la misma red en `docker-compose.yml`, o existía una colisión de puertos mapeados al host en `8080`.
* **Solución:** Asociar ambos servicios a una red común compartida (`networks: - internal-net`) y eliminar el mapeo directo de puertos al host en los microservicios.




### 7. web_nginx (NGINX) - 
### Archivo de configuración fuera de contexto
* **Error:** `failed to compute cache key: ... "/nginx.conf": not found`.
* **Causa:** Discrepancia entre la ruta del archivo y la directiva `context` declarada en `docker-compose.yml

### 
* **Archivo no encontrado en Build Context:**
  * **Síntoma:** `failed to compute cache key ... "/nginx/nginx.conf": not found`.
  * **Causa:** Ejecución de `docker build` con contexto en la raíz (`.`) mientras el `Dockerfile` contenía rutas relativas a la carpeta `web/` (`COPY ./nginx/nginx.conf ...`).
  * **Solución:** Definir el contexto explícito en la carpeta del servicio (`docker build -f web/Dockerfile web/`).



### 8 Backend API (`node-app` / `api-productos`) — Node.js / Docker Compose

* **Referencia a red no declarada (*Undefined Network*):**
  * **Síntoma:** `service "node-app" refers to undefined network backend-db: invalid compose project`.
  * **Causa:** Desajuste de nombres entre la red asignada al servicio (`backend-db`) y la red global definida al final del Compose (`backend-db-network`).
  * **Solución:** Estandarizar el nombre a `backend-db-network` en todos los bloques.





### 9 Base de Datos (`mariadb` ) — MariaDB 11.8 / SQL / Shell

* **Sintaxis de mapeo en volumen raíz:**
  * **Síntoma:** `validating docker-compose.yml: volumes must be a mapping`.
  * **Causa:** Declaración incorrecta de `volumes:` en la raíz del archivo Compose (definido como lista con guiones `-` o sin clave vacía `:`).
  * **Solución:** Configurar los volúmenes raíz como diccionario (`mariadb_data:`).

* **Falso positivo de autenticación en Healthcheck:**
  * **Síntoma:** Log repetitivo `[Warning] Access denied for user 'mysql'@'localhost' (using password: NO)` cada 30 segundos.
  * **Causa:** `mariadb-admin ping` o el flag `-h localhost` forzaba una conexión TCP/IP intentando autenticar al usuario local del sistema sin contraseña.
  * **Solución:** Forzar el protocolo de socket Unix (`mariadb-admin ping --protocol=socket`) o emplear el script nativo de la imagen (`healthcheck.sh --connect`).

* **Fallo al invocar flags inexistentes en script de comprobación:**
  * **Síntoma:** El healthcheck falló y el contenedor no levantó al usar `healthcheck.sh --su-mysql --connect`.
  * **Causa:** Uso de flags incompatibles con el entorno de ejecución restringido del proceso de chequeo.
  * **Solución:** Simplificar el comando al soporte base `healthcheck.sh --connect`.





### 10 Api-factura Java 21 / Spring Boot 3 


#### 1. Fallo de resolución DNS desde el Reverse Proxy (502 Bad Gateway)
* **Log del error:**  
  `[error] api-facturas could not be resolved (2: Server failure)`
* **Causa:** El contenedor `web_nginx` y el contenedor `api-facturas` no compartían la misma red bridge en Docker Compose (`frontend-net` / red de aplicación). Al estar en redes aisladas, el DNS interno de Docker (`127.0.0.11`) no podía resolver el nombre de host `api-facturas`.
* **Solución aplicada:** Conectar `api-facturas` a ambas redes: la red compartida con Nginx para tráfico HTTP y la red interna hacia la base de datos.



#### 2. Rechazo de conexión TCP durante el arranque (111: Connection Refused)
* **Log del error:**  
  `connect() failed (111: Connection refused) while connecting to upstream, upstream: "http://172.21.0.3:8080/facturas"`
* **Causa:** Las peticiones HTTP desde el frontend llegaron a Nginx mientras el proceso de Spring Boot aún se encontraba en fase de arranque e inicialización de beans (el contexto tardó más de 30 segundos en levantar). Como Tomcat todavía no había abierto el socket en el puerto `8080`, el kernel rechazó la conexión.
* **Solución aplicada:** Esperar a que el log confirme `Tomcat started on port 8080 (http)` y `Started ApiFacturasApplication` antes de emitir tráfico.


#### 3. Error interno del servidor en la persistencia de datos (HTTP 500 al hacer POST)
* **Log del error:**  
  `HTTP/1.1 500 Internal Server Error`  
  Traza: `at ar.edu.utn.frc.devops.facturas.FacturaController.crear(...)` -> `at ...save(...)`
* **Causas identificadas:**
  1. **Inexistencia o desajuste de tabla:** La entidad `@Table` en Hibernate intentaba persistir sobre la tabla por defecto (`factura` singular), la cual no existía en MariaDB o no tenía activada la sincronización de esquema (`spring.jpa.hibernate.ddl-auto=update`).
  2. **Incompatibilidad de driver JDBC:**
     * **Advertencia previa:** `Could not obtain connection metadata: java.sql.SQLSyntaxErrorException: Unknown column 'RESERVED' in 'WHERE'`.
     * Se estaba utilizando el driver de MySQL (`com.mysql.cj.jdbc.ConnectionImpl`) contra un servidor MariaDB 11.8+, cuyas tablas de diccionario del sistema difieren de las de MySQL 8+, provocando fallos al consultar metadatos de las tablas.
* **Solución aplicada:** Cambiar la dependencia en `pom.xml` al driver nativo `org.mariadb.jdbc:mariadb-java-client`, verificar la creación del esquema y asegurar que la entidad apunte explícitamente a `@Table(name = "facturas")`.


---



# ERRORES EN LA CREACIÓN DE LOS SCRIPT DE MIGRACION Y EJECUCIÓN 

### 1. Puertos innecesarios en Docker Compose
* **Error:** Duda sobre exponer los puertos de cada API (`ports:`) para alcanzarlas con `curl`.
* **Causa:** Desconocer que Nginx actúa como Reverse Proxy dentro de la red interna de Docker.
* **Solución:** Exponer únicamente el puerto `443` en Nginx. Las APIs permanecen ocultas en la red privada y Nginx rutea internamente vía `proxy_pass`.

### 2. Script duplicado y bucle con usuario incorrecto
* **Error:** Al terminar `migracion.sh`, pedía clave de `ubuntu@192.168.0.225` y el proceso quedaba suspendido (`[3]+ Detenido`).
* **Causa:** Al editar el archivo, quedó pegada una versión anterior al final del script con el usuario `ubuntu` quemado en código (ERROR CAPA 8 JAJA).
* **Solución:** sobrescribir `migracion.sh` dejando un único bloque de código limpio.

### 3. Falla de `sudo` por falta de TTY en SSH
* **Error:** `sudo: a terminal is required to read the password`.
* **Causa:** El SSH remoto no interactivo no provee terminal para ingresar la contraseña requerida por `sudo`.
* **Solución:** Agregar el flag `-t` a la conexión SSH (`ssh -t -i ...`) para forzar una pseudo-terminal que permita ingresar la contraseña.

### 4. Congelamiento del script con `newgrp docker`
* **Error:** `ejecucion.sh` se detenía a la mitad sin llegar a levantar los contenedores.
* **Causa:** `newgrp` abre una subshell interactiva nueva que pausa el script hasta que el usuario tipea `exit`.
* **Solución:** Quitar `newgrp` y ejecutar los comandos de Docker mediante `sg docker -c "docker compose ..."` para asumir el grupo sin bloquear la ejecución.

### 5. `docker login` interactivo en script desatendido
* **Error:** Pausa inesperada pidiendo credenciales por consola.
* **Causa:** Invocar `docker login` sin pasar credenciales por `stdin` cuando las imágenes ya eran de acceso público.
* **Solución:** Eliminar `docker login` si las imágenes son públicas, o pasarlas por pipeline (`echo "$PASS" | docker login ... --password-stdin`).
