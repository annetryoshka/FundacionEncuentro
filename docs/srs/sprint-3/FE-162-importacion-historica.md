# FE-162 · Mapeo histórico y tabla de revisión

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado actualizado 26/11/2026:** contrato y tabla de revisión implementados por Andrea sobre el asistente integrado de Jorge. La validación de un archivo histórico real autorizado sigue pendiente.

HU FE-9 · RF-13/RF-14. Este documento conserva el contrato de diseño y añade al final su correspondencia con la implementación.

## 1. Flujo propuesto

Cargar XLSX/CSV normalizado → validar → ver vista previa → decidir coincidencias/filas → confirmar → consultar resumen del lote. Los archivos físicos requieren transcripción previa por el procedimiento que acuerde el equipo; no se presupone OCR ni transcripción de expedientes reales en esta tarea.

## 2. Mapeo mínimo

| Columna de plantilla | Destino/regla propuesta |
|---|---|
| referenciaOrigen | Referencia del registro en archivo original; no usarla como permiso ni UUID confiable. |
| nombreCompleto | Paciente; requerido y no solo espacios. |
| fechaNacimiento / edadAlIngreso | Opcionales, según datos disponibles y validaciones del alta. No inventar fechas de nacimiento a partir de una edad. |
| telefono | Opcional; nunca incorporar números inventados para pasar validaciones. |
| tipo | Caso: voluntario/derivado. No confundir con social/privado. |
| numeroCorrelativo | Opcional; si se suministra, comprobar unicidad por tipo. Si falta, usar el asignador existente. |
| fechaIngreso | Fecha histórica válida; no la fecha de importación. |
| clasificacion | social/privado/null; independiente del tipo. |
| ciudadResidencia / otraLocalidad | Catálogo FE-134, sin inferencia desde juzgado/sede. |
| diagnosticoIngreso / hipotesisRelacional / comentariosClinicos | Antecedentes de origen, conservando procedencia. No reemplazar una ficha clínica vigente automáticamente. |

Usar una plantilla acordada antes de leer directamente un Excel antiguo heterogéneo. Codificación CSV UTF-8; XLSX como formato alternativo. El delimitador, hoja y encabezados deben ser explícitos, sin adivinar columnas clínicas por posición.

## 3. Estados y decisiones por fila

| Estado | Acción |
|---|---|
| valida_nueva | Puede proponerse crear, después de revisión. |
| error | Mostrar columna y causa; no confirmar esa fila sin corregir/excluir. |
| posible_duplicado | Mostrar coincidencias mínimas y permitir decisión administrativa. |
| duplicado_en_lote | Advertir filas que chocan dentro del archivo; no elegir arbitrariamente cuál conservar. |
| excluida | Queda documentada y no se importa. |
| vinculada | Se asocia al paciente/caso elegido, sin sobreescribir su historia ni identidad. |

Coincidencia exacta de tipo/número es una colisión de carpeta a resolver. Nombre parecido es una advertencia, no prueba de que se trate de la misma persona. No fusionar ni borrar automáticamente.

## 4. Vista previa y confirmación, API nueva propuesta

Respuesta de vista previa con identificador opaco y versión del lote:

```json
{
  "loteId": "QA-LOTE-01",
  "version": 1,
  "resumen": {
    "total": 7,
    "validas": 1,
    "advertencias": 3,
    "errores": 3
  },
  "filas": [
    {
      "numeroFila": 8,
      "referenciaOrigen": "QA-007",
      "estado": "valida_nueva",
      "errores": [],
      "coincidencias": [],
      "decision": "crear"
    },
    {
      "numeroFila": 3,
      "referenciaOrigen": "QA-002",
      "estado": "posible_duplicado",
      "errores": [],
      "coincidencias": [
        {
          "pacienteId": "00000000-0000-4000-8000-000000000011",
          "nombreCompleto": "Paciente QA A",
          "tipo": "voluntario",
          "numero": 101
        }
      ],
      "decision": null
    }
  ]
}
```

Es una forma ilustrativa de siete filas, no el resultado ejecutado del CSV. Los conteos completos deben proceder de todas las filas, no de este extracto.

El servidor conserva o vuelve a validar el contenido y la versión del lote antes de confirmar; no confía en filas/IDs cambiados por el cliente. Repetir confirmación de un lote ya aplicado devuelve su resultado sin duplicar registros. Si cambió un registro de destino desde la vista previa, vuelve a advertir el conflicto.

## 5. Componente que Andrea debe implementar después

Columnas: fila, referencia, paciente, tipo/número, estado, errores, coincidencias y decisión. Selección explícita crear/vincular/excluir; detalle de errores accesible y confirmación deshabilitada mientras haya decisiones obligatorias sin resolver.

El componente recibe datos y callbacks del contrato; Jorge integra carga/confirmación. No simular éxito visual sin respuesta del backend.

## 6. Casos y aceptación

[CSV ficticio](ejemplos/FE-162-importacion-ficticia.csv): paciente nuevo, coincidencia con paciente/carpeta existente, fecha imposible, nombre vacío, repetición dentro del lote y otra localidad sin detalle.

- Comparar antes/después: identidad, correlativos y ficha vigente conservados.
- Un lote repetido no duplica pacientes, casos, antecedentes o importes.
- Un fallo de confirmación no presenta como importadas filas que no se guardaron; definir transacción por lote o resultado por fila antes de implementar.
- Administración puede importar; otros roles no.
- Guardar procedencia, autor, momento, decisiones y resultado del lote.

**Pendiente:** contrastar columnas con una muestra vacía/anonimizada autorizada del archivo antiguo y construir/revisar el componente de FE-162. No se efectuó importación real.

## 7. Entrega técnica de Andrea · 26/11/2026

`TablaRevisionImportacion.tsx` presenta fila/referencia, paciente, tipo/número, estado, cantidad de errores/coincidencias y decisión actual. El botón «Revisar fila» lleva el foco al detalle editable de FE-165, donde se conservan las acciones de corregir, crear, vincular o excluir ya integradas. No se duplica la lógica de persistencia ni se inventa un resultado sin respuesta del servidor.

La tabla respeta el filtro del lote, bloquea revisiones obsoletas y ofrece desplazamiento horizontal dentro de su propia región accesible en celular. Las acciones conservan el control de versión, el rechazo de 409 y el bloqueo de confirmación con filas pendientes.

La plantilla efectiva es `db/importacion/plantilla-importacion-historica.csv` y `COLUMNAS` de `importacion.ts`: son 18 columnas, incluyendo estado y contexto judicial. La API efectiva usa POST `/api/importaciones`, GET `/api/importaciones/:id`, PATCH `/:id/filas/:numeroFila` y `/:id/filas/:numeroFila/datos`, y POST `/:id/confirmar`. El resultado es transaccional por lote e idempotente. El ejemplo JSON del apartado 4 conserva su carácter ilustrativo; se aplican los tipos efectivos del cliente.

Verificación ejecutada: **13 pruebas de interfaz** entre `TablaRevisionImportacion.test.tsx` y `Importacion.test.tsx`, todas aprobadas. La suite de integración existente de FE-164 ya comprueba la muestra de FE-162, duplicados, formatos, correcciones, confirmación y no duplicación en PostgreSQL. La revisión de navegador de esta entrega se registra en FE-196. No se declara una nueva revisión de Jorge ni una importación de expedientes reales.

El componente queda entregado. Para aceptar el mapeo del archivo antiguo de la Fundación falta una muestra autorizada y su contraste con estas columnas; se conserva como validación externa pendiente.

## Aceptación del alcance técnico por la PO · 26/11/2026

Andrea aprobó el cierre del alcance técnico de Sprint 3: plantilla normalizada de 18 columnas, revisión por fila y conservación de expedientes existentes. La validación externa permanece pendiente y se traslada por su decisión expresa a [FE-214](https://andreanarvaezort-1786202493806.atlassian.net/browse/FE-214), prevista en Sprint 4. Este apartado sustituye el pendiente de cierre de Sprint 3 de las secciones anteriores, sin acreditar ensayos en la instalación de la Fundación, una muestra histórica real ni un catálogo/perfil institucional aprobado. No se registran horas reales ni reuniones.
