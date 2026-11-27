# FE-196 · Revisión e integración de PR pendientes

Fecha: 26/11/2026, La Paz. Revisión de Andrea sobre `main` en `c2b06c0` y las cabezas indicadas abajo, con datos ficticios y PostgreSQL local.

## Candidato revisado

| PR | Cabeza revisada | Aporte y resultado |
| --- | --- | --- |
| [#72](https://github.com/annetryoshka/FundacionEncuentro/pull/72) | `a7cd3c9` | API/listado para reabrir informes; revisión vigente/repetida/caducada de paquetes; elimina accesos duplicados del contexto clínico. Compatible con evaluación inicial y genograma en exportaciones. |
| [#74](https://github.com/annetryoshka/FundacionEncuentro/pull/74) | `cfe0afd` | Migración 022 y pruebas de gastos: internet, electricidad, alquiler y otros; corrección, anulación y totales mensuales con autoría/permisos. Es entrega de datos, no API/pantalla completa de gastos. |
| [#75](https://github.com/annetryoshka/FundacionEncuentro/pull/75) | `aae503d` | Migración 023 y pruebas de artículos públicos: borrador/publicado/retirado, campos públicos y ausencia de comentarios. Su base era #74; debe dirigirse a main después de integrar esa dependencia. Es entrega de datos, no API administrativa completa. |
| [#78](https://github.com/annetryoshka/FundacionEncuentro/pull/78) | `d66439a` | Rechazos de constancias inválidas conservan todo el registro anterior y la auditoría. |

Se combinaron las cuatro ramas sin conflictos en un checkout de revisión separado. Se conservaron los commits de las personas autoras; los ajustes de Andrea se mantienen separados.

## Corrección de integración FE-128

La eliminación de accesos duplicados de #72 dejó dos escenarios de `EvaluacionInicial.test.tsx` buscando el antiguo enlace `Diagnóstico`. Se cambió la navegación al enlace existente y único del resumen, `Ver diagnóstico`. Se conservaron las comprobaciones de guardado, lectura histórica, mínimos y diagnóstico opcional. No se modificó el comportamiento de evaluación ni se debilitó una validación del producto para hacer pasar las pruebas.

## Verificación ejecutada

- Backend: compilación y **283 pruebas unitarias aprobadas**.
- Integración HTTP/PostgreSQL: **448 aprobadas, cero fallos y 13 omitidas por sus condiciones de entorno**. Se aplicaron todas las migraciones del candidato a bases locales desechables, incluidas 022/023. Las suites de gastos y artículos verifican también permisos y migración sobre datos existentes.
- Frontend, tras la corrección de navegación: **292 pruebas aprobadas**, compilación y lint satisfactorios.
- Chromium real en 1366×900 y 390×844 con API simulada: **18 comprobaciones por dispositivo**. Incluye crear/revisar/listar/reabrir un informe, reabrir un paquete ya revisado sin exigir otra confirmación, familia, evaluación sin diagnóstico, importación, logout y ausencia de desborde/errores JavaScript.
- Los archivos válidos y controles de servidor se verificaron separadamente por HTTP con PostgreSQL; el simulador no acredita validez de PDF/DOCX ni compatibilidad ejecutada con GenoPro/ATLAS.ti.

No se aplicaron cambios a Supabase durante esta revisión. Los PR de datos contienen sus propios registros previos de despliegue, que no sustituyen una comprobación actual del entorno compartido. La validación de producción, las reglas institucionales y las versiones de programas conservan su seguimiento correspondiente.

## Reproducción

Usar Node.js 22.13+ / 24 y las dependencias de los lockfiles. Ejecutar `npm run build`, `npm run test:unit` y `npm run test:integration` en backend, con las variables PostgreSQL de los helpers apuntando exclusivamente a una base local desechable. En frontend: `npm test`, `npm run build` y `npm run lint`.

Las omisiones de integración no se presentan como pruebas aprobadas de Supabase real. Esta evidencia no incluye horas ejecutadas ni una matriz de trazabilidad para la entrega física.
