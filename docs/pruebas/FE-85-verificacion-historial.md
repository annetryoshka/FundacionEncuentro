# FE-85 — Probar historial clínico y separación de información

Historia FE-57 · Especificación [FE-81](../srs/sprint-2/FE-81-secciones-y-permisos-del-historial.md) ·
Implementación FE-83 (API, PR #32) y FE-84 (consultas) · Responsable: Emilia Crespo (QA)

## Base y alcance

Rama de la HU `feature/FE-83-api-historial-clinico` (`fef6607`). Se verifica
`GET /api/carpetas/:id/historial` por HTTP real contra los ejemplos de FE-81: secciones y orden,
tareas dentro de su sesión, exclusión de datos financieros, sección vacía, acceso ajeno y reasignación.
La interfaz (FE-82) está en otra rama sin integrar; su prueba queda pendiente.

No se modificó código de producción. Archivos: la suite nueva
`backend/test/historial-api-postgres.test.mjs` y este documento.

## Entorno y comandos

NestJS HTTP real, guards reales, PostgreSQL 17 local desechable con locale ICU `es-BO`, todas las
migraciones de la rama y datos ficticios. Solo se simula la respuesta de Supabase Auth
(`test/helpers/casos.mjs`). La suite crea una base aleatoria `fe85_run_*` y la elimina al terminar.

```powershell
cd backend
npm.cmd run build
$env:FE40_PG_QA='1'
$env:FE40_PG_ADMIN_URL='postgresql://postgres@127.0.0.1:55441/fe40_qa'
node --test test/historial-api-postgres.test.mjs
```

## Matriz de pruebas

| # | Criterio | Comprobación | En `fef6607` | Con la 005 |
|---|---|---|---|---|
| 1 | Sección vacía | Caso sin registros → 200 con encabezado; contexto, constancia y diagnóstico `null`; sesiones `[]` («Sin registro») | ✖ 500 (D1) | ✔ |
| 2 | Historial completo (ejemplo 1) | T1 ve contexto, constancia, diagnóstico y sesiones de A en orden de fecha y número; cada tarea dentro de su sesión; nada del caso B | ✖ 500 (D1) | ✔ |
| 3 | Sin montos (ejemplo 2) | Con un pago de 987,65, ni T1 ni administración ven el monto ni las claves `pagos`, `monto`, `metodo` o `moneda` | ✖ 500 (D1) | ✔ |
| 4 | Sin ficha (ejemplo 5) | Diagnóstico `null` y las demás secciones se conservan | ✖ 500 (D1) | ✔ |
| 5 | Acceso ajeno (ejemplo 3) | T2 → 404 sin datos de A; marketing → 403; sin token o token falso → 401; UUID inválido → 400; inexistente → 404 | ✖ 500 (D1) | ✔ |
| 6 | Solo el caso consultado (ejemplo 4) | Administración ve únicamente datos de B al consultar B | ✖ 500 (D1) | ✔ |
| 7 | Caso o paciente eliminado | → 404 | ✔ | ✔ |
| 8 | Reasignación | T1 pierde el acceso, T2 lo obtiene; el responsable histórico de las sesiones se conserva | ✖ 500 (D1) | ✔ |

Resultado en `fef6607`: **1 aprobada, 7 fallidas** por D1. La prueba 7 pasa porque el servicio corta
con 404 antes de consultar la constancia.

Con la migración 005 agregada de forma temporal (sin commit): **8 de 8 aprobadas**, en dos ejecuciones.

## Defectos

### FE-85-D1 · El historial responde 500 porque falta la tabla `constancias_atencion`

- **Severidad:** alta. Bloquea toda consulta del historial, incluso de un caso vacío.
- **Pasos:** con las migraciones de `feature/FE-83-api-historial-clinico`, `GET /api/carpetas/{A}/historial`
  como administración o como terapeuta asignada.
- **Esperado:** 200 con las secciones del historial.
- **Obtenido:** 500. PostgreSQL: `relation "constancias_atencion" does not exist`.
- **Causa:** `historial.service.ts` consulta `constancias_atencion`, que se crea en
  `005_constancia_atencion.sql`. La 005 está en FE-63 (`abaafdf`) y en FE-64 (`434194f`), con contenido
  idéntico (blob `9823471`). FE-83 se armó sobre `main` (`4c50218`) más FE-88 (`80c885a`) y nunca
  incorporó FE-63 ni FE-64, por eso la migración no está en la rama.
- **Por qué no lo detectaron las pruebas unitarias:** `historial.service.spec.ts` simula la base de datos.
- **Corrección acordada:** Adriana incorpora en FE-83 solo la migración 005, sin cambios de contenido,
  para que no quede duplicada ni distinta respecto de FE-63 y FE-64.
- **Verificación pendiente:** repetir esta suite contra una base nueva tras la corrección (deben pasar 8 de 8).

## Verificación complementaria de integración (local, sin publicar)

Para comprobar el orden de fusión se armó en local `main` + cadena de BD hasta FE-84 + FE-63 + FE-83 + las
ramas de API (FE-68, FE-73, FE-78, FE-88) y FE-49, contra un PostgreSQL 17 recién creado:

- Todas las migraciones compartidas (005, 006, 008, 009, 010) son idénticas en cada rama: se fusionan sin conflicto.
- 220 pruebas unitarias y todas las suites PostgreSQL aprobadas, incluidas FE-65, FE-70, FE-75, FE-80, FE-85 y FE-90.
- `listado-carpetas-postgres.test.mjs` falla en `main` desde FE-48 (el listado agregó `clasificacion`);
  lo corrige el PR #24 (FE-49).

## Pendiente

- Repetir la suite cuando FE-83 incorpore la 005.
- Probar la interfaz del historial (FE-82) cuando se integre con esta API.
