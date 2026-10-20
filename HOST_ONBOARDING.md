# Alta de anfitriones — 17 de octubre de 2026

## Recorrido

`/become-a-host` informa e invita desde el navbar y el menú de cuenta de huéspedes. El destino conserva `mode=HOST` al iniciar sesión, registrarse o regresar de Google. Se usa la cuenta existente: no se crea otro usuario ni se traslada su teléfono.

`POST /users/me/onboarding/profile` conserva el endpoint autenticado existente. Para `mode=HOST` exige `hostDeclarationAccepted: true`. Dentro de una transacción se actualiza el perfil, se conserva/agrega GUEST, se registra la declaración y se agrega HOST y ProviderProfile. El teléfono no se modifica. Sin verificación telefónica, el recorrido continúa por el SMS existente antes de acceder al panel.

En Mis publicaciones, la guía conecta los pasos de perfil, Stripe y preparación del aviso. Se puede retomar un borrador sin tener Stripe configurado. Se conservan la moderación del aviso y el control del Web API que impide cobrar si el anfitrión no tiene transferencias habilitadas.

La billetera reutiliza `/connect/countries`, `/connect/status`, `/connect/settlements`, `/connect/onboarding-link` y `/connect/dashboard-link`. El retorno o refresh de un enlace de Stripe nunca demuestra aprobación. El estado se consulta al API. Documentación y datos bancarios se entregan en Stripe, no en un nuevo repositorio de Apartha. Los enlaces de salida se restringen a HTTPS y los hosts `connect.stripe.com` y `dashboard.stripe.com`.

## Declaración registrada

Versión `2026-10-17`, sin casilla premarcada:

> Confirmo que ofreceré únicamente espacios que tengo autorización para publicar y que mantendré sus datos, disponibilidad y condiciones actualizados.

Traducción presentada en inglés:

> I confirm that I will only list spaces I am authorized to offer and will keep their details, availability and conditions up to date.

`public.HostDeclaration` guarda userId, versión y fecha de la primera aceptación. Las solicitudes repetidas no sobrescriben el registro. Es una declaración de responsabilidad, no una certificación de identidad o propiedad ni un sustituto de términos legales. Los anfitriones actuales no reciben una aceptación ficticia ni pierden su rol. Si se cambia la declaración en el futuro y se necesita nueva aceptación, habrá que diseñar el historial por versión; esta tabla conserva la aceptación inicial.

## Despliegue

Estado local: el usuario autorizó aplicar la migración el 17 de octubre de 2026. Se aplicó únicamente `20261017120000_host_declaration` a `localhost:5432/venue`. Se verificaron su registro exitoso, la tabla nueva vacía y las cantidades de registros sin cambios en las 53 tablas anteriores. Producción no fue modificada.

El 20 de octubre se reconciliaron los historiales: **Web API administra todas
las migraciones**. La migración de HostDeclaration ahora está en
`api-web/web-api/prisma/migrations/20261017120000_host_declaration/migration.sql`,
con el mismo nombre y SQL registrado en la BD. Ya aplicada localmente, no se
repite ni requiere una migración adicional por este traslado.

La aplicación original del 17 de octubre usó un directorio aislado porque el
historial de Auth era divergente. Esa evidencia se conserva en
`output/host-declaration-before.json`, `output/host-declaration-after.json` y
`output/host-declaration-deploy/prisma`; ya no es el procedimiento de despliegue.

1. Desde **Web API**, ejecutar `pnpm run db:check` y `pnpm run db:status`.
   Seguir `api-web/web-api/docs/DATABASE_MIGRATIONS.md`.
2. Revisar todos los pendientes y el respaldo del servidor autorizado; aplicar
   desde Web API con `pnpm run db:deploy`, generar Prisma y compilar Web API.
   Si ya está aplicada, Prisma no la repetirá.
3. Desde **Auth**, ejecutar `pnpm run db:generate` y
   `pnpm exec tsc --project tsconfig.build.json --incremental false`. No migrar.
4. Reiniciar los procesos y publicar frontend coordinadamente. Los clientes
   antiguos no envían la declaración obligatoria. El control de Stripe antes
   de aprobar publicaciones también requiere la versión correspondiente de Web API.

Auth conserva sus modelos para el cliente Prisma y archiva los SQL antiguos en
`prisma/migrations-archive`. No usar `db push`, restaurar esa carpeta como activa
ni crear otra migración para la misma tabla.

La migración está aplicada en la base local; **no se aplicó en producción**. No se han activado cuentas Stripe ni enviado documentos reales. Las pruebas de navegador usan respuestas controladas; se debe comprobar una activación real de prueba después del despliegue. El generador Prisma local encontró una DLL ocupada por un proceso existente de Windows; no se detuvo ese proceso. La escritura de la declaración utiliza SQL parametrizado en la transacción y no depende de un delegado Prisma nuevo.

## Verificación

### Refinamiento de moderación y presentación

Los avisos enviados a moderación permanecen visibles aunque Stripe esté pendiente. Mis publicaciones y la bandeja administrativa muestran «Sin cuenta Stripe activa». Aprobar requiere cuenta Stripe asociada, `stripeTransfersStatus=active` y `kycStatus=VERIFIED`, los mismos requisitos existentes para recibir pagos. Los retiros bancarios no se confunden con las transferencias a la cuenta del anfitrión.

La API verifica esa condición en la transacción de aprobación y en el filtro de actualización; devuelve 409 si falta habilitación. El rechazo sigue disponible. Activar Stripe permite la aprobación posterior, pero no publica automáticamente ni cambia retroactivamente avisos ya publicados. La guía consulta el estado Connect al volver a la vista y refresca los motivos de bloqueo. Esta etapa no agrega migraciones ni modifica datos en Stripe.

La guía se rediseñó con cabecera corporativa, pasos alineados y adaptación a móvil. Se corrigió un override de CSS que imponía columnas de escritorio sobre las tarjetas móviles y recortaba el mensaje. Textos existentes conservados, con tres mensajes nuevos ES/EN y una aclaración del requisito para publicar.

- Autenticación: 12 suites, 75 pruebas aprobadas; compilación TypeScript aprobada. Incluye rechazo de aceptación ausente, falsa o string y preservación del flujo GUEST/teléfono.
- Frontend: build Nuxt/Nitro y revisión en navegador. Invitación ES/EN y billetera a 320, 390, 768 y 1440 px, sin desbordamiento horizontal.
- Recorrido controlado de huésped verificado a HOST: aceptación obligatoria, payload correcto, mismo usuario, sin repetir SMS, llegada a Mis publicaciones.
- Billetera: enlace externo inválido bloqueado; historial 503 no inventa saldo cero ni impide activar Stripe; transferencias activas con retiros pendientes conservan acceso a los requisitos.
- Capturas y logs bajo `output/design/hosting-*` y `output/hosting-*` en el workspace. Los fixtures no son evidencia de integración real con Stripe/DB.
