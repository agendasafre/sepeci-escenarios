# Formulario de inscripción - Construcción de Escenarios

Formulario público para el Encuentro Participativo "Taller de Construcción de Escenarios": HTML/CSS/JavaScript estático, endpoint serverless de Vercel y persistencia en Supabase.

## Configuración

1. Configurá `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en las variables de entorno del servidor en Vercel o en `.env.local` para desarrollo local. La clave service-role debe mantenerse solamente en el servidor.
2. Configurá `ALLOWED_ORIGIN` con el origen del sitio desplegado.
3. Ejecutá `sql/008_enrollment_submissions_escenarios.sql` en el SQL Editor de Supabase antes de desplegar el endpoint actualizado.
4. Confirmá que existan `assets/splash-unsj-horizontal.png` y `assets/hero-banner.jpg`.

## Datos del evento

- Fecha: 5 de noviembre de 2026
- Horario: 17 hs.
- Lugar: Hall Rectorado
- Descripción: En este encuentro vamos a construir escenarios para la UNSJ del 2050

## Período de inscripción

Las fechas se centralizan en `form-config.js`:

```js
startsAt: "2026-10-20T00:00:00-03:00",
expiresAt: "2026-11-04T23:59:59.999-03:00",
```

El formulario acepta inscripciones desde el 20 de octubre hasta el final del 4 de noviembre de 2026, inclusive, hora de Argentina. El navegador y el endpoint rechazan solicitudes fuera de ese período.

## Datos almacenados

Todos los campos visibles son obligatorios: Nombre, Apellido, DNI, Género, Email, Teléfono y Unidad académica/Institución.

Las inscripciones se almacenan en `public.enrollment_submissions_escenarios`, una tabla independiente de las de encuentros anteriores. La migración nueva no modifica las tablas existentes.

El DNI debe contener 7 u 8 dígitos y es único dentro de esta tabla. Los valores permitidos para género son `Masculino`, `Femenino`, `No binario` y `Otro`. El teléfono acepta solo números y hasta 10 caracteres. Unidad académica/Institución es un campo de texto libre obligatorio de hasta 180 caracteres, almacenado en `educational_institution`.

La tabla tiene Row Level Security habilitada, sin políticas de acceso público. Todas las escrituras pasan por `POST /api/submit` con la clave del servidor.

## Ejecución local y verificación

Podés abrir `index.html` para previsualizar la interfaz. La vista `file://` no puede llamar a `POST /api/submit` y muestra un mensaje informativo. Para probar el endpoint localmente, usá `vercel dev`.

Verificaciones locales sin credenciales reales ni escrituras a Supabase:

```bash
node --check main.js
node --check api/submit.js
node scripts/verify-local.js
```
