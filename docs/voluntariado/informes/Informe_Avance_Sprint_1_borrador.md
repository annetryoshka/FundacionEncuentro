# Borrador de contenido — Informe de avance 1 del voluntariado (Sprint 1)

Tarea: FE-120 · Coordina y entrega: Gemina Ponce · Revisión funcional: Andrea · Plazo original: miércoles 2026-11-25 (vencido)

> Contenido tomado del repositorio. Debe pasarse al modelo institucional adjunto en FE-120. Lo que no consta queda como **Pendiente**.

## Identificación

| Campo | Dato |
| --- | --- |
| Proyecto | Sistema Web de Gestión Clínica y Administrativa — Fundación Encuentro (SIS-213, Grupo 7, UCB) |
| Informe | Primer informe de avance (Sprint 1) |
| Período | 2026-10-06 a 2026-10-22 |
| Fecha de entrega | Pendiente |
| Responsable de la entrega | Gemina Mayte Ponce Rubin de Celis (Scrum Master y PM) |
| Beneficiario / contraparte | Fundación Encuentro (directora: Kathia Morales) |

## 1. Resumen y porcentaje de avance

Objetivo del sprint: que una persona pueda iniciar sesión, crear cuentas, registrar un paciente con su carpeta correlativa, asignar el caso a una terapeuta y encontrarlo en la búsqueda, viendo solo lo que su rol permite. Ese recorrido se integró y se verificó de punta a punta (FE-46).

Porcentaje de avance: **Pendiente** (no se dispone de las horas del Sprint 1).

## 2. Hitos

| Fecha | Hito | Evidencia |
| --- | --- | --- |
| 2026-10-12 | API NestJS, base de datos y autenticación | PR #3 a #5 |
| 2026-10-13 | Base del frontend, login y sesión | PR #6 |
| 2026-10-14 | Usuarios por rol y registro integral de paciente y carpeta | PR #7 y #8 |
| 2026-10-20 | Carpetas con numeración y edición de datos del paciente | PR #10 |
| 2026-10-22 | Autorización por caso, asignación exclusiva y verificación de altas | PR #12, #13 y FE-34 |
| 2026-10-23 | Integración de búsqueda, permisos y verificaciones finales | commits `a4756ec` a `b0307f7` |

## 3. Estado por módulo

| Módulo | Estado |
| --- | --- |
| Autenticación y cierre de sesión | Integrado y verificado (FE-27) |
| Cuentas y roles | Integrado y verificado (FE-30) |
| Pacientes, carpetas y numeración correlativa | Integrado y verificado (FE-34, FE-46) |
| Asignación de terapeutas y restricciones | Integrado y verificado (FE-38) |
| Búsqueda y permisos | Integrado y verificado (FE-41) |

## 4. Horas ejecutadas y acumuladas

**Pendiente.** No se dispone de las horas del Sprint 1.

| Integrante | Horas ejecutadas |
| --- | --- |
| Andrea Narváez | |
| Jorge Calizaya | |
| Adriana Pando | |
| Alejandro Bobarin | |
| Gemina Ponce | |
| Emilia Crespo | |

## 5. Requisitos críticos con prueba y evidencia

| Requisito (SRS v1.0) | Prueba y evidencia |
| --- | --- |
| RF-23 Autenticación y acceso por rol y caso | `docs/pruebas/FE-27-verificacion-cierre.md`, `FE-38-asignacion-restricciones.md` |
| RF-24 Usuarios y asignación de casos | `docs/pruebas/FE-30-verificacion-cuentas-roles.md` |
| RF-01, RF-03 Registro y numeración correlativa | `docs/pruebas/FE-46-demostracion-integrada.md` |
| RF-12 Búsqueda | `docs/pruebas/FE-41-busqueda-permisos.md` |

## 6. Enlaces verificables

https://github.com/annetryoshka/FundacionEncuentro — detalle en [indice-evidencias.md](../indice-evidencias.md).

## 7. Validación con la contraparte

**Pendiente.** No consta en el repositorio una validación del Sprint 1 con la Fundación.

## 8. Riesgos y bloqueos

| Tema | Detalle |
| --- | --- |
| Entorno de prueba | La demostración usó un servidor de autenticación de prueba local, no el proyecto Supabase real (FE-46) |
| Datos | Solo datos ficticios |

## 9. Plan para el siguiente sprint

Incremento clínico y administrativo del Sprint 2: clasificación, consentimiento, diagnóstico, sesiones, tareas, historial, pagos e indicadores.

## Firma y responsable

Según el modelo institucional. **Pendiente.**
