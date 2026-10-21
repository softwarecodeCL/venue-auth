# Análisis automático de seguridad — Apartha

## Inventario comprobado el 21-10-2026

- Repositorio: `auth-backend/auth-service` (NestJS Auth/SMS). Cada ruta es una raíz Git distinta.
- Rama local al preparar esta configuración: `main`. Rama principal remota: `main`, verificada mediante `git ls-remote --symref origin HEAD`.
- Manifiesto: `package.json`; gestor de despliegue: **pnpm**; lockfile utilizado: `pnpm-lock.yaml`.
- También existe `package-lock.json`. Se conserva: estandarizar o sincronizar ambos gestores queda fuera de esta tarea. Revisar la consistencia de ambos locks en los PR de Dependabot; el servidor usa pnpm.

## Archivos y ejecución

- `.github/dependabot.yml`: ecosistemas `npm` (también para pnpm) y `github-actions`, directorio `/`. Revisión semanal los lunes, 09:00/09:30 America/Santiago. Límite de 5 PR de actualizaciones de versión de dependencias y 3 de Actions. Minor/patch agrupados; majors separados. No hay auto-merge. Los PR de security updates tienen el límite propio de GitHub.
- `.github/workflows/security.yml`: PR, push a `main`, martes 13:23 UTC y ejecución manual. Jobs independientes **Semgrep CE** y **Gitleaks history**, Ubuntu24.04, permisos solo `contents: read`, credenciales de checkout no persistentes, cancelación por PR/rama y tiempos máximos15/20min. Sin filtros de rutas para evitar checks pendientes al exigirlos.
- `.github/security/semgrep.yml`: política local versionada, 16 reglas; no se descarga un pack variable del Registry.
- `.github/security/run_semgrep.py`: ejecuta CE, publica solo ID, severidad, ruta, línea y conteos. Nunca imprime coincidencias, código fuente ni valores. No escribe informes, no ejecuta la aplicación ni sus imports y no transmite código a un servicio de análisis.
- `.semgrepignore`: sustituye las exclusiones predeterminadas. Solo dependencias, compilados, caches, artefactos generados y metadatos internos Git. Pruebas, fixtures, documentación y scripts permanecen dentro del alcance. Los backends excluyen explícitamente el cliente generado `generated/prisma/`, incluyendo copias locales antiguas.
- `.github/security/gitleaks.toml`: reglas integradas de Gitleaks. Excepciones revisadas de valores ficticios con condición AND entre regla, ruta y valor exacto; sin baseline.

Herramientas fijadas: Semgrep **1.182.0**, Gitleaks **8.30.1**. Actions checkout **v7.0.1** y setup-python **v7.0.0**, ambas por SHA completo. Python3.12 es solo para el escáner; no se instala ni ejecuta Node ni dependencias de la aplicación.

Semgrep se instala desde el wheel Linux oficial de PyPI tras verificar SHA256 fijado. Pip instala exclusivamente dependencias binarias del escáner. Gitleaks se obtiene de su release oficial: se verifica primero el hash fijado de la lista oficial de checksums y luego el hash del tarball. No se usa la Action de Gitleaks, no se requiere licencia de organización. Al actualizar herramientas, revisar también URLs, checksums y versiones documentadas; Dependabot solo mantiene dependencias de la aplicación y Actions.

No Docker, Trivy, cuenta/token comercial, SARIF ni subida de artefactos. Descargas de distribución oficiales de PyPI/GitHub sí son necesarias para instalar las herramientas. Telemetría y comprobación remota de versión de Semgrep desactivadas.

## Política de bloqueo y cobertura

Todos los siguientes IDs de regla con `severity: ERROR` bloquean:

- `apartha.dynamic-eval`
- `apartha.tls-validation-disabled`
- `apartha.jwt-none-algorithm`
- `apartha.jwt-signature-disabled`
- `apartha.request-command-injection`
- `apartha.request-sql-injection`
- `apartha.literal-dynamic-code-timer`
- `apartha.unsafe-yaml-load`

`WARNING` conserva los hallazgos para revisión sin bloquear por sí sola. No hay `continue-on-error`. Errores del escáner, configuración inválida, parseo parcial o timeouts bloquean como análisis incompleto. No se aceptan comentarios `nosemgrep` para ocultar resultados.

CE analiza JS/TS y flujo local dentro de funciones. No demuestra ausencia de inyecciones entre archivos, autorización correcta en todos los endpoints, seguridad del flujo Stripe ni vulnerabilidades CVE de dependencias. Las revisiones de JWT decode, cookies, HTML, shell y hashes requieren contexto. Las advertencias `@Public`/`@SkipThrottle` de los backends son comprobaciones léxicas de revisión; no afirman que una ruta deba ser privada. Dependabot alerts complementa CVE; no se ha ejecutado una auditoría npm/pnpm ni se han actualizado dependencias.

### Historial y secretos

Gitleaks usa checkout con `fetch-depth: 0` y `git --log-opts='--all'`: historial alcanzable desde las referencias obtenidas, no otros repositorios, ramas borradas inaccesibles o forks que no se hayan descargado. Se fuerza `--redact=100`, sin verbose ni reportes en CI, y un fichero de ignores vacío. No se aceptan comentarios `gitleaks:allow`. Cualquier coincidencia bloquea, incluidas las históricas. No se verifican credenciales contra proveedores externos.

## Validación local y hallazgos

Validados con CLI reales en Windows, sin dependencias de la aplicación: YAML, configuración de reglas con Semgrep CE, probes sintéticos de TLS/JWT/SQL/shell, extracción Vue normal/setup TS y detección genérica de templates. Workflows revisados con actionlint1.7.12 (sin ShellCheck/Pyflakes, no instalados); checksums oficiales de sus binarios y Gitleaks verificados. El historial local completo disponible de las tres raíces fue analizado con Gitleaks y redacción total.

Semgrep: 0 coincidencias con esta política. Gitleaks: 1 coincidencia histórica genérica en README.md. Ausencia de hallazgos no acredita seguridad integral.

Los conteos de secretos son coincidencias, no credenciales únicas confirmadas ni prueba de uso indebido. No se muestran valores. No se han rotado claves ni reescrito el historial. Solo se aceptan las excepciones de valores ficticios documentadas en esta revisión. La política conserva bloqueados los hallazgos reales pendientes. Ver la revisión del 21-10-2026 al final de este documento.

Comprobadas las primeras 18 ejecuciones de GitHub (6 por repositorio): instaladores Linux y escáneres funcionaron. Los bloqueos correspondían a los hallazgos descritos. La corrección de política se valida de nuevo localmente y al publicarla; la protección de ramas depende de los Settings del propietario.

Para repetir en una instalación aislada con las versiones indicadas, desde esta raíz:

```sh
semgrep scan --validate --oss-only --metrics=off --disable-version-check --config .github/security/semgrep.yml
python .github/security/run_semgrep.py
gitleaks git --config .github/security/gitleaks.toml --log-opts='--all' --ignore-gitleaks-allow --redact=100 --no-color --no-banner --exit-code=1 .
```

No usar `npm audit fix`, migraciones, `npm install` ni regenerar locks para configurar estos análisis. Si se añade más adelante un job de aplicación, deberá respetar el Node/gestor/lock real del repositorio (`npm ci` o `pnpm install --frozen-lockfile`).

## Activación por un administrador en GitHub

1. La configuración ya fue publicada en `main` con autorización del propietario; revisar los resultados en Actions. Dependabot, cron y ejecución manual requieren que la configuración esté en la rama principal `main`.
2. En **Settings → Advanced Security / Code security** (nombre según interfaz), habilitar **Dependency graph**, **Dependabot alerts** y **Dependabot security updates**. La configuración YAML de actualizaciones de versión no activa por sí sola esos dos interruptores. Comprobar **Security → Dependabot** y los registros del actualizador después de integrar.
3. Permitir Actions y las Actions oficiales fijadas según las políticas de la organización. No hacen falta secretos, permiso de escritura de seguridad ni GitHub Code Security/SARIF.
4. Una vez que los checks hayan aparecido en un PR, en **Settings → Rules → Rulesets** crear/editar la regla para `main`, activarla y exigir PR más los checks **Semgrep CE** y **Gitleaks history**, con GitHub Actions como fuente. Alternativamente usar una regla de protección de rama. Exigir rama actualizada si se desea. No crear excepciones para saltar hallazgos.
5. La protección depende de plan y permisos: rulesets de rama están disponibles en repositorios públicos Free y en privados Pro/Team/Enterprise según el propietario. Si el plan no permite exigirlos, los workflows ejecutan análisis pero no impiden por sí solos una integración manual. Si se usa merge queue, añadir su evento `merge_group` antes de exigir estos checks en esa cola.

ZAP queda para una segunda etapa: requiere ambiente de pruebas, URLs autorizadas, autenticación de frontend/APIs y límites que eviten pagos o mensajes reales.

## Referencias oficiales

- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference
- https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-dependabot-alerts
- https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- https://docs.semgrep.dev/semgrep-ce-languages
- https://docs.semgrep.dev/cli-reference
- https://pypi.org/project/semgrep/1.182.0/
- https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1

## Revisión de falsos positivos — 21-10-2026

El valor del badge histórico de README coincide exactamente con el ejemplo público de [nestjs/typescript-starter](https://github.com/nestjs/typescript-starter/blob/master/README.md). Se quitó el parámetro innecesario del README actual. La excepción solo acepta ese valor exacto en `README.md` para `generic-api-key`; otra clave en el mismo archivo sigue bloqueándose.

Escaneo local del historial completo: 0 hallazgos tras la revisión. Probes sintéticos comprobaron tanto los ejemplos aceptados como valores/rutas distintos que deben bloquear. Las coincidencias originales permanecen descritas arriba como antecedente de la primera ejecución.
