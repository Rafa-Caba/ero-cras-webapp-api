<!-- README.md -->

# Ero Cras API

API compartida por la aplicación React Native privada y la Web App pública de Ero Cras / Choir App.

## Estado actual

Esta entrega implementa la base de las Fases 0, 1 y 2 del roadmap multi-coro:

- configuración estricta por ambiente;
- respaldo, limpieza y seed controlado de MongoDB;
- autenticación fail-closed;
- usuario y coro recargados desde MongoDB en cada request protegida;
- tokens con claims mínimos y `sessionVersion`;
- refresh tokens almacenados mediante hash y rotación de un solo uso;
- contexto tenant explícito para operaciones de coro;
- bootstrap único y protegido del primer `SUPER_ADMIN`;
- eliminación del registro público y del flujo heredado “primer usuario = SUPER_ADMIN”;
- separación del CRUD de coros en route, controller, service y schema, con desactivación lógica.

La implementación detallada, comandos y contratos están en [`README_PHASE_0_2.md`](./README_PHASE_0_2.md).

## Requisitos

- Node.js compatible con el proyecto.
- MongoDB local o MongoDB Atlas.
- Variables configuradas desde uno de los archivos `.env.*.example`.

## Instalación

```bash
npm install
```

## Desarrollo

```bash
NODE_ENV=development npm run dev
```

## Verificación

```bash
npm run verify:phase-0-2
```

## Scripts de base de datos

```bash
NODE_ENV=development npm run db:backup
NODE_ENV=development npm run db:reset-seed
```

El reset está bloqueado en `production` y exige dos variables de confirmación. Consulta el README de la fase antes de ejecutarlo.
