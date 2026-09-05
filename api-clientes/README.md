# api-clientes (Python / Flask)

ABM de clientes de *FinTech Nova*. Usa la base `db_clientes`, que vive en la **misma instancia**
de MariaDB que las otras 4 bases del TP (ver `../db/`).

## Endpoints
| Método | Ruta            | Descripción          |
|--------|-----------------|-----------------------|
| GET    | `/`             | Health check          |
| GET    | `/clientes`     | Listar todos          |
| GET    | `/clientes/:id` | Obtener uno           |
| POST   | `/clientes`     | Crear (alta)          |
| PUT    | `/clientes/:id` | Modificar             |
| DELETE | `/clientes/:id` | Borrar (baja)         |

Body de ejemplo (`POST` / `PUT`):
```json
{ "nombre": "Ana Torres", "email": "ana@example.com", "dni": "30111222" }
```

## Cómo levantar en LOCAL (sin Docker)

Requisitos: Python 3.11+ y una base MariaDB/MySQL accesible (puede ser la de `../db/`, levantada
suelta con `docker run`, o cualquier MySQL local).

```sh
cd api-clientes
python3 -m venv venv
source venv/bin/activate        # en Windows: venv\Scripts\activate
pip install -r requirements.txt

cp env.example .env
# Editar .env: DB_HOST=localhost (o la IP/host de tu MariaDB), y el resto de las credenciales.
# Si van a correr las 5 APIs juntas en el host (sin Docker) para probar con el front de Vite,
# usen PORT=8081 para que no choque con las demás.

export $(grep -v '^#' .env | xargs)   # carga las variables del .env en la shell (Linux/Mac)
python main.py
```

Probar:
```sh
curl http://localhost:8080/clientes
```

## Docker
Este directorio **no incluye Dockerfile** — es parte de la consigna del TP escribirlo (ver el
`README.md` en la raíz de `tp-2026/`).
