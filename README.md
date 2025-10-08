# Backend POS

Este directorio contiene la API REST para el sistema POS. Se construye con Node.js 20, Express, TypeScript y Prisma. Provee servicios para autenticación, gestión de categorías, productos, clientes, proveedores, compras y ventas.

## Preparación

1. Crea un archivo `.env` copiando el contenido de `.env.example` y ajusta las variables según tu entorno.

   ```sh
   cp .env.example .env
   ```

2. Instala las dependencias:

   ```sh
   npm install
   ```

3. Genera el cliente de Prisma y aplica migraciones:

   ```sh
   npm run generate
   npm run migrate
   ```

4. Ejecuta las semillas iniciales (usuarios y categorías):

   ```sh
   npm run seed
   ```

5. Inicia el servidor en modo desarrollo:

   ```sh
   npm run dev
   ```

La API estará disponible en `http://localhost:3000/api/v1` por defecto.

## Scripts

| Script        | Descripción                                                                                   |
|---------------|-----------------------------------------------------------------------------------------------|
| `npm run dev` | Inicia el servidor con recarga automática usando ts-node-dev.                                 |
| `npm run build` | Transpila el código TypeScript a JavaScript en la carpeta `dist`.                          |
| `npm start`   | Ejecuta la versión compilada desde `dist/`.                                                   |
| `npm run migrate` | Aplica las migraciones Prisma en la base de datos configurada.                           |
| `npm run seed` | Ejecuta el script de semillas para insertar datos iniciales (usuarios y categorías).        |
| `npm test`    | Corre las pruebas unitarias con Jest.                                                         |

## Estructura

- `src/`: código fuente TypeScript (servidor, rutas, middlewares).
- `prisma/`: definiciones del esquema de base de datos y archivos de migraciones.
- `tests/`: pruebas unitarias con Jest.                                  

## Seguridad

- Las contraseñas se almacenan de forma segura utilizando bcrypt.
- Los endpoints están protegidos mediante JSON Web Tokens (JWT) con expiración configurable.
- Se aplica rate limiting básico y cabeceras de seguridad con Helmet.         

## Validación de datos

Se utiliza Zod para validar y tipar las entradas de las solicitudes. Si los datos no cumplen con el esquema, se devuelve un error 400 con información detallada.