# Mi Contabilidad Personal

PWA responsive para contabilidad personal con React, Vite, Tailwind CSS, Supabase Auth y PostgreSQL en Supabase.

## Incluye

- Registro e inicio de sesion con Supabase Auth.
- Rutas protegidas para dashboard, movimientos, categorias y configuracion.
- CRUD de movimientos y categorias.
- Filtros por mes, tipo, categoria y metodo de pago.
- Dashboard financiero con graficos Recharts.
- Sincronizacion con Supabase como fuente central de datos.
- Manifest, iconos PNG y service worker para instalacion como PWA.
- SQL con tablas PostgreSQL, indices y Row Level Security por usuario.

## Configuracion local

1. Instala dependencias:

```bash
pnpm install
```

2. Copia variables de entorno:

```bash
cp .env.example .env
```

3. Completa `.env`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

No uses ni expongas `service_role_key` en el frontend.

4. En Supabase SQL Editor, ejecuta `supabase/schema.sql`.

5. Inicia la app:

```bash
pnpm dev
```

## Despliegue en Vercel

### Subir el proyecto a GitHub

1. Crea un repositorio nuevo en GitHub.
2. Desde la carpeta del proyecto, inicializa Git si aun no lo hiciste:

```bash
git init
git add .
git commit -m "Initial deploy-ready PWA"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

3. No subas `.env`; el archivo esta ignorado por `.gitignore`.

### Importar en Vercel

1. Entra a Vercel.
2. Selecciona **Add New > Project**.
3. Importa el repositorio de GitHub.
4. Usa esta configuracion:

```text
Framework Preset: Vite
Install Command: pnpm install
Build Command: pnpm build
Output Directory: dist
```

5. Agrega estas variables en **Environment Variables**:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

6. Haz deploy.
7. Si agregaste las variables despues del primer deploy, ve a **Deployments**, abre el ultimo deploy y usa **Redeploy**.

### Probar produccion

1. Abre la URL final de Vercel.
2. Registra una cuenta o inicia sesion.
3. Crea una categoria y un movimiento.
4. Recarga rutas internas como `/movimientos`, `/categorias` o `/configuracion`; `vercel.json` redirige esas rutas a `index.html` para evitar 404.
5. Abre la misma cuenta desde celular y PC para confirmar sincronizacion.

### Instalar como PWA

La app no depende de App Store, Play Store ni ninguna tienda. Se instala desde el navegador.

Android con Chrome:

1. Abre la URL de Vercel en Chrome.
2. Menu de Chrome > **Agregar a pantalla principal** o **Instalar app**.
3. Abre la app desde el icono instalado.

iPhone con Safari:

1. Abre la URL de Vercel en Safari.
2. Toca compartir.
3. Selecciona **Agregar a pantalla de inicio**.
4. Abre la app desde el icono instalado.

PC con Chrome o Edge:

1. Abre la URL de Vercel.
2. Usa el icono de instalacion en la barra de direcciones, o menu > **Instalar app**.
3. Abre la app instalada desde el sistema.

## Configuracion de Supabase para produccion

Despues de desplegar en Vercel:

1. Copia la URL final, por ejemplo:

```text
https://mi-contabilidad-personal.vercel.app
```

2. Entra a Supabase.
3. Abre tu proyecto.
4. Ve a **Authentication > URL Configuration**.
5. En **Site URL**, coloca la URL final de Vercel:

```text
https://mi-contabilidad-personal.vercel.app
```

6. En **Redirect URLs**, agrega:

```text
https://mi-contabilidad-personal.vercel.app
https://mi-contabilidad-personal.vercel.app/auth
https://mi-contabilidad-personal.vercel.app/auth/callback
https://mi-contabilidad-personal.vercel.app/*
```

7. Si usas tambien desarrollo local, conserva:

```text
http://localhost:5173
http://localhost:5173/*
```

8. Guarda los cambios.
9. Prueba registro, login, logout y recuperacion de sesion desde la URL de Vercel.

## Variables de entorno

El frontend usa solamente:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

No agregues claves secretas al frontend. `service_role_key` solo debe usarse en entornos backend seguros, nunca en esta app Vite.

## PWA

La app incluye:

- `public/manifest.json`
- iconos PNG para Android, iPhone y escritorio
- `apple-touch-icon.png`
- service worker generado por `vite-plugin-pwa`
- fallback de navegacion a `index.html`

Para probar un build local:

```bash
pnpm build
pnpm preview
```
