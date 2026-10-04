#Para el build enviroment-> Se descarga la imagen base con maven y SOP con librerias par compilar
FROM maven:4.0.0-rc-7-eclipse-temurin-21-noble AS build

WORKDIR /app

#copiamos el pom.xml que contiene las dependecias a descargar e instalar con maven
COPY pom.xml ./

#descarga todas las dependencias, plugins y artefactos necesarios definidos en tu archivo pom.xml
RUN mvn dependency:go-offline

#copiamos el contenido de la aplicacion
COPY src ./src

#borramos en caso que haya quedado una carpeta target (no debería por el dockerignora)
#y compilamos
RUN mvn clean install


# Stage 2: Runtime environment

FROM maven:4.0.0-rc-7-eclipse-temurin-21-alpine AS final

WORKDIR /app

#Crear grupo y usuario de sistema sin privilegios
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

#Copio el binario desde el stage de build asignándole el owner al usario
#para prevenir problemas de escritura

COPY --from=build  --chown=appuser:appgroup /app/target/*.jar /app/*.jar

USER appuser

EXPOSE 8080

ENTRYPOINT [ "java", "-jar", "/app/*.jar" ]

