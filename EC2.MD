Markdown

# Reporte de Configuración de Infraestructura: AWS EC2

## 1. Datos Generales de la Instancia

* **IP Pública / DNS IPv4 Público:** `[COMPLETAR: ej. 54.xxx.xxx.xxx o ec2-54-xxx.compute-1.amazonaws.com]`  
  *(Nota: Al operar en AWS Academy Learner Lab Sandbox, la IP pública es efímera y se renueva cada vez que el laboratorio expira o la instancia se reinicia).*
* **Sistema Operativo / AMI:** Ubuntu Server 26.04 LTS (o Ubuntu Server 24.04/22.04 LTS x86_64).
* **Tipo de instancia:** `t3.medium` (o `t2.medium`, 2 vCPU, 4 GB RAM para soportar JVM + Python + MariaDB).

---

## 2. Red y Subred (VPC)

* **VPC ID:** `[COMPLETAR: ej. vpc-0a1b2c3d4e5f6g7h8]` (Default VPC del Learner Lab).
* **Subnet ID:** `[COMPLETAR: ej. subnet-0a1b2c3d4e5f6g7h8]` (Subred pública con asignación automática de IPv4 pública habilitada).
* **Zona de Disponibilidad:** `us-east-1[a-f]`.

---

## 3. Configuración del Security Group

* **Nombre del Security Group:** `[COMPLETAR: ej. sg-microservicios o launch-wizard-1]`
* **ID del Security Group:** `[COMPLETAR: ej. sg-0123456789abcdef0]`

### Reglas de Entrada (Inbound Rules)

| Tipo | Protocolo | Puerto / Rango | Origen (Source) | Justificación |
| :--- | :---: | :---: | :---: | :--- |
| **SSH** | TCP | `22` | `<TU_IP_PUBLICA>/32` | **Acotado estrictamente a la IP del administrador** (no `0.0.0.0/0`) para evitar ataques de fuerza bruta. |
| **HTTPS** | TCP | `443` (o `8443`) | `0.0.0.0/0` | **Abierto a todo público** para consumo del frontend web y reverse proxy TLS. |
| **HTTP** | TCP | `80` | *Sin regla* | **Cerrado explícitamente.** No se expone tráfico plano no cifrado. |

> **Nota:** Los puertos internos de microservicios (`8080`, `8081`, `5000`) y de base de datos (`3306`) **no** se exponen en las reglas de entrada del Security Group; la comunicación entre ellos ocurre de forma aislada dentro de las redes bridge de Docker.

### Reglas de Salida (Outbound Rules)

| Tipo | Protocolo | Puerto / Rango | Destino | Justificación |
| :--- | :---: | :---: | :---: | :--- |
| **All Traffic** | ALL | `0 - 65535` | `0.0.0.0/0` | Salida libre a internet para descarga de paquetes APT, imágenes de Docker Hub y resolución DNS externa. |

---

## 4. Conexión a la Instancia

La conexión remota se realizó vía SSH utilizando la clave privada RSA/ED25519 (`labsuser.pem` / clave generada) y el usuario predeterminado de la AMI:

1. **Ajuste de permisos en la clave privada:**
   
   chmod 400 labsuser.pem

    Comando de conexión SSH:
    Bash

    ssh -i labsuser.pem ubuntu@<IP_PUBLICA_EC2>

        Usuario: ubuntu

2. Aprovisionamiento y Configuración Previa en la Instancia

    Para el transpaso de archivos inciales y configuración completa para el entrono de deploy se utilizaron los script de migracion.sh y ejecucion.sh de manera
    concatenada y despliegue atomatizado.

    *** Para entender su funcionamiento lea script-ejecucion-remota.md ***









# Detalle de la instancia (IP, AMI, VPC, Subnet)
aws ec2 describe-instances \
    --instance-ids <ID_DE_INSTANCIA> \
    --query "Reservations[*].Instances[*].[InstanceId,PublicIpAddress,ImageId,VpcId,SubnetId,State.Name]" \
    --output table

# Detalle de las reglas del Security Group
aws ec2 describe-security-groups \
    --group-ids <ID_SECURITY_GROUP> \
    --output table