#ETAPA 1
FROM node:24-alpine3.21 AS build

WORKDIR /app

COPY ./package*.json ./

RUN npm ci

COPY . .

RUN npm run build

#ETAPA 2
FROM nginx:1.29.1-alpine

# Configurar permisos para que el usuario nginx pueda operar
RUN apk add --no-cache openssl

COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build  /app/dist /usr/share/nginx/html


# Copiar configuración y entrypoint
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

# Exponer únicamente el puerto seguro elegido
EXPOSE 443

ENTRYPOINT ["/entrypoint.sh", "nginx", "-g", "daemon off;"]