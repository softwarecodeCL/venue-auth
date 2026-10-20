# Correos de cuentas

Auth guarda eventos en la cola compartida `webapi.EmailOutbox`; Web API entrega los correos. No se usa SMTP en el proceso de Auth. Las transacciones incluyen registro local/Google, vinculación Google, alta de anfitrión, teléfono verificado y cambios/recuperación de contraseña. No se envía bienvenida en cada login.

Para activar recuperación duradera, configurar `PASSWORD_MAIL_PROVIDER=outbox` y `MAIL_TOKEN_ENCRYPTION_KEY` (32 bytes aleatorios en base64, la misma clave que Web API). `smtp` sigue siendo un alias compatible; también usa la cola. `console` es solo desarrollo y no imprime enlaces, tokens ni destinatarios.

La tabla de correos ya pertenece a la migración Web API `20260907193000_transactional_email_outbox`. El modelo agregado al schema Auth es un espejo, no una segunda migración. **No aplicar migraciones duplicadas ni usar db push.** El usuario de DB de Auth necesita acceso a la tabla compartida para insertar y consultar; el de Web API también debe actualizar la cola y leer PasswordResetToken. Verificar estos permisos cuando los servicios usen roles PostgreSQL distintos.

El token de recuperación se cifra con AES-256-GCM; el enlace mantiene el token en el fragmento. El worker verifica usuario, correo actual, caducidad y uso antes de enviarlo y elimina el secreto al confirmar el envío. Cambiar/restablecer contraseña conserva revocación de sesiones y genera aviso de seguridad. Un fallo al poner la recuperación en cola mantiene respuesta pública genérica y registra PASSWORD_RESET_QUEUE_FAILED; no confirma falsamente una entrega.

Desplegar Web API actualizado primero, configurar el worker SMTP/SES y después Auth. La recuperación necesita que Web API esté operativo. No se almacenan credenciales en el repositorio ni se activaron envíos con esta tarea.

Catálogo completo, límites, preflight y activación: [TRANSACTIONAL_EMAIL.md](../../api-web/web-api/docs/TRANSACTIONAL_EMAIL.md).

## Refuerzo de seguridad — 18 de octubre de 2026

El registro aplica límites PostgreSQL antes de crear cuentas/correos: 10 intentos/hora por IP de confianza del request y 3/hora por correo normalizado. No se lee directamente X-Forwarded-For; verificar AUTH_TRUST_PROXY en producción. Se acotan nombre/email/contraseña en el DTO. Se conservan Google, asociación de cuenta y recuperación existentes.

Web API añade cuotas globales/por destinatario, validación de payload/enlaces y restricciones SMTP: [EMAIL_SECURITY.md](../../api-web/web-api/docs/EMAIL_SECURITY.md). Requiere que su rol DB pueda leer/escribir `public.AuthRateLimit`; la tabla ya existe. Sin migración nueva.

En este workspace se configuraron la misma clave aleatoria de cifrado en los dos `.env` locales y `PASSWORD_MAIL_PROVIDER=outbox`, sin mostrar ni guardar la clave en documentación. No se reiniciaron servicios ni se enviaron correos. Para que los procesos en ejecución lo tomen hay que reiniciar ambos; no copiar el `.env` local a producción, provisionar sus propios secretos. Falta comprobar la configuración externa de SES y el corte de activación.
