# FE-41 — Verificar búsqueda y permisos

## Base y alcance

Rama `feature/FE-41-verificacion-busqueda-permisos`, base
`e0ca86547b2deda46278ab0c78c67e04f955af93` (FE-40), que incluye FE-34
`894ef923e36d9fe1cbd3a03583f992da69ce58f7`. Tras `git fetch origin`,
`origin/main` aún no contenía FE-40. No se modifica main ni se mezclan otras ramas.
No se encontraron AGENTS.md en el repositorio. Jira no respondió en el intento
de consulta; criterios basados en la solicitud y `docs/api/contrato-frontend-backend.md`.
La historia de listado está identificada como FE-16 en el código de FE-39; no se
confirmó la relación de FE-41 en Jira. FE-52 queda fuera del alcance.

Se revisaron `CarpetasController.listar`, `ListarCarpetasQuery`,
`CasosService.listarCarpetas`, `AuthGuard`, `RolesGuard`, `AuthModule`,
`buscarCarpetas`, `PaginaCarpetas`, su simulador y las migraciones 001–003.
No se demostró un defecto de producción: solo se amplían pruebas y evidencia.

## Entornos y comandos

**PG**: NestJS HTTP real, PostgreSQL 16 desechable, SQL real, migraciones 001–003,
DatabaseService real y datos ficticios. Se reutiliza `test/helpers/casos.mjs`:
solo se intercepta fetch a `https://auth.invalid/auth/v1/user` para asociar tokens
ficticios a UUID de cuatro perfiles. AuthGuard, RolesGuard, AuthService y la carga
de perfil desde PostgreSQL NO se sustituyen. `auth.users` es una tabla mínima para
FK; no representa Supabase Auth. Las solicitudes HTTP locales usan fetch real.

Desde backend, en PowerShell:

```powershell
npm.cmd run build
$env:FE40_PG_QA='1'
$env:FE40_PG_ADMIN_URL='postgresql://postgres@127.0.0.1:55441/fe40_qa'
node --test test/listado-carpetas-postgres.test.mjs
```

La URL mostrada corresponde exclusivamente al contenedor local de esta ejecución,
sin contraseña ni tokens. Se creó `fe41-qa-20261022`, PostgreSQL 16, puerto de loopback
55441 y base `fe40_qa` para reutilizar el opt-in existente. El archivo crea otra base
aleatoria `fe40_run_*`, aplica las migraciones y la elimina al finalizar. No carga
`.env` ni usa `DATABASE_URL`. El contenedor desechable se elimina después de probar.
No se modificaron bases compartidas o de producción.

**UI**: React en jsdom con Testing Library y API simulada en memoria mediante
`montarApp`; sin NestJS, PostgreSQL, navegador real ni Supabase Auth real.

Desde frontend:

```powershell
npm.cmd run test -- src/features/carpetas/PaginaCarpetas.test.tsx
npm.cmd run lint
npm.cmd run build
```

En raíz: `git diff --check`. Backend no configura script de lint.

## Matriz de cobertura

PG refiere a `backend/test/listado-carpetas-postgres.test.mjs`; UI refiere a
`frontend/src/features/carpetas/PaginaCarpetas.test.tsx`. Los comandos anteriores
ejecutan los casos indicados. Todas las filas se comprobaron en esta ejecución.

| Criterio | Prueba concreta (título abreviado) | Entorno | Resultado / procedencia |
| --- | --- | --- | --- |
| Listado sin búsqueda | `admin ve vigentes, sin responsable y solo campos de resumen` | PG | Pasa, FE-40 reutilizada |
| Búsqueda vacía y espacios | `búsqueda vacía y espacios listan solo autorizadas` | PG | Pasa; FE-41 añade vacío explícito `''` |
| Nombre, mayúsculas y tildes | `nombre sin tildes, mayúsculas y palabras en diferente orden` | PG | Pasa, FE-40 |
| 12 excluye 112; mismo número en dos tipos | `número exacto devuelve ambos tipos y nunca coincidencias parciales` | PG | Pasa, FE-40 |
| Sin coincidencias | `búsqueda vacía y espacios... sin coincidencias es vacío` | PG | Pasa, FE-40 |
| Paciente/caso borrados excluidos | `admin ve vigentes...` y búsqueda `borrado` | PG | Pasa, FE-40; ambas filas ausentes y total 5 |
| Paginación, total y orden estable con empates | `orden determinista y paginación sin repetidos incluso con empates` | PG | Pasa, FE-40 |
| Parámetros inválidos, repetidos y extremos | `paginación y búsqueda inválidas producen 400` y orden/extremos | PG | Pasa, FE-40 |
| Administrador y carpetas sin responsable | `admin ve vigentes, sin responsable y solo campos de resumen` | PG | Pasa, FE-40 |
| Dos terapeutas y total/páginas autorizados | `dos terapeutas filtran antes de paginar y total no revela carpetas ajenas` | PG | Pasa, FE-40 |
| Terapeuta sin asignaciones | `sin asignaciones devuelve total cero para terapeuta` | PG | Pasa, FE-40 |
| Reasignación retira acceso anterior | `reasignar retira acceso al responsable anterior inmediatamente` | PG | Pasa, FE-40 |
| Marketing 403, sin token/inválido 401 | `guard rechaza marketing con 403...` | PG | Pasa, guards reales, identidad simulada |
| Cambiar rol/perfil en parámetros no eleva privilegios | `no se permite elegir rol o perfil mediante parámetros` | PG | Pasa, FE-40 |
| Cambiar búsqueda y página no revela filas ni totales ajenos | `FE-41 PG: combinar búsqueda y paginación nunca expone filas o totales ajenos` | PG | Pasa, nueva; dos terapeutas, texto/número, cada página y página vacía |
| SQL parametrizado, comodines literales | `SQL parametrizado trata comodines e intentos de inyección como texto` | PG | Pasa, FE-40 |
| Buscar por nombre y número | `busca por nombre...` y `buscar un número exacto localiza su carpeta` | UI | Pasa, FE-39 reutilizadas |
| Conservar búsqueda al paginar, reiniciar página y limpiar | `conserva búsqueda al paginar, reinicia página al buscar y permite limpiar` | UI | Pasa, nueva; verifica datos visibles y parámetros HTTP |
| Abrir carpeta desde resultado | `abrir un resultado muestra el resumen de esa carpeta` | UI | Pasa, FE-39 |
| Estado vacío | `una búsqueda sin coincidencias muestra un mensaje claro` | UI | Pasa, FE-39 |
| Error de red/500 y reintento | `muestra fallo red/500 y reintenta conservando la búsqueda` | UI | Pasan dos casos nuevos; misma URL en reintento |

## Resultados y límites

- PostgreSQL: 13 aprobadas, 0 fallidas, 0 omitidas (12 casos previos y uno nuevo).
- UI: 10 aprobadas (7 previas y 3 nuevas). En el primer intento una nueva aserción
  esperaba `busqueda=`; el cliente omite parámetros vacíos por diseño. Se corrigió
  la prueba para comprobar la ausencia del parámetro, sin modificar producción.
- Compilaciones backend/frontend, lint frontend y `git diff --check`: aprobados.
- No se repiten las baterías completas de FE-34 ni autenticación: no se alteraron
  producción, guards, migraciones ni infraestructura. Sus resultados históricos
  permanecen documentados en el contrato FE-40; no se cuentan como ejecuciones FE-41.
- Archivos propios: las dos suites anteriores y este documento. No hay cambios de
  producción ni nuevas herramientas/frameworks. No se copian las pruebas FE-40.

## Pendiente manual y conclusión

No hay navegador conectado disponible en las herramientas ni archivos `.env` QA
configurados (solo `.env.example`). No se ejecutó el recorrido real con Supabase.

Para completarlo en QA autorizado: aplicar 001–003, arrancar backend y frontend con
API real, entrar como administrador y luego como dos terapeutas con asignaciones
distintas, buscar por nombre con/sin tildes y por número, paginar, buscar desde una
página posterior, limpiar y abrir el detalle. Contrastar resultados/totales entre
cuentas y comprobar 403 de marketing y 401 sin sesión en API. Usar datos ficticios,
sin guardar credenciales o tokens en evidencias. Revisar criterios Jira cuando esté
disponible, sin asumir que el contrato sustituye requisitos adicionales.

FE-41 queda lista para revisión de pruebas automatizadas. El cierre integral queda
condicionado a la comprobación manual QA y a confirmar los criterios de Jira.
