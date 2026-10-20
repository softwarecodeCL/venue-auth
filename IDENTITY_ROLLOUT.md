# Despliegue del bloque de identidad

> Documento histórico. Para el despliegue actual usar
> `api-web/web-api/docs/DATABASE_MIGRATIONS.md` y `LOGIN_SECURITY.md`.
> El login actual exige verificar correo antes de activar la contraseña, Google
> no vincula cuentas por coincidencia de correo y SMS ya está implementado.
> Web API sigue siendo el único ejecutor de migraciones.

Este cambio introduce perfiles huésped/anfitrión, onboarding obligatorio para
cuentas nuevas, vinculación segura con Google y sesiones de renovación
revocables.

## Antes de desplegar

1. Rotar todas las credenciales que hayan sido compartidas fuera del gestor de
   secretos y configurar valores nuevos en el entorno de producción.
2. Crear y probar una copia restaurable de la base de datos.
3. Configurar `JWT_SECRET`, un `JWT_REFRESH_SECRET` diferente,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALLBACK_GOOGLE`,
   `FRONTEND_URL`, `CORS_ORIGINS` y las opciones de cookie descritas en
   `.env.example`.
4. Probar la migración y el rollback operativo en staging con una copia reciente
   de los datos.

## Orden de despliegue

1. Poner temporalmente la escritura de identidad en mantenimiento.
2. Ejecutar `pnpm run db:check` y, tras revisar los pendientes, `pnpm run db:deploy` únicamente desde `webapi`, que es
   el propietario del historial de migraciones. Auth comparte el esquema, pero
   nunca debe ejecutar migraciones.
3. Desplegar `auth`, `webapi` y `front` como una sola versión coordinada.
4. Reactivar el tráfico y revisar errores de autenticación, latencia y tasa de
   callbacks OAuth.

Los refresh tokens emitidos antes de este despliegue no tienen una sesión
persistida asociada. Por seguridad, esos usuarios deberán iniciar sesión una vez
de nuevo.

## Pruebas mínimas de aceptación

- Registro local nuevo: crea rol `GUEST`, inicia sesión y completa onboarding.
- Google nuevo: exige correo verificado, crea perfil y redirige a onboarding.
- Google existente: vincula por correo verificado sin duplicar la cuenta.
- Elección huésped: mantiene acceso general y bloquea rutas de anfitrión.
- Elección anfitrión: conserva `GUEST`, agrega `HOST` y permite rutas host.
- Cuenta suspendida o eliminada: deja de funcionar en `auth` y `webapi` aunque
  el access token todavía no haya expirado.
- Refresh token: rota en cada uso; la reutilización revoca toda su familia.
- Un anfitrión no puede editar, borrar ni solicitar cargas de medios para el
  aviso de otro anfitrión.

La verificación telefónica por SMS se implementa en el siguiente bloque. Hasta
entonces, `phoneVerified` se conserva como estado de dominio, pero no debe
marcarse manualmente desde el perfil genérico.
