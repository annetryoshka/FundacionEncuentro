# FE-177 · Disponibilidad y cruces de horario

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado:** propuesta funcional preparada; ratificación de alcance pendiente.

HU FE-4 · N-21. La SRS mezcla esta necesidad con RF-24, pero RF-24 corresponde a usuarios/asignaciones. Registrar planificación como alcance propio y ratificarlo antes de implementar. Desbloquea FE-178/179/180/181.

## 1. Propuesta mínima

Administración registra bloques por persona, fecha, inicio, fin y descripción/tipo. Consulta por persona/período y edición. No es una agenda pública de citas ni un registro de pacientes.

Tipos iniciales propuestos: disponibilidad y actividad. Un bloque de disponibilidad no es por sí mismo una ocupación. Comprobar solapamiento de actividades de la misma persona; definir con la Fundación si estar fuera de disponibilidad también debe advertirse.

## 2. Regla de intervalos

Usar hora local de La Paz y fechas explícitas. Intervalos semiabiertos: inicio incluido, fin excluido. En una misma fecha/persona:

`hayCruce = nuevoInicio < finExistente && nuevoFin > inicioExistente`.

Dos actividades contiguas no se cruzan. Fin debe ser posterior al inicio; el alcance inicial no cruza medianoche. Si se requieren jornadas nocturnas o recurrencias, deben refinarse por separado.

## 3. Tres ejemplos de aceptación

Existe actividad QA de 09:00 a 10:00:

| Nueva actividad, misma persona/fecha | Resultado |
|---|---|
| 10:00–11:00 | Sin cruce. |
| 09:30–10:30 | Advertencia antes de confirmar. |
| 11:00–10:00 | Inválida; no guarda. |

Una actividad de otra persona o fecha no produce conflicto. Al editar, excluir el propio registro del cálculo.

## 4. Advertencia y confirmación

Propuesta acorde con la HU: mostrar el cruce, conservar lo escrito y permitir cancelar. Si se acuerda permitir superposición, exigir confirmación explícita y volver a evaluar en servidor al guardar; el cliente no puede declarar “sin conflicto” por su cuenta. Si la Fundación prefiere bloqueo, registrar esa decisión antes de cambiar el contrato.

Contrato nuevo propuesto: listar/crear/actualizar bloques del personal y respuesta de conflictos con persona/intervalo pertinentes. La UI es administrativa; no devuelve fichas ni motivos clínicos de consulta.

## 5. Campos y permisos

Persona autorizada y activa, fecha calendario, horas válidas, tipo y descripción requeridos; autoría/actualización del servidor. No eliminar registros históricos por desactivar una cuenta.

Administración realiza cambios. Consulta por otros perfiles solo si se ratifica; no inferir que todas las terapeutas pueden consultar disponibilidad de todo el personal.

## 6. Aceptación y pendientes

- Guardar, consultar y editar un bloque; el aviso no borra datos.
- Cruce advertido antes de confirmar y revalidado al escribir.
- Rechazo de horas invertidas o persona inexistente.
- Sin doble aviso por incluir el registro que se edita.
- Sin acceso administrativo para marketing o visitante.

**Para completar FE-177:** ratificar necesidad, perfiles de consulta y si el cruce advierte o bloquea. Los ejemplos y regla técnica están preparados; no se afirma que ya se acordaron con la Fundación.
