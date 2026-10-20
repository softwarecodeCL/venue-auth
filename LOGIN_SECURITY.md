# Login, correo y vinculación de Google

Implementación: 19 de octubre de 2026. Alcance: acceso local/Google, modal y `/login`, recuperación, vinculación y cuentas existentes. No incluye MFA ni cambios de infraestructura AWS.

## Plan aplicado

1. Mantener un único `LoginForm` y cliente de sesión para modal y página.
2. Eliminar la vinculación de identidades por mera coincidencia de correo.
3. Acreditar por correo la contraseña local y cerrar sesiones anteriores al establecerla.
4. Limitar intentos con contadores PostgreSQL compartidos; unificar política de contraseñas.
5. Integrar correo, pantallas ES/EN, pruebas y despliegue coordinado.

## Comportamiento

### Registro y acceso local

- Registro pide nombre/correo; el titular elige su contraseña después de abrir el enlace recibido. No se inicia sesión ni se almacena una contraseña antes de esa comprobación. Clientes antiguos pueden enviar una contraseña que se valida, pero no se activa ni se almacena: deben completar el mismo paso por correo.
- La bienvenida local se encola después de confirmar el correo, para no anunciar una cuenta activa mientras sigue pendiente.
- El enlace dura 20 minutos, contiene 32 bytes aleatorios, se almacena como hash y se envía cifrado en la outbox existente. El token viaja en el fragmento de URL y se elimina del historial al abrir la página. Un GET o un escáner de correo no activa la cuenta: hace falta enviar una contraseña nueva.
- Verificación y recuperación conceden exactamente el mismo permiso: establecer la contraseña después de acreditar el correo. Por eso comparten `PasswordResetToken` y su consumo transaccional, sin duplicar una tabla/cola. Los correos y pantallas distinguen ambos casos.
- Al completar: contraseña de al menos 12 caracteres y como máximo 72 bytes UTF-8, `emailVerified=true`, `passwordVerifiedAt` establecido, incremento de `sessionVersion`, revocación de refresh tokens y consumo de enlaces pendientes. No se cambia teléfono, roles, reservas ni perfil.
- Los nuevos enlaces incluyen una instantánea del correo en BD, comprobada al consumirse. Enlaces antiguos sin ese campo conservan compatibilidad; el DTO de perfil no permite modificar el correo.
- Login conserva mensajes genéricos para contraseña incorrecta/cuenta inexistente y compara un hash ficticio cuando no hay credencial. Tras probar correctamente una contraseña antigua, informa que necesita confirmación por correo.

### Google

- Login con un proveedor ya vinculado sigue resolviendo por el identificador estable de Google.
- Una identidad Google nueva cuyo correo coincide con una cuenta existente **no se fusiona**. Se dirige al login con instrucciones para entrar/recuperar esa cuenta y vincular desde Mi perfil.
- `POST /auth/google/link` exige sesión válida, contraseña actual acreditada y cuota de intentos. Genera una intención firmada de cinco minutos, en cookie HttpOnly host-only.
- El inicio OAuth vincula esa intención al estado aleatorio y a la cuenta de la cookie de acceso. El callback exige el mismo navegador/cuenta/versión, correo coincidente y proveedor no perteneciente a otro usuario. Revalida la cuenta en BD bajo bloqueo antes de escribir. Una contraseña cambiada durante OAuth invalida la intención.
- Se mantienen `state`, cookies seguras y retorno interno. Fallos/cancelación vuelven a una pantalla traducida sin mostrar mensajes del proveedor ni secretos.
- Se notifica la vinculación mediante el evento existente `GOOGLE_LINKED`.

### Cuentas anteriores a esta entrega

`emailVerified` por sí solo no acredita quién eligió la contraseña: el flujo antiguo podía haberlo activado al vincular Google. La columna nueva queda inicialmente NULL de forma deliberada.

- Cuentas con contraseña antigua: deben confirmar el correo y establecer contraseña una vez. Sus access/refresh tokens anteriores no permiten eludirlo, tanto en Auth como en Web API.
- Google ya vinculado con contraseña sin acreditar: al volver por Google se elimina únicamente esa contraseña y se revocan sesiones/enlaces anteriores. El usuario conserva Google, cuenta, teléfono, roles y reservas, y puede establecer una contraseña mediante correo.
- Google sin contraseña: continúa funcionando.
- No rellenar masivamente `passwordVerifiedAt` a partir de `emailVerified`; reabriría el riesgo que se está corrigiendo.

## Límites

Antes de comprobar contraseñas: 30 intentos/IP/15 minutos, 5 por combinación IP+correo/minuto y 20 por correo/15 minutos. Se aplican a todos los intentos, con ventanas fijas; no son un bloqueo permanente de cuenta. PostgreSQL hace el incremento atómico entre instancias. Solo se utiliza `req.ip` con la configuración de proxy confiable, nunca una cabecera arbitraria.

429 incluye `Retry-After`, expuesto por CORS; el formulario muestra la espera y mantiene disponible Google. Verificación y recuperación comparten cuotas para evitar duplicar el presupuesto de envíos. Vinculación: 5 intentos por usuario/15 minutos. WAF y monitorización siguen siendo defensas complementarias de producción.

## Migración y despliegue

Desde el 20 de octubre, la migración pertenece al historial único de Web API:
`api-web/web-api/prisma/migrations/20261019120000_verified_password_identity/migration.sql`.
Se trasladó sin alterar nombre ni SQL; si ya está aplicada, no se repite.

Añade únicamente:

- `public.User.passwordVerifiedAt TIMESTAMP(3) NULL`.
- `public.PasswordResetToken.email TEXT NULL`.

Ambos servicios reflejan los campos en su schema, pero **solo Web API conserva la
migración ejecutable**. Auth genera su cliente y bloquea comandos de migración.
No hay borrados, backfills ni reset de BD. Seguir
`api-web/web-api/docs/DATABASE_MIGRATIONS.md`: `pnpm run db:check` desde Web API,
revisión de pendientes y `pnpm run db:deploy` únicamente en el servidor autorizado.

Orden de entrega:

1. Autorizar/confirmar BD objetivo, backup y estado de migraciones desde Web API; aplicar los pendientes revisados una sola vez con `pnpm run db:deploy`.
2. Regenerar Prisma y compilar ambos backend. En Windows, la DLL de Prisma puede estar bloqueada por procesos activos: generar durante la parada coordinada, sin cambiar de motor ni borrar `node_modules`.
3. Desplegar Web API (acepta `EMAIL_VERIFY` y protege sesiones antiguas), Auth y frontend como una entrega coordinada. No arrancar el código nuevo antes de tener las columnas.
4. Confirmar worker SMTP activo, `PASSWORD_MAIL_PROVIDER=outbox`, clave de cifrado compartida y remitente/SES correctos. No enviar muestras ni consumir una cola histórica como prueba automática.
5. Probar con cuentas controladas: registro/correo/login, Google nuevo, colisión de correo, cuenta antigua, vinculación explícita, rechazo de otro Google, logout/refresh y retorno a la publicación/reserva original. No utilizar cuentas del cliente para estas pruebas.

Revertir a la autenticación antigua reabre la vinculación insegura; un rollback debe conservar estos controles o deshabilitar temporalmente el acceso afectado.

## Evidencias de esta etapa

Pruebas en `src/auth/login-security.spec.ts`, pruebas de identidad/sesión/contraseña/controlador existentes, Web API `security.spec.ts` y tests de correo, frontend `tests/account-security.test.mjs` y `tests/session-client.test.mjs`.

Logs en la raíz del workspace: `output/login-auth-tests.log`, `output/login-api-tests.log`, `output/login-front-tests.log`, `output/login-auth-types.log`, `output/login-api-types.log`, `output/login-front-build.log`.

Resultado local: 97 pruebas de Auth, 177 de Web API/correo, 12 de sesión frontend y 7 de componentes/recorridos: 293 aprobadas. Ambos backend compilan en `output/login-build/` sin reemplazar el dist de los servicios activos. Las 10 páginas/componentes de acceso afectados compilan también con el compilador de Vue en las pruebas.

No se han enviado correos reales ni modificado cuentas durante las pruebas. El build completo de Nuxt inicialmente recibió EPERM; la revisión automática de la ejecución ampliada falló por capacidad del modelo, no por una evaluación negativa de seguridad. Las pruebas locales no sustituyen la prueba real contra Google/SMTP.

### Migración de desarrollo aplicada — 19 de octubre de 2026

Con autorización expresa del usuario, se aplicó únicamente `20261019120000_verified_password_identity` a `localhost:5432/venue`, con `NODE_ENV=development` en Auth y Web API. Se comprobó el contenedor local `postgres_db` (PostgreSQL 16), su puerto y su IP interna contra la conexión SQL. No se accedió a producción.

- Respaldo previo en formato PostgreSQL custom: `output/login-identity-development-before.dump` en la raíz del workspace. Contiene datos locales: mantener privado y fuera del control de versiones.
- Prisma ejecutó un directorio aislado con una sola migración; no aplicó otras pendientes del historial compartido. Registro final: 28 migraciones, frente a 27 anteriores, sin cambiar las anteriores.
- Las 54 tablas conservaron su cantidad y huella de todos los valores preexistentes. Ambas columnas son opcionales, sin valor por defecto y quedaron NULL en todos los registros; no hubo backfill ni modificación de credenciales.
- Evidencias: `output/login-identity-before.json`, `output/login-identity-after.json`, scripts de auditoría/despliegue y copia aislada en `output/login-identity-deploy/`. Los JSON contienen conteos/huellas y metadatos, no filas ni secretos.
- No se reiniciaron servicios ni se consumió la cola de correos. Sigue siendo necesario regenerar Prisma durante una parada coordinada si Windows mantiene bloqueada su DLL. El despliegue en producción requiere su propia autorización y comprobaciones.

Cierre de validación: el checksum registrado coincide con el SQL autorizado. Los clientes Prisma actuales de Auth y Web API leen ambos campos nuevos correctamente, sin modificar registros. El build completo de Nuxt/Nitro terminó con exit 0 después de autorizar los subprocesos de compilación; evidencia `output/login-front-build-final.log`. Usa `.nuxt-build` separado del servidor de desarrollo. Persisten avisos de dependencias, recursos CSS y bundles grandes en el build, sin errores de compilación. No se verificó en esta ejecución un recorrido real con Google o entrega de correo.
