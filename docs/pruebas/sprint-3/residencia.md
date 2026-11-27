# FE-139 — Conciliar casos y filtros de ambas ciudades

- **Historia:** FE-111, registrar la ciudad de residencia y filtrar casos de La Paz y El Alto.
- **Base probada:** `main` integrado (`c806c34`), en la rama `feature/FE-139-verificacion-residencia`. Incluye la base de Alejandro (FE-135), la API de Adriana (FE-136), los controles de Gemina (FE-137) y la integración de Jorge (FE-138).
- **Referencia:** casos A–D y resultados esperados de `docs/srs/sprint-3/FE-134-residencia-y-filtros.md` (secciones 4 y 5).
- **Trazabilidad:** RF-02, RF-12, RF-20.
- **Responsable QA:** Emilia Crespo.
- **Fecha de ejecución:** 2026-11-26 (America/La_Paz) · **Commit probado:** `c806c34` · PostgreSQL 17 local, Node v22.20.0
- **Resultado global:** suite QA por API 11/11 aprobadas (6,7 s); regresión FE-135 10/10; interfaz 29/29 y recorrido manual aprobados. Sin defectos.

## 1. Alcance y diferencia con las pruebas existentes

`backend/test/residencia-postgres.test.mjs` (Alejandro) comprueba la base con una consulta SQL que **imita** al servicio. La suite QA de esta subtarea, `backend/test/residencia-qa-api-postgres.test.mjs`, pasa por la **API HTTP real**: NestJS, guards, DTO y servicios reales sobre PostgreSQL 17 local desechable. Solo Supabase Auth es un doble.

Datos ficticios (FE-134 §4): A La Paz / social / en_proceso / T1; B El Alto / privado / iniciado / T2; C sin registrar / social / iniciado / T1; D otra (Viacha ficticia) / privado / concluido / sin asignar. Sesiones del 20 al 21/11/2026: A 2 (pago 75,50), B 1 (pago 100,00).

## 2. Cómo ejecutar

Requisito previo (una vez): los roles `anon` y `authenticated` en el PostgreSQL local (ver FE133-01 en `genograma.md`).

```powershell
cd backend
npm run build
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<tu-clave>@localhost:5432/postgres'
node --test --test-force-exit test/residencia-qa-api-postgres.test.mjs
node --test --test-force-exit test/residencia-postgres.test.mjs test/indicadores-api-postgres.test.mjs
Remove-Item Env:FE_PG_QA, Env:FE_PG_ADMIN_URL
```

## 3. Matriz de aceptación

| # | Escenario | Esperado | Observado | Resultado |
|---|---|---|---|---|
| R1 | Tabla de FE-134, administración: todas / La Paz / El Alto / sin registrar / otra | ABCD 4 · A 1 · B 1 · C 1 · D 1 | ABCD 4 · A 1 · B 1 · C 1 · D 1 | Aprobado |
| R2 | Paciente de El Alto atendido en La Paz; residencia en la respuesta | Aparece en El Alto; `ciudadResidencia` y `otraLocalidad` correctos; sin registrar = `null` | B en El Alto; campos correctos; C con null | Aprobado |
| R3 | Terapeuta T1: todas, social+iniciado, El Alto (ajena) | AC · C · 0 sin exponer B; T2 ve B | AC · C · 0; T2 ve B | Aprobado |
| R4 | 7 combinaciones con estado, clasificación y búsqueda | Solo los casos que cumplen todos los filtros, con total coherente | 7/7 con total coherente | Aprobado |
| R5 | Paginación de 2 en 2 y página vacía | Total 4 en cada página, sin repetir carpetas; página vacía conserva total 1 | Total 4 en las 3 páginas, 4 carpetas distintas; página vacía con total 1 | Aprobado |
| R6 | Valores inválidos (ciudad desconocida, etiqueta en vez de código, vacío, tamaño/página fuera de rango, fechas invertidas o imposibles) | 400 | 400 en los 9 casos | Aprobado |
| R7 | Indicadores por residencia 20–21/11 | La Paz 1/2/75,50 · El Alto 1/1/100,00 · sin registrar 1/0/0,00 · otra 1/0/0,00; suma = total general (4 casos, 3 sesiones, 175,50); período vacío 0 y 0,00 | Como se esperaba; suma 4 / 3 / 175,50; período vacío 0 / 0,00 | Aprobado |
| R8 | Permisos | Indicadores: T1 403, marketing 403, sin token 401, admin 200; listado: marketing 403, sin token 401 | 403/403/401/200; listado 403/401 | Aprobado |
| R9 | Cambiar residencia con datos inválidos o sin permiso | "otra" sin localidad, localidad en blanco, localidad con La Paz, localidad sin ciudad, ciudad desconocida, localidad > 100 → 400; T1 y marketing → 403; nada cambia | 400 por la regla de residencia en los 6 casos; T1 y marketing 403; sin cambios | Aprobado |
| R10 | Mudar A de La Paz a El Alto | Número, tipo, estado, clasificación, fecha, terapeuta y sesiones iguales; se registra quién cambió la residencia; El Alto pasa a AB con 2/3/175,50 y La Paz a 0/0/0,00; T1 sigue viendo A | Como se esperaba | Aprobado |
| R11 | Borrar la residencia de D | Vuelve a "Sin registrar" (CD) y no queda la localidad guardada | CD; localidad en null | Aprobado |
| R12 | Regresión: suites de FE-135 y FE-136 | Todas en verde | FE-135: 10/10. `indicadores-api-postgres` (FE-136): 12 omitidas, ver nota | Aprobado (parcial) |

## 4. Observaciones de la revisión del código (antes de ejecutar)

1. Solo administración puede cambiar la residencia (`PATCH /api/carpetas/:id`). FE-111 habla de "usuaria autorizada"; confirmar con Andrea que la terapeuta no deba poder corregirla.
2. La residencia es del paciente y la comparten todas sus carpetas: si un paciente tiene dos carpetas, cambiarla mueve ambas. Es la regla acordada en FE-134; se deja anotado.
3. `PATCH /api/carpetas/:id` exige siempre `nombreCompleto` y `fechaIngreso`, aunque solo se cambie la residencia (contrato FE-52). El frontend los envía juntos; las pruebas QA hacen lo mismo y comprueban que cada 400 de R9 se deba a la residencia y no a la falta de esos campos.
4. Estilo: la sangría de los filtros en `listarCarpetas` es irregular. No afecta el funcionamiento.

## 5. Interfaz

- **Base:** `main` (`c806c34`), en modo simulado, 2026-11-26.
- **Automatizado (existente, Gemina y Jorge):** `Residencia.test.tsx`, `ResidenciaCarpetas.test.tsx` e `Indicadores.test.tsx`: 29/29 en verde. Cubren el catálogo y las etiquetas, "otra" con localidad obligatoria, el filtro en la URL con vuelta a la página 1, la combinación con otros filtros, el filtrado de la terapeuta dentro de sus carpetas, el alta y el cambio de residencia (conserva número, fecha y terapeuta), volver a "Sin registrar" y que la terapeuta no vea indicadores. No hacía falta agregar pruebas de interfaz.
- **Manual (navegador integrado, móvil de 375 px, cuenta de dirección):**

| Paso | Esperado | Resultado |
|---|---|---|
| Listado con `?residencia=el_alto` | "4 carpetas · Filtro: Residencia: El Alto"; las 4 tarjetas muestran la etiqueta El Alto | Aprobado |
| Opciones del filtro | Todas, La Paz, El Alto, Otra localidad, Sin registrar | Aprobado |
| Indicadores por residencia (1/10 al 30/11) | El desglose concilia con el total: 14 casos = 5+4+2+3; iniciado 6 = 1+2+2+1; en proceso 6 = 3+2+0+1; en conclusión 2 = 1+0+0+1; sesiones 2; pagos Bs 75,50; El Alto 4 = lo que muestra el listado | Aprobado |
| Texto de ayuda | "Ciudad donde vive el paciente, no donde se atiende" | Aprobado |
| Móvil | Sin desplazamiento horizontal (ancho 375 = 375) en el listado y en los indicadores | Aprobado |

## 6. Hallazgos

No se encontraron defectos: filtros, totales, paginación, indicadores y permisos coinciden con los casos ficticios de FE-134, tanto por la API como en la interfaz.

**Nota sobre la regresión de FE-136:** `backend/test/indicadores-api-postgres.test.mjs` usa otras variables (`FE40_PG_QA` y `FE40_PG_ADMIN_URL`) y una base llamada `fe40_qa`, así que con la configuración de esta guía sus 12 pruebas se omiten. Lo que verifica por residencia (desglose solo para administración) lo cubren R7 y R8 de la suite QA. Para correrla también: crear la base `fe40_qa` en el PostgreSQL local y usar `FE40_PG_QA=1` y `FE40_PG_ADMIN_URL=postgres://postgres:<clave>@localhost:5432/fe40_qa`. Sería bueno unificar el mecanismo con `helpers/pg-qa.mjs` (sugerencia para Adriana).

## 7. Cierre

- [x] Suite QA y regresión ejecutadas; resultados en la matriz (11/11 y 10/10, 2026-11-26).
- [x] Interfaz verificada: 29/29 pruebas existentes y recorrido manual en móvil (2026-11-26).
