# FE-47 — Controles y filtros de clasificación y estado

Historia FE-14. Interfaz sobre el backend de FE-48 (reglas en
`docs/srs/sprint-2/FE-59-clasificacion-y-filtros.md`).

## Qué cambia en la interfaz

- **Listado de carpetas:** selectores «Clasificación» (Todas / Social / Privado) y «Estado»
  (Todos / Iniciado / En proceso / En conclusión) que se combinan con la búsqueda. Viven en la URL,
  así que recargar o compartir el enlace conserva la vista; cualquier cambio vuelve a la página 1.
  Cada carpeta muestra su clasificación («Sin clasificar» si todavía no tiene). Sin resultados, el
  mensaje dice qué filtro se aplicó y ofrece «Quitar filtros».
- **Carpeta:** tarjeta «Clasificación y estado» para administración y la terapeuta asignada, con dos
  guardados independientes (cada uno con su carga, su confirmación y su error). El Resumen muestra
  la clasificación y, tras guardar, quién hizo la última actualización. Si a la terapeuta le
  reasignan el caso antes de guardar, el aviso lo explica y no muestra un cambio que no ocurrió.
- **API simulada** (`npm run dev:simulado`): mismos filtros, rutas, permisos y errores que el
  backend; datos de ejemplo con 5 social, 5 privado y 4 sin clasificar (clave de almacenamiento v3).

## Verificación

Frontend real (`npm run dev`) contra el backend de `main` (`4c50218`), PostgreSQL 16.15 con las
migraciones 001–004 en una base nueva y Supabase Auth de prueba local (los mismos endpoints que usa
el backend). Datos ficticios creados por la API.

| # | Paso | Resultado |
| --- | --- | --- |
| 1 | Listado completo (7 carpetas) | ✅ |
| 2 | Carpeta sin clasificar muestra «Sin clasificar» | ✅ |
| 3 | Filtro Social → 3 | ✅ |
| 4 | Social + En proceso → 3 | ✅ |
| 5 | Social + En conclusión sin resultados → mensaje con el filtro | ✅ |
| 6 | «Quitar filtros» vuelve al listado completo | ✅ |
| 7 | «gutierrez» + Privado → 1 | ✅ |
| 8 | La URL guarda búsqueda y filtro | ✅ |
| 9 | Recargar conserva búsqueda y filtro | ✅ |
| 10 | «Limpiar» quita búsqueda y filtros | ✅ |
| 11 | Botones de guardar desactivados sin cambios | ✅ |
| 12 | Guardar clasificación → confirmación | ✅ |
| 13 | Resumen: clasificación nueva y «Última actualización» con el nombre | ✅ |
| 14 | Guardar estado → confirmación propia, la otra se mantiene | ✅ |
| 15 | Recargar: guardado en BD; número, tipo y paciente intactos | ✅ |
| 16 | El listado refleja el cambio (Social → 4) | ✅ |
| 17 | La terapeuta asignada clasifica su carpeta | ✅ |
| 18 | La terapeuta filtra solo dentro de lo suyo | ✅ |
| 19 | Reasignada antes de guardar → aviso, no se guarda | ✅ 404 |
| 20 | Otra terapeuta abre una carpeta ajena → «No encontramos esta carpeta» | ✅ |
| 21 | PATCH de estado sobre un caso ajeno | ✅ 404 |
| 22 | Marketing intenta clasificar | ✅ 403 |
| 23 | Listado con filtros a 390 px sin scroll horizontal | ✅ |
| 24 | Carpeta a 390 px sin scroll horizontal | ✅ |
| 25 | Sin errores de JavaScript en la página | ✅ |

Pruebas automatizadas: Vitest 112/112 (19 nuevas en `FiltrosCarpetas.test.tsx` y
`ClasificacionYEstado.test.tsx`), `tsc -b` sin errores, oxlint sin avisos, `npm run build` correcto.

## Antes de usarlo con Supabase

- Aplicar `db/migrations/004_clasificacion_casos.sql` en Supabase. Sin ella, `GET /api/carpetas`
  falla y no se puede clasificar.
- Las carpetas existentes quedan «Sin clasificar» hasta que alguien las clasifique.
- Repetir los pasos 3, 12 y 17 con Supabase Auth real (aquí se usó un servidor de prueba).
