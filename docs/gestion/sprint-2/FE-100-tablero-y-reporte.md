# FE-100 — Tablero y reporte de avance

Tarea padre: FE-58 · Responsable: Gemina Ponce · Estimación: 3 h-persona

## Capacidad del sprint (supuesto de FE-58)

| Concepto | Horas |
| --- | --- |
| Capacidad bruta (6 personas × 24 h) | 144 |
| Planificado (6 × 20 h) | 120 |
| Margen para incidencias (6 × 4 h) | 24 |

Backlog: 8 HU, 30 puntos, 74 h en subtareas de HU + 46 h de la tarea transversal FE-58.

## Carga por persona

| Persona | HU | Gestión / validación | Eventos | Total | Real | Desviación |
| --- | --- | --- | --- | --- | --- | --- |
| Andrea | 10 | 6 | 4 | 20 | | |
| Jorge | 16 | 0 | 4 | 20 | | |
| Adriana | 16 | 0 | 4 | 20 | | |
| Alejandro | 16 | 0 | 4 | 20 | | |
| Gemina | 0 | 16 | 4 | 20 | | |
| Emilia | 16 | 0 | 4 | 20 | | |

## Reporte 1 — corte 2026-11-09 (`main` en `4c50218`)

```
Terminado:
- FE-14 (parte backend): clasificación y actualización autorizada de casos (FE-48, PR #18, 2026-11-06).
- Especificaciones de las HU del Sprint 2 por Andrea: FE-59, FE-61, FE-66, FE-71, FE-76, FE-81, FE-86, FE-91.
- Guion y datos ficticios de aceptación (FE-96).
Pendiente:
- Código de FE-50, FE-13, FE-55, FE-56, FE-57, FE-7 y FE-6; pantalla de FE-14.
- 4 decisiones abiertas (ver FE-98): constancia, ficha de diagnóstico, pagos por sesión, identificador de sesión.
Desviaciones de carga:
- Horas reales por persona aún no registradas: se anotarán en la tabla de arriba en el siguiente corte.
Decisiones de alcance:
- Ninguna por ahora. Si un bloqueo supera el margen, se retira FE-6 primero.
Margen consumido: 0 h de 24 (sin registro de horas todavía)
```

## Reporte 2 — corte 2026-11-23 (`main` en `37ed16b`)

```
Terminado:
- Las 8 HU del Sprint 2 integradas en main (merges del 2026-11-13) con su verificación de QA:
  FE-49, FE-65, FE-70, FE-75, FE-80, FE-85, FE-90 y FE-95.
- Interfaz del expediente clínico (merge d8ea18f) y reporte de pruebas (2026-11-22).
- 3 defectos de QA corregidos y reverificados: FE-65-D1, FE-85-D1, FE-95-D1.
Pendiente:
- Registro de la aceptación integral por Andrea (FE-101 / FE-97).
- Validación de las reglas de FE-61, FE-66 y FE-86 con la Fundación.
- Aplicar en Supabase las migraciones 004 a 011 (Alejandro).
- Review y retrospectiva del Sprint 2: sin fecha confirmada.
Desviaciones de carga:
- Horas reales por persona sin registrar. La daily de 30 min por día suma unas 5 h frente a las 2 h presupuestadas (ver FE-106).
Decisiones de alcance:
- Ninguna; no hubo que retirar FE-6.
Margen consumido: sin dato (no hay registro de horas reales).
```

## Formato de reporte (repetir en cada corte)

```
Corte: <fecha>
Terminado:
Pendiente (h restantes):
Desviaciones de carga:
Decisiones de alcance:
Margen consumido: <h> de 24
```

## Reglas de cambio

- Trabajo imprevisto: se absorbe primero con el margen.
- Si excede la capacidad: retirar alcance de menor prioridad, comenzando por FE-6, y actualizar el reparto.
- Los puntos se registran solo en las HU; las subtareas no añaden puntos.
- Las 30 estimaciones son de planificación: contrastar con el desempeño real, no presentarlas como velocidad demostrada.
