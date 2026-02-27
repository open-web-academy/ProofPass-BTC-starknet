# Guía de Instalación y Despliegue en EC2 (Ubuntu/Debian)

Esta guía explica cómo configurar el entorno en tu instancia EC2 de Linux para compilar y desplegar contratos Cairo 0 utilizando Protostar.

## 1. Instalar Dependencias del Sistema

Actualiza tu sistema e instala herramientas básicas de compilación y `curl`:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git python3-pip python3-venv build-essential libgmp3-dev
```

## 2. Instalar Protostar

Protostar simplifica la vida compilando y desplegando en Cairo 0. Para instalar la versión compatible con este repositorio (0.9.1), ejecuta:

```bash
curl -L https://raw.githubusercontent.com/software-mansion/protostar/master/install.sh | bash -s -- -v 0.9.1
```

Tras la instalación, recarga tu terminal o añade Protostar a tu `PATH`:

```bash
source ~/.bashrc
```

Verifica que haya funcionado:

```bash
protostar -V
```

Debería mostrar `0.9.1` y la versión correspondiente de Cairo.

## 3. Preparar Variables de Entorno

Exporta las claves y URLs en la terminal que usarás para desplegar. Recuerda usar la misma cuenta de las pruebas anteriores (ver requerimientos del comando original).

```bash
export DEPLOYER_ADDRESS=0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D
export DEPLOYER_PRIVATE_KEY=0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede
export STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
```

## 4. Ejecutar el Script de Despliegue

Sitúate en la raíz del proyecto y ejecuta el script automatizado:

```bash
chmod +x scripts/deploy_testnet.sh
./scripts/deploy_testnet.sh
```

El script se encargará de:
1. Compilar los contratos.
2. Comprobar que los artefactos `.json` existan en la carpeta `/build`.
3. Desplegar los contratos en el orden corecto.
4. Generar el `deploy_output.json`.
5. Mostrar los comandos correspondientes.
