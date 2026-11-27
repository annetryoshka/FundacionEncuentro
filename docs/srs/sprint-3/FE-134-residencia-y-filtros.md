# FE-134 · Residencia, filtros y conteos de aceptación

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado del entregable:** contrato de análisis preparado; las validaciones pendientes se indican expresamente. No acredita implementación ni pruebas del producto.

HU FE-111 · RF-02/RF-12/RF-20. Desbloquea FE-135/136/137/138/139.

## 1. Regla confirmada

Se agrupa por **ciudad de residencia del paciente**. Vive en El Alto y se atiende en La Paz ⇒ El Alto. El dato no es sede, juzgado ni institución de procedencia.

## 2. Catálogo propuesto

| Valor persistido | Etiqueta | Complemento |
|---|---|---|
| `la_paz` | La Paz | Sin localidad libre. |
| `el_alto` | El Alto | Sin localidad libre. |
| `otra` | Otra localidad | Nombre de localidad requerido. |
| `null` | Sin registrar | No adivinar el domicilio de pacientes antiguos. |

En un filtro, “Todas” omite el parámetro y “Sin registrar” envía `residencia=sin_registrar`; este último es un valor de consulta, no una cuarta ciudad guardada.

**Propuesta para Sprint 3:** residencia actual en el paciente, compartida por sus casos; cualquier cambio actualiza las agrupaciones actuales sin renumerar ni tocar asignaciones. Registrar fecha/autor del cambio. Si se necesita residencia al ingreso para estadísticas históricas, debe añadirse un dato temporal distinto y explicarse qué indicador usa cada uno. Esa necesidad histórica sigue por confirmar.

## 3. Ampliación de contratos

- Extender datos del paciente, encabezado y listado con `ciudadResidencia` y `otraLocalidad`.
- Agregar `residencia` a GET `/api/carpetas`, conservando `busqueda`, `clasificacion`, `estado`, `pagina` y `tamano`.
- Combinar filtros con AND en servidor antes del total y paginación. El criterio de autorización también se aplica antes.
- En indicadores, conservar `desde` y `hasta`: son los nombres actuales. Añadir residencia sin cambiar la semántica existente de casos actuales y sesiones/pagos por período.
- Cambiar un filtro vuelve a página 1. Un resultado vacío conserva el total correcto.

Las ampliaciones son propuestas; las rutas base ya existen.

## 4. Datos ficticios comunes

Período de sesiones/pagos: **20 a 21/11/2026**, inclusivo.

| Caso | Residencia | Clasificación | Estado | Asignación | Sesiones del período | Ingresos BOB |
|---|---|---|---|---|---:|---:|
| A | La Paz | social | en_proceso | T1 | 2 | 75.50 |
| B | El Alto | privado | iniciado | T2 | 1 | 100.00 |
| C | Sin registrar | social | iniciado | T1 | 0 | 0.00 |
| D | Otra: Viacha ficticia | privado | concluido | Sin asignar | 0 | 0.00 |

No son registros reales ni tarifas de la Fundación. El pago A pertenece a S-A1; S-A2 permanece sin pago.

## 5. Resultados esperados

| Perfil y selección | Casos | Total | Sesiones | Ingresos |
|---|---|---:|---:|---:|
| Administración, todas | A/B/C/D | 4 | 3 | 175.50 |
| Administración, La Paz | A | 1 | 2 | 75.50 |
| Administración, El Alto | B | 1 | 1 | 100.00 |
| Administración, Sin registrar | C | 1 | 0 | 0.00 |
| Administración, Otra | D | 1 | 0 | 0.00 |
| T1, todas sus carpetas | A/C | 2 | — | No autorizado. |
| T1, social + iniciado | C | 1 | — | No autorizado. |
| T1, El Alto | Ninguno | 0 | — | No autorizado. |
| Marketing | Denegado | — | — | — |

Las terapeutas no reciben indicadores financieros por añadirles un filtro. Las consultas administrativas y clínicas mantienen sus permisos.

## 6. Casos de aceptación

- Guardar residencia y recargar; modificarla conserva número, origen, historial y asignación.
- Históricos sin dato quedan en “Sin registrar”; elegir “Todas” los incluye.
- Código de ciudad desconocido o “otra” sin localidad produce validación.
- Cambiar domicilio de A de La Paz a El Alto cambia las agrupaciones actuales, no la fecha de ingreso.
- Dos sesiones/tareas de A no duplican el conteo de casos ni su pago.
- Una fecha sin pagos da importe `0.00`; fallo de carga nunca se presenta como cero.

**Pendiente para cierre:** ratificar si se necesita análisis por residencia histórica y confirmar la presentación de “Otra localidad”.

## Revisión de la entrega integrada por Andrea · 26/11/2026

El alcance solicitado por Andrea es el lugar donde **vive** el paciente. La implementación guarda su residencia actual registrada en el paciente (`la_paz`, `el_alto`, `otra` más detalle, o null), compartida entre sus casos. El catálogo y el filtro «Sin registrar» del contrato están integrados; no se deduce la residencia del lugar de atención, juzgado ni procedencia.

La migración 016, `residencia.ts`, `SelectorResidencia.tsx` y las consultas de carpetas/indicadores aplican esa misma semántica. Cambiar residencia actualiza la agrupación actual; no cambia origen, número, familia ni autorías. No se comprometió una dimensión histórica de residencia al ingreso: sería un campo diferente y un requisito adicional, no un impedimento para el alcance actual.

Evidencia técnica: `backend/test/residencia-postgres.test.mjs`, `frontend/src/features/carpetas/Residencia.test.tsx`, `ResidenciaCarpetas.test.tsx` y pruebas de indicadores. Están incluidas en la regresión integrada de `18ae1cf` y en la suite actual de frontend. Los casos A–D siguen siendo ficticios. Esta revisión cierra la definición del catálogo y los ejemplos de FE-134; no certifica estadísticas históricas de residencia ni uso con pacientes reales.
