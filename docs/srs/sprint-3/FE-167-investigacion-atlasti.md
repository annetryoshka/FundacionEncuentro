# FE-167 · Catálogo y exportación para investigación

**Responsable:** Andrea Carolina Narváez Ortega.

**Fecha:** 23/11/2026.

**Base revisada:** `main` en `37ed16bcca9bb3d6842c62f41b58a1bf17f7616f`.

**Estado del entregable:** análisis preparado; no acredita implementación ni validación de la Fundación.

HU FE-115 · RF-21/RF-22 · ADR-001. Desbloquea FE-168/169/170/171.

## 1. Alcance propuesto

Categorías administrables, asignación a caso o a una ficha y selección de documentos/secciones para análisis externo. La base ya dispone de `categorias_investigacion` y `caso_categorias`; debe completarse el flujo sin presentar esas tablas como una integración terminada.

La [documentación oficial de ATLAS.ti](https://manuals.atlasti.com/Win/en/manual/Documents/DocumentsSupportedFileFormats.html) admite documentos DOCX y TXT. Esto sustenta el formato de intercambio, pero no demuestra la importación en la versión usada por la Fundación ni importa por sí mismo categorías/códigos como un proyecto nativo.

## 2. Catálogo de prueba y relaciones

| Código ficticio | Nombre | Uso |
|---|---|---|
| QA-CAT-01 | Categoría de prueba 1 | Caso A y ficha seleccionada de A. |
| QA-CAT-02 | Categoría de prueba 2 | Caso B. |

Son ejemplos técnicos, no una taxonomía clínica aprobada. Definir nombres, descripciones, jerarquía opcional y vigencia con la Fundación.

Una relación apunta al caso y opcionalmente a **una** ficha del mismo caso: diagnóstico o seguimiento. El esquema no permite ambos tipos en una relación. Validar esa correspondencia, no solo que cada UUID exista por separado.

## 3. Roles y selección

No existe un rol “investigadora” en la aplicación actual. Propuesta con roles existentes: administración selecciona dentro de su acceso global; terapeuta, solo información de sus casos asignados si se autoriza ese uso; marketing no exporta datos clínicos. Ratificar quién realizará investigación y qué autorización se requiere antes de usar datos reales.

Filtros propuestos: categorías, período de sesiones y residencia según FE-134. Mostrar selección exacta de casos y secciones antes de generar. No ampliar el conjunto autorizado por conocer un UUID.

## 4. Paquete propuesto

- Un documento DOCX o TXT por caso seleccionado, con secciones estructuradas.
- Identificadores de exportación `INV-001`, `INV-002`; sin nombres de pacientes en nombres de archivo.
- Manifiesto con ID de exportación, archivo, categorías y secciones. No incluir un mapa público de UUID/número de carpeta/paciente.
- El vínculo interno entre exportación y caso se conserva solo en el sistema protegido.
- No incluir teléfono, nacimiento, domicilio ni datos financieros por defecto.

Ejemplo de manifiesto ficticio:

```json
{
  "formatoVersion": 1,
  "documentos": [
    {
      "idExportacion": "INV-001",
      "archivo": "INV-001.docx",
      "categorias": [
        "QA-CAT-01"
      ],
      "secciones": [
        "diagnostico",
        "seguimiento"
      ]
    },
    {
      "idExportacion": "INV-002",
      "archivo": "INV-002.docx",
      "categorias": [
        "QA-CAT-02"
      ],
      "secciones": [
        "seguimiento"
      ]
    }
  ]
}
```

## 5. Revisión de identificadores

Cambiar encabezados no anonimiza el texto libre. Incluir una revisión previa de notas, nombres de familiares, instituciones y otros elementos identificables; documentar el tratamiento acordado. No prometer anonimización automática perfecta ni autorización para investigación por el solo hecho de tener acceso asistencial.

## 6. Aceptación e interoperabilidad

| Prueba | Resultado esperado |
|---|---|
| Dos casos y categorías seleccionados | Dos documentos y dos entradas de manifiesto, sin mezcla. |
| Sesión de B asignada a A | Rechazo; no etiquetar/exportar datos cruzados. |
| Categoría vacía/duplicada según jerarquía | Validación conforme al catálogo acordado. |
| Terapéuta pide caso ajeno | Denegado antes de exportar. |
| Lectura de documentos | DOCX/TXT abre y mantiene texto/secciones. |
| Importar en ATLAS.ti de prueba | Registrar versión, plataforma, procedimiento y resultado observado. |
| Software de prueba no disponible | Compatibilidad ejecutada pendiente, sin marcarla como aprobada. |

**Para completar FE-167:** ratificar categorías, secciones, perfil autorizado y tratamiento de identificadores. La verificación documental de formatos está realizada; la prueba de importación del producto corresponde a FE-171.

## Revisión de la entrega integrada por Andrea · 26/11/2026

La selección/categorización y preparación de paquetes están implementadas en `InvestigacionModule`. El DTO efectivo pide `casosIds`, secciones `diagnostico`/`seguimiento`/`tareas`, formato `docx` o `txt` y período opcional. El servidor limita cada caso al acceso actual, conserva la relación interna y exige una revisión explícita del paquete antes de la descarga. Una huella detecta cambios entre la vista previa y la confirmación.

La evaluación inicial se incluye en el documento y se presenta en pantalla antes de confirmar. Los nombres de archivo usan códigos de exportación; el texto libre requiere revisión profesional de posibles identificadores. La suite `evaluacion-inicial-postgres.test.mjs` probó vista previa, ZIP y cambio de huella (409), además de la regresión de `investigacion-api-postgres.test.mjs`. El frontend tiene el mismo recorrido en `Investigacion.test.tsx`.

El [manual oficial de ATLAS.ti 26 para Windows](https://manuals.atlasti.com/Win/es/manual/Documents/DocumentsSupportedFileFormats_es.html), consultado el 26/11/2026, enumera DOCX y TXT como formatos documentales compatibles. Eso sustenta el intercambio de documentos, **sin demostrar la versión instalada en la Fundación ni una importación de proyectos/códigos nativos**.

Pendientes externos de FE-167: catálogo clínico definitivo, perfiles autorizados para investigación con datos reales y prueba de importación de un paquete ficticio en la versión concreta de ATLAS.ti. Los ejemplos COM-FAM/LIM/QA conservan su carácter de datos de prueba. No se atribuye una taxonomía clínica aprobada a la Fundación ni se amplían sus permisos de investigación por la sola existencia de acceso asistencial.
