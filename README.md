# Mi Contabilidad Personal

Aplicacion web responsive tipo PWA para contabilidad personal. Permite registrar ingresos, gastos, categorias, cuentas, transferencias, presupuestos mensuales y reportes, con datos sincronizados en Supabase por usuario autenticado.

## Tecnologias usadas

- React + Vite
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL
- Supabase Realtime
- Recharts
- vite-plugin-pwa + Workbox
- write-excel-file, jsPDF y jspdf-autotable para exportaciones
- Vercel para despliegue

## Funcionalidades

- Registro, inicio y cierre de sesion.
- Rutas protegidas por usuario.
- Dashboard financiero con ingresos, gastos, balance, graficos y ultimos movimientos.
- CRUD de movimientos, categorias, cuentas y transferencias entre cuentas.
- Presupuesto mensual general y por categoria, con alertas al 80% y al superar el presupuesto.
- Reportes por mes o rango de fechas.
- Exportacion a CSV, Excel y PDF.
- PWA instalable en Android, iPhone y PC.
- Modo claro y oscuro.
- Diseno responsive para celular y escritorio.

## Instalacion

Requisitos:

- Node.js
- pnpm
- Proyecto de Supabase

Instala dependencias:

```bash
pnpm install
```

Copia el archivo de variables:

```bash
cp .env.example .env.local
```

Completa `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

No uses `service_role_key` en esta app. El frontend debe usar solo la anon key.

## Configurar Supabase

1. Entra a Supabase.
2. Abre tu proyecto.
3. Ve a **SQL Editor**.
4. Ejecuta el archivo principal:

```text
supabase/schema.sql
```

Ese script crea:

- `profiles`
- `categories`
- `accounts`
- `transactions`
- `account_transfers`
- `monthly_budgets`
- indices
- triggers `updated_at`
- politicas Row Level Security
- publicacion Realtime cuando existe `supabase_realtime`

Si ya tenias la base creada y solo quieres aplicar modulos nuevos o correcciones puntuales, puedes ejecutar tambien:

```text
supabase/accounts.sql
supabase/monthly_budgets.sql
supabase/security_hardening.sql
```

`security_hardening.sql` refuerza RLS para evitar que un usuario pueda asociar movimientos o presupuestos a categorias/cuentas de otro usuario.

## Seguridad y RLS

La app usa Supabase como fuente central de datos. Las tablas tienen Row Level Security activado y politicas basadas en `auth.uid()`.

Reglas principales:

- Cada usuario solo puede leer, crear, editar y eliminar filas con su propio `user_id`.
- `profiles.id` debe coincidir con `auth.uid()`.
- `transactions.user_id` debe coincidir con `auth.uid()`.
- Si un movimiento tiene `category_id`, esa categoria debe pertenecer al mismo usuario.
- Si un movimiento tiene `account_id`, esa cuenta debe pertenecer al mismo usuario.
- Las transferencias solo pueden usar cuentas del usuario autenticado.
- Los presupuestos solo pueden usar categorias del usuario autenticado.

Variables permitidas en frontend:

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

No subas `.env`, `.env.local` ni claves reales al repositorio.

## Ejecutar localmente

```bash
pnpm dev
```

Abre:

```text
http://localhost:5173
```

Comandos utiles:

```bash
pnpm lint
pnpm build
pnpm preview
```

## Despliegue en Vercel

1. Sube el proyecto a GitHub.
2. Entra a Vercel.
3. Importa el repositorio.
4. Usa esta configuracion:

```text
Framework Preset: Vite
Install Command: pnpm install
Build Command: pnpm build
Output Directory: dist
```

5. Agrega variables de entorno:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

6. Haz deploy.
7. Si agregas variables despues del primer deploy, ejecuta **Redeploy**.

El archivo `vercel.json` redirige rutas internas a `index.html`, por lo que recargar `/dashboard`, `/movimientos`, `/cuentas`, `/reportes` o `/categorias` no debe producir 404.

## Configurar Supabase Auth en produccion

Despues del deploy:

1. Copia la URL final de Vercel.
2. En Supabase, ve a **Authentication > URL Configuration**.
3. Coloca la URL de Vercel como **Site URL**.
4. Agrega Redirect URLs:

```text
https://tu-app.vercel.app
https://tu-app.vercel.app/auth
https://tu-app.vercel.app/auth/callback
https://tu-app.vercel.app/*
```

Para desarrollo local conserva:

```text
http://localhost:5173
http://localhost:5173/*
```

## PWA

La app incluye:

- `public/manifest.json`
- iconos PNG y maskable icon
- `apple-touch-icon.png`
- service worker generado por `vite-plugin-pwa`
- `start_url: /`
- `display: standalone`

Para probar instalacion:

- Android Chrome: abre la URL y usa **Instalar app** o **Agregar a pantalla principal**.
- iPhone Safari: compartir > **Agregar a pantalla de inicio**.
- PC Chrome/Edge: usa el icono de instalacion en la barra o menu > **Instalar app**.

## Estructura principal

```text
src/
  auth/          Autenticacion y rutas protegidas
  components/    Componentes compartidos
  hooks/         Realtime Sync
  lib/           Cliente Supabase
  pages/         Pantallas principales
  services/      Acceso a datos Supabase
  theme/         Modo claro/oscuro
  types/         Tipos TypeScript
  utils/         Formato, reportes, cuentas y exportaciones
supabase/        SQL principal y scripts incrementales
public/          Manifest e iconos PWA
```
