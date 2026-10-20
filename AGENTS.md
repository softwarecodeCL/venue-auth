# Apartha

Antes de trabajar, lee APARTHA_HANDOFF.md, adjunto al chat o disponible en el workspace.
Comprueba cada afirmación del handoff contra el código actual.

Antes de editar: revisa git status, git diff y los usos con rg.
Conserva los cambios existentes. No dupliques funcionalidades ni reescribas módulos completos.
Trabaja una etapa por vez y limita los cambios a los repositorios necesarios.
No ejecutes migraciones ni operaciones sobre datos de producción sin una instrucción expresa.
Verifica los cambios con las pruebas y builds pertinentes; muestra archivos, diff y resultados.
Usa un agente principal para el trabajo habitual.

Auth solo genera su cliente Prisma. Las migraciones pertenecen a
`api-web/web-api/prisma/migrations`; seguir `api-web/web-api/docs/DATABASE_MIGRATIONS.md`.
No crear/restaurar `prisma/migrations` aquí, ni ejecutar DDL desde Auth.
`prisma/migrations-archive` es archivo histórico de lectura.
