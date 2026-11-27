# Borrador de contenido — Informe de avance 2 del voluntariado (Sprint 2)

Tarea: FE-121 · Coordina y entrega: Gemina Ponce · Revisión funcional: Andrea · Entrega objetivo: viernes 2026-11-27; límite sábado 2026-11-28 (hora de La Paz)

> Este archivo reúne el **contenido** de los nueve apartados con datos que constan en el repositorio. El entregable final (`Informe_Avance_Sprint_2.docx` y `.pdf`) debe pasarse al modelo institucional adjunto en FE-120, que no está en el repositorio. Lo que no consta se deja marcado como **Pendiente**; no se inventan porcentajes, reuniones, firmas ni conformidad.

## Identificación

| Campo | Dato |
| --- | --- |
| Proyecto | Sistema Web de Gestión Clínica y Administrativa — Fundación Encuentro (SIS-213, Grupo 7, UCB) |
| Informe | Segundo informe de avance (Sprint 2) |
| Período real | Desde 2026-10-26 (planificación). Fecha de cierre del sprint: Pendiente de confirmar |
| Fecha de entrega | Pendiente |
| Responsable de la entrega | Gemina Mayte Ponce Rubin de Celis (Scrum Master y PM) |
| Beneficiario / contraparte | Fundación Encuentro (directora: Kathia Morales) |

## 1. Resumen y porcentaje de avance

Resumen: en el Sprint 2 el equipo integró en `main` las ocho historias del incremento clínico y administrativo: clasificación y filtros, constancia de consentimiento, ficha de diagnóstico, sesiones y seguimiento, tareas terapéuticas, historial clínico, pagos por sesión e indicadores. Cada una tiene verificación de QA con prueba positiva, negativa y de permisos, y la interfaz del expediente clínico quedó integrada.

Avance en horas del Sprint 2: **96,7 %** (116 h verificables de 120 h planificadas, según FE-58 y las horas informadas por Andrea). La diferencia de 4 h corresponde a una subtarea eliminada porque no se revisó. Es un indicador de horas del sprint, no el avance del proyecto completo.

## 2. Hitos

| Fecha | Hito | Evidencia |
| --- | --- | --- |
| 2026-10-26 | Planificación del Sprint 2 | FE-106, FE-107 |
| 2026-11-06 | Backend de clasificación y actualización de casos integrado (PR #18) | commit `41510fe` |
| 2026-11-09 | Especificaciones y guion de aceptación de las HU | commits `aa5065e` a `4c50218` |
| 2026-11-12 | Integración de las APIs clínicas y de pagos | commits `6ff3e93`, `80c885a`, `db7bdd3`, `50bf061` |
| 2026-11-13 | Integración en `main` de las ocho HU y de las ocho verificaciones de QA | merges `c73b8eb` a `313373d` |
| 2026-11-22 | Reporte de pruebas | commit `37ed16b` |
| Por confirmar | Review y retrospectiva del Sprint 2 | Pendiente |

## 3. Estado por módulo (al 2026-11-23)

| Módulo | HU | Estado |
| --- | --- | --- |
| Casos: clasificación y filtros | FE-14 | Integrado y verificado (14 pruebas aprobadas) |
| Constancia de consentimiento | FE-50 | Integrado y verificado (9 de 9 tras corregir FE-65-D1) |
| Ficha de diagnóstico | FE-13 | Integrado y verificado (8 pruebas aprobadas) |
| Sesiones y seguimiento | FE-55 | Integrado y verificado (10 pruebas aprobadas) |
| Tareas terapéuticas | FE-56 | Integrado y verificado (11 pruebas aprobadas) |
| Historial clínico | FE-57 | Integrado y verificado (8 de 8 tras corregir FE-85-D1) |
| Pagos por sesión | FE-7 | Integrado y verificado (12 pruebas aprobadas) |
| Indicadores operativos | FE-6 | Integrado y verificado (11 de 11 tras corregir FE-95-D1) |
| Interfaz del expediente clínico | Subtareas de frontend | Integrada en `main` (`d8ea18f`) |
| Aceptación integral por Andrea (PO) | FE-101 | Pendiente de registro |

## 4. Horas ejecutadas y acumuladas

Horas verificables del Sprint 2 informadas por Andrea (PO) el 2026-11-26.

| Integrante | Rol | Horas verificables en el Sprint 2 | Planificadas |
| --- | --- | ---: | ---: |
| Andrea Narváez | Analista y PO | 16 | 20 |
| Jorge Calizaya | Frontend | 20 | 20 |
| Adriana Pando | Arquitectura y backend | 20 | 20 |
| Alejandro Bobarin | Frontend y BD | 20 | 20 |
| Gemina Ponce | Scrum Master y PM | 20 | 20 |
| Emilia Crespo | QA y backend | 20 | 20 |
| **Total** | | **116** | **120** |

Horas acumuladas (Sprint 1 + Sprint 2): **pendientes**, porque no se dispone de las horas del Sprint 1. La confirmación individual de cada integrante también está pendiente.

## 5. Requisitos críticos con prueba y evidencia

| Requisito (SRS v1.0) | HU | Prueba y evidencia |
| --- | --- | --- |
| RF-04, RF-05, RF-12 Estado, clasificación y filtros | FE-14 | `docs/pruebas/FE-49-verificacion-clasificacion-filtros.md` |
| RF-07 Constancia de consentimiento | FE-50 | `docs/pruebas/FE-65-verificacion-constancia.md` |
| RF-08 Ficha de diagnóstico | FE-13 | `docs/pruebas/FE-70-verificacion-diagnostico.md` |
| RF-09 Fichas de seguimiento | FE-55 | `docs/pruebas/FE-75-verificacion-sesiones.md` |
| RF-10 Tareas terapéuticas | FE-56 | `docs/pruebas/FE-80-verificacion-tareas.md` |
| RF-11 Historial clínico | FE-57 | `docs/pruebas/FE-85-verificacion-historial.md` |
| RF-19 Pagos por sesión | FE-7 | `docs/pruebas/FE-90-verificacion-pagos.md` |
| RF-20 Dashboard | FE-6 | `docs/pruebas/FE-95-verificacion-indicadores.md` |
| RNF-01, RNF-02 Permisos y confidencialidad | Todas | Pruebas de acceso directo a la API y de cuenta ajena en cada verificación |

## 6. Enlaces verificables

Repositorio: https://github.com/annetryoshka/FundacionEncuentro. El detalle por sprint está en [indice-evidencias.md](../indice-evidencias.md). Los enlaces se revisan antes de la entrega.

## 7. Validación con la contraparte

**Pendiente.** En el repositorio no consta una validación del Sprint 2 con la Fundación. Si ocurrió, registrar fecha, participantes y comentarios reales; si no, el informe lo indica como no realizada.

## 8. Riesgos y bloqueos

| Tema | Estado |
| --- | --- |
| Defecto FE-65-D1 (fecha de consentimiento con hora y zona) | Corregido en `8c77aa3` y reverificado |
| Defecto FE-85-D1 (el historial respondía 500 por falta de la migración 005) | Corregido en `ebb39a8` y reverificado |
| Defecto FE-95-D1 (total de pagos sin movimientos llegaba como "0") | Corregido en `7e2c490` y reverificado |
| Aplicar en Supabase las migraciones 004 en adelante | Abierto (responsable: Alejandro), según FE-107 |
| Orden de integración de la cadena de base de datos | Abierto, según FE-107 |
| Pruebas ejecutadas con PostgreSQL local y datos ficticios | Limitación: repetir con el entorno real antes de la demo con la Fundación |
| Review y retrospectiva sin fecha confirmada | Abierto |

## 9. Plan para el siguiente sprint

Alcance del Sprint 3: difusión institucional y portal público (campañas, actividades y cursos), ciudad de residencia con filtro La Paz y El Alto, ficha familiar y genograma, informes, exportación a PDF y Word editable, importación histórica, investigación, gastos básicos sin reparto de ingresos y artículos públicos sin comentarios. La planificación de personal fue retirada del proyecto (actualización de alcance del 2026-11-26). Gestión del sprint en [bloqueos-e-integracion.md](../../gestion/sprint-3/bloqueos-e-integracion.md). Fechas por fijar.

## Firma y responsable

Según el modelo institucional. **Pendiente.**
