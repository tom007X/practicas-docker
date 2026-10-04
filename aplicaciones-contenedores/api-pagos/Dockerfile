# ==========================================
# ETAPA 1: Dependencias (builder / deps)
# ==========================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copiamos solo los manifiestos de dependencias
COPY package*.json ./

# Instalamos únicamente dependencias de producción y limpiamos caché
RUN npm ci --omit=dev && npm cache clean --force

# ==========================================
# ETAPA 2: Entorno de ejecución final (runner)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Buena práctica: definir entorno de producción
ENV NODE_ENV=production

# Copiamos node_modules limpios desde la etapa anterior
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Copiamos el código fuente de la app asignando propiedad al usuario 'node'
COPY --chown=node:node package*.json ./
COPY --chown=node:node src/ ./src/

# Por seguridad: nunca correr como root en producción
USER node


EXPOSE 8080
# El ejecutable base es inamovible:
ENTRYPOINT ["node"]

# El argumento por defecto (que se puede sobreescribir si quieres correr otro script):
CMD ["src/server.js"]