# api-pagos (Node.js / Express)

ABM de pagos de *FinTech Nova*. Usa la base `db_pagos` (misma instancia compartida de MariaDB
que las otras 4, ver `../db/`). Al crear o modificar un pago, esta API llama a una **API pública
externa** (`https://open.er-api.com`, sin API key) para convertir el monto de ARS a USD y lo
guarda en `monto_usd`. Si esa API externa no responde, el pago se guarda igual con
`monto_usd: null` (ver `src/exchangeRate.js`).

## Endpoints
| Método | Ruta         | Descripción     |
|--------|--------------|------------------|
| GET    | `/`          | Health check     |
| GET    | `/pagos`     | Listar todos     |
| GET    | `/pagos/:id` | Obtener uno      |
| POST   | `/pagos`     | Crear (alta)     |
| PUT    | `/pagos/:id` | Modificar        |
| DELETE | `/pagos/:id` | Borrar (baja)    |

Body de ejemplo (`POST` / `PUT`):
```json
{ "monto_ars": 50000, "medio_pago": "transferencia" }
```

## Cómo levantar en LOCAL (sin Docker)

Requisitos: Node.js 20+, acceso a internet (para la API de tipo de cambio) y una base
MariaDB/MySQL accesible.

```sh
cd api-pagos
npm install

cp env.example .env
# Editar .env. Si corren las 5 APIs juntas en el host para probar con el front de Vite,
# usen PORT=8082 para que no choque con las demás.

npm start
```

Probar:
```sh
curl http://localhost:8080/pagos
curl -X POST http://localhost:8080/pagos \
  -H "Content-Type: application/json" \
  -d '{"monto_ars": 50000, "medio_pago": "transferencia"}'
```

## Docker
Este directorio **no incluye Dockerfile** — es parte de la consigna del TP escribirlo (ver el
`README.md` en la raíz de `tp-2026/`).
