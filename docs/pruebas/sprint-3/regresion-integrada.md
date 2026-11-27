# FE-200 — Regresión integral sobre la entrega de QA (Sprint 3)

- **Historia:** FE-119, coordinar, integrar y aceptar la entrega funcional del Sprint 3.
- **Versión probada:** `main` en `7e67568` (27/11/2026), con todo el Sprint 3 fusionado: pantallas de gastos, artículos y consentimiento/pagos (#101), imágenes públicas (#102) y todos los PR de QA. Rama `feature/FE-200-regresion-integral`.
- **Corrida anterior:** sobre `6baa8c5` (integración 522/523, Supabase real 12/12); se repite sobre `7e67568` porque main cambió en 95 archivos.
- **Responsable QA:** Emilia Crespo.
- **Fecha:** 2026-11-27 (America/La_Paz).

## 1. Entorno

| Elemento | Valor |
|---|---|
| Sistema | Windows 11, Node v22.20.0 |
| Base de datos | PostgreSQL 17 local, bases desechables por suite; roles `anon`/`authenticated` sin login (imitan Supabase) |
| Autenticación | Doble de Supabase Auth en las suites; Supabase de QA real en la suite de logout (FE-193) |
| Datos | Todos ficticios |
| Script | `backend/scripts/regresion-integral.mjs`: prepara roles y bases `fe34_qa`, `fe40_qa` y `fe88_qa`, compila, corre las unitarias y **todas** las suites de `backend/test/` una por una, y guarda `regresion-integrada-resultados.json` y la salida completa |

## 2. Cómo ejecutar

```powershell
cd backend
$env:FE_PG_ADMIN_URL = 'postgres://postgres:<tu-clave>@localhost:5432/postgres'
node scripts/regresion-integral.mjs
```

Para incluir Supabase real (logout, FE-193), agregar antes: `$env:FE_SUPABASE_QA = '1'; $env:FE_QA_PASSWORD = '<contraseña demo>'`.

Frontend:

```powershell
cd frontend
npx vitest run
npm run lint
npm run build
```

## 3. Resultados

| Bloque | Resultado | Detalle |
|---|---|---|
| Backend: compilación | Aprobado | `nest build` sin errores |
| Backend: unitarias (vitest) | **361/361** | 32 archivos, sobre `7e67568` |
| Backend: integración (`test/*.test.mjs`, PostgreSQL 17.5) | **550/551** en `7e67568`, 0 fallidas, 1 omitida a propósito | 53 suites en 643 s. La corrida completa dio 546 aprobadas y 4 fallidas, todas de la suite de Supabase real por FE200-03; corregida esa prueba, la suite se repitió sola con 12/12. En `6baa8c5` había dado 522/523. | 51 suites; la omitida es la variante "sin migración 012" del genograma, porque la base sí la tiene |
| Supabase real (logout, FE-193) | **12/12** en `7e67568` | R3: 504 en 5251 ms; R7: el access anterior se rechaza de inmediato; R8: la otra sesión sigue viva. Antes, sobre `6baa8c5`, también 12/12; el access token anterior se sigue rechazando de inmediato (R7) y el plazo de 5 s se cumple (R3). Evidencia actualizada en `logout-supabase-resultados.json` |
| Frontend: pruebas (vitest) | **356/356** | 41 archivos, sobre `7e67568`, tras las correcciones FE200-01 y FE200-02 |
| Frontend: lint (oxlint) y tipos (tsc) | Aprobado | Sin advertencias |
| Frontend: compilación (vite) | Aprobado | Solo el aviso habitual de tamaño de chunk |

**Tiempo:** en `7e67568` la integración completa tardó 643 s (unos 11 minutos) con el equipo activo. La corrida previa en `6baa8c5` marcó 9,3 h porque el equipo entró en reposo durante la noche; sus pruebas sumaban 314 s.

Evidencia: `regresion-integrada-resultados.json` (resumen) y `regresion-integrada-salida.txt` (salida TAP completa).

## 4. Cobertura funcional verificada en el sprint (QA de Emilia)

| Subtarea | Historia | Evidencia | Resultado |
|---|---|---|---|
| FE-193 | Logout y tokens con Supabase real | `logout-supabase.md` | 12/12 real, 23/23 con dobles |
| FE-128 | Ficha familiar y regresión del diagnóstico | `ficha-familiar.md` | 10/10 API, 7/7 interfaz |
| FE-133 | Integridad y confidencialidad del genograma | `genograma.md` | 11/11 API, 7/7 interfaz; defecto FE133-01 corregido por Alejandro |
| FE-139 | Residencia y filtros | `residencia.md` | 11/11 API; interfaz aprobada |
| FE-145 | Difusión y separación clínica | `difusion.md` | 13/13 API, 7/7 interfaz |
| FE-150 | Portal público | `portal-publico.md` | 8/8 interfaz; recorrido escritorio y móvil |
| FE-155 | Informes contra los datos del caso | `informes.md` | 8/8 API; defecto FE155-01 abierto |
| FE-166 | Importación y protección de registros antiguos | `importacion.md` | 7/7 API |
| FE-171 | Paquete para Atlas.ti | `investigacion-atlasti.md` | 9/9 API; FE171-01 corregido en la prueba |
| FE-174 | API de gastos (implementación) | contrato FE-174 | 12/12 API, 31 unitarias; en `main` (PR #94) |
| FE-184 | API de artículos públicos (implementación) | contrato FE-184 | 13/13 API, 27 unitarias; PR pendiente de revisión |
| FE-161 | Exportación PDF/Word | `exportacion.md` | Ejecutada por Andrea como apoyo |

## Conclusión

La entrega integrada en `main` (`7e67568`), con todo el Sprint 3, **no tiene regresiones**: 361 unitarias y 550 de integración en el backend, 356 en el frontend, lint, tipos y compilaciones correctos, y Supabase real 12/12. Las tres incidencias nuevas (FE200-01, FE200-02 y FE200-03) eran de la infraestructura de pruebas, no de la aplicación, y quedaron corregidas en esta rama.

## 5. Incidencias

| ID | Severidad | Estado | Descripción y reproducción |
|---|---|---|---|
| **FE200-01** | Media | **Corregida en esta rama** | La suite completa del frontend fallaba de forma intermitente: 4 a 9 pruebas largas (informes, difusión, evaluación inicial, importación, investigación) superaban el límite por defecto de 5 s de vitest cuando corren todas en paralelo, y la siguiente prueba del mismo archivo fallaba en cadena. Corridas solas pasaban 54/54. Reproducción: `npx vitest run` completo en esta máquina (Duration ~85 s) → 4 fallidas por tiempo. Corrección: `testTimeout: 15_000` en `frontend/vite.config.ts`. Comprobación: 322/322 en dos corridas seguidas. No cambia la aplicación. |
| **FE200-02** | Baja | **Corregida en esta rama** | La prueba nueva "al crear una publicación, la imagen elegida se sube después de guardar el borrador" (#102) fallaba siempre: el simulador devolvía la imagen guardada con `new Response(blob)`, y en jsdom con Node 22 ese `Blob` no se acepta (mismo origen que FE171-01), así que la pantalla mostraba "No se pudo mostrar la imagen guardada". Corrección en `frontend/src/api/simulado/sprint3.ts`: responder con los bytes (`Uint8Array`). Solo afecta al simulador; la API real no usa ese código. Comprobación: 356/356. |
| **FE200-03** | Baja | **Corregida en esta rama** | En la suite de Supabase real, la conexión directa de la prueba a la base remota (solo para contar auditorías) se cortó por inactividad mientras R3 esperaba los 5 s (`ECONNRESET`), y R4, R5 y R6 fallaron en cadena: el cliente ya no servía y la sesión no llegó a cerrarse. Corrección en `backend/test/logout-supabase-real.test.mjs`: `pg.Pool` con reconexión en lugar de un `pg.Client` único. Comprobación: 12/12. |
| FE155-01 | Media | Revisar en `7e67568` (Alejandro indica que el informe ya incluye la composición familiar) | La casilla "Composición familiar" no cambia el texto del informe (ver `informes.md`). |
| FE133-01 | Media | **Cerrada**: el fix de Alejandro (`fix/FE-130-012-sin-roles`) está en `main` y se verificó con y sin roles | La migración 012 fallaba fuera de Supabase. |
| FE171-01 | Baja | Corregida (PR de FE-171) | Simulado de descarga con `Blob` incompatible con Node 22. |

## 6. Observaciones

- PR de QA pendientes de fusionar al momento de esta regresión: FE-155, FE-166, FE-171 y FE-150, más la implementación de FE-184. La regresión se ejecuta sobre lo que ya está en `main`; esos PR traen sus propias suites ya aprobadas.
- `indicadores-api-postgres` y otras suites antiguas usan variables `FE34/FE40/FE88_*` y bases con nombre fijo; el script las prepara solo. Unificarlas con `helpers/pg-qa.mjs` facilitaría el mantenimiento.
- No se probó producción ni el Supabase de la Fundación.

## 7. Cierre

- [x] Backend unitario y frontend (pruebas, lint, build).
- [x] Backend de integración en `6baa8c5`: 522/523, 0 fallidas; Supabase real 12/12.
- [x] Integración y Supabase real en `7e67568`: 550/551 y 12/12 (2026-11-27).
- [ ] Incidencias comunicadas y FE200-01 revisada por el equipo.
