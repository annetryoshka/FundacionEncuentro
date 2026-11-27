# FE-145 — Verificar estados y separación entre difusión y clínica

- **Historia:** FE-112, crear y administrar campañas, actividades y cursos de la Fundación.
- **Base probada:** `main` integrado (`c2b06c0`), en la rama `feature/FE-145-verificacion-difusion`. Incluye el modelo de Alejandro (FE-142), la API de Adriana (FE-143), el contenido de Gemina (FE-141) y el panel de Jorge (FE-144).
- **Referencia:** contrato `docs/srs/sprint-3/FE-140-difusion-publicaciones.md` (estados, permisos y aceptación).
- **Responsable QA:** Emilia Crespo.
- **Fecha de ejecución:** 2026-11-26 (America/La_Paz) · **Commit probado:** `c2b06c0` · PostgreSQL 17 local, Node v22.20.0
- **Resultado global:** API QA 13/13 (5,7 s); regresión FE-143 1/1; interfaz 45/45. Sin defectos.

## 1. Alcance

| Suite | Qué cubre |
|---|---|
| `backend/test/difusion-qa-api-postgres.test.mjs` (QA, nueva) | 13 escenarios por la API HTTP real: ciclo de estados, campos públicos, validaciones, recursos de imagen, portal de solo lectura y separación con la parte clínica. NestJS + PostgreSQL local desechable; solo Supabase Auth es un doble. |
| `frontend/src/features/difusion/DifusionQA.test.tsx` (QA, nueva) | 7 casos: menú de marketing sin secciones clínicas, 5 URLs clínicas escritas a mano sin datos visibles y el portal sin sesión sin llamadas clínicas. |
| `Difusion.test.tsx` (Jorge) y `publico/*.test.tsx` | 38 casos existentes: ciclo completo en la interfaz, 422 enfocado, 409, imagen principal, portal, "no disponible", contenido mostrado como texto. |
| `backend/test/difusion-api-postgres.test.mjs` (Adriana) | Regresión: el portal solo devuelve lo publicado. |

## 2. Cómo ejecutar

Requisito previo (una vez): los roles `anon` y `authenticated` en el PostgreSQL local (FE133-01 en `genograma.md`). Si `npm run build` falla con `Cannot find module`, correr `npm ci` antes.

```powershell
cd backend
npm run build
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<tu-clave>@localhost:5432/postgres'
node --test --test-force-exit test/difusion-qa-api-postgres.test.mjs
node --test --test-force-exit test/difusion-api-postgres.test.mjs
Remove-Item Env:FE_PG_QA, Env:FE_PG_ADMIN_URL
cd ..\frontend
npx vitest run src/features/difusion src/features/publico
```

## 3. Matriz de aceptación (API)

| # | Escenario (FE-140) | Esperado | Observado | Resultado |
|---|---|---|---|---|
| P1 | Marketing crea un borrador | 201, estado borrador, autoría de marketing; no aparece en el portal (404 y fuera del listado); administración lo ve | Como se esperaba | Aprobado |
| P2 | Publicar sin resumen | 422 con `camposFaltantes: ['resumen']`; sigue en borrador | 422 con resumen; sigue en borrador | Aprobado |
| P3 | Publicar válido | El portal muestra exactamente el contenido y solo los 12 campos públicos (sin estado ni autoría) | 12 campos públicos, contenido idéntico | Aprobado |
| P4 | Transiciones | Borrador→publicado→retirado→borrador→publicado: 200; borrador→retirado, repetir estado, publicado→borrador y retirado→publicado: 409; retirada da 404 en el portal; estado desconocido: 400 | Las 13 transiciones con el código esperado | Aprobado |
| P5 | Editar una publicada | Conserva el autor, registra quién editó; 11 datos inválidos (fechas, URL `javascript:`, tipo, límites, autoría o estado enviados por el cliente) → 400 sin cambiar lo publicado | Autoría conservada; 11/11 inválidos con 400 | Aprobado |
| P6 | Editar una publicada y quitarle el resumen | No debe quedar publicada sin resumen | Se impide (no queda publicada sin resumen) | Aprobado |
| P7 | HTML o script en el contenido | Se guarda y devuelve tal cual, como texto (la interfaz no lo interpreta) | Devuelto sin alterar | Aprobado |
| P8 | El portal es de solo lectura | `estado=borrador`, tipo desconocido o tamaño > 100 → 400; POST/PUT/PATCH/DELETE en `/publico` → 401, 404 o 405 sin cambios | 400 en filtros; 5 escrituras rechazadas sin cambios | Aprobado |
| P9 | El portal no expone carpetas | El ID de una carpeta o de un paciente da 404; ningún nombre de paciente en el listado | 404 / 404; sin nombres de pacientes | Aprobado |
| P10 | Marketing frente a la parte clínica | 403 en las 14 rutas clínicas y financieras (carpetas, casos, familia, genograma, diagnóstico, historial, sesiones, pagos, constancia, indicadores) | 403 en las 14 rutas | Aprobado |
| P11 | Terapeuta y visitante en la gestión de difusión | Terapeuta 403, sin sesión 401, en listar, crear y cambiar estado | 403 / 401 sin cambios | Aprobado |
| P12 | Recursos de imagen | Ruta con `..`, absoluta o con protocolo, SVG, más de 5 MB o sin texto alternativo → 400; una segunda imagen principal → 409; la publicada muestra su imagen | 6/6 con 400; 409 en la segunda principal; imagen pública correcta | Aprobado |
| P13 | Listado público | Solo campos públicos; tipo sin publicaciones → lista vacía con total 0, sin error; la paginación conserva el total | Como se esperaba | Aprobado |
| R1 | Regresión FE-143 | En verde | 1/1 | Aprobado |

## 4. Interfaz

| Caso | Resultado | Evidencia |
|---|---|---|
| Marketing solo ve "Difusión" en el menú (sin Carpetas ni Indicadores) | Aprobado | `DifusionQA` |
| Marketing escribe a mano 5 URLs clínicas: no ve nombres de pacientes, familiares ni montos, y toda respuesta clínica es un rechazo | Aprobado | `DifusionQA` |
| El portal sin sesión no llama a ninguna ruta clínica | Aprobado | `DifusionQA` |
| Ciclo completo, 422, 409, imagen, portal, contenido como texto, "no disponible" | Aprobado (existente) | `Difusion.test`, `publico/*` |
| Ejecución 2026-11-26 | 45/45 (7 QA + 38 existentes) | |

No existe ningún `dangerouslySetInnerHTML` ni `innerHTML` en el frontend; el contenido de las publicaciones siempre se muestra como texto.

## 5. Observaciones de la revisión del código (antes de ejecutar)

1. **Sin control de versión al editar.** `PUT /api/difusion/publicaciones/:id` no recibe versión: si dos personas editan a la vez, la última sobrescribe sin aviso. El 409 existe solo para las transiciones de estado. FE-140 no lo exigía; queda como riesgo bajo.
2. **El resumen solo se exige al publicar.** P6 comprueba si una publicada puede quedarse sin resumen al editarla.
3. La observación de Jorge de que el controlador público exponía `POST`/`DELETE` de recursos ya está corregida: los recursos están solo en `/difusion` (P8 lo confirma).

## 6. Hallazgos

No se encontraron defectos. Los estados, el portal de solo lectura y la separación con la parte clínica cumplen el contrato FE-140 por la API y en la interfaz. P6 confirmó que una publicación no puede quedarse sin resumen al editarla. Queda como riesgo bajo la falta de control de versión en la edición (observación 1).

## 7. Cierre

- [x] Suite QA de API y regresión ejecutadas; resultados en la matriz (13/13 y 1/1, 2026-11-26).
- [x] Interfaz verificada: 45/45 (2026-11-26).
