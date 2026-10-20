# Historial de Auth archivado — no ejecutar

Desde el 20 de octubre de 2026, el único historial activo está en
`api-web/web-api/prisma/migrations`. Auth conserva `prisma/schema.prisma`
para generar su propio cliente; no administra migraciones.

Estos nueve SQL se conservan sin cambios para trazabilidad:

- Ocho migraciones antiguas no figuran en `_prisma_migrations` de la BD local
  reconciliada. No deben agregarse como pendientes al historial activo ni
  marcarse aplicadas artificialmente.
- `20260810180000_identity_roles_sessions` es una copia idéntica a la que ya
  tiene Web API. La copia de Web API sigue siendo la ejecutable.

Las migraciones `20261017120000_host_declaration` y
`20261019120000_verified_password_identity` se trasladaron a Web API con sus
nombres y bytes originales, comprobados contra los checksums de la BD local.
No se aplicaron nuevamente ni se modificó `_prisma_migrations`.

No apuntar `--schema`, `--config` ni `migrations.path` a este archivo histórico.
`prisma.config.cjs` rechaza comandos de migración, `db push` y `db execute`
invocados normalmente desde Auth. Es una protección contra errores operativos;
los permisos DDL del usuario de PostgreSQL se gestionan en infraestructura.

Si un servidor registra alguna de estas ocho migraciones antiguas, detener su
despliegue y reconciliar ese historial concreto. No borrar ni editar sus filas.
El chequeo de Web API detecta migraciones desconocidas y falla antes de desplegar.
