# Pantallas del sistema (recorridos guiados)

Inventario de pantallas para avanzar los recorridos del botón «?» uno por uno. Rutas y roles según `frontend/src/App.tsx`.

Roles: **A** administrador · **T** terapeuta · **M** marketing. Estado del recorrido: pendiente / borrador (texto sin validar con la Fundación) / listo.
Los pasos están en `frontend/src/features/recorridos/recorridos.ts`; cada elemento señalado lleva `data-recorrido="…"`.

## Acceso e inicio

| # | Pantalla | Ruta | Roles | Qué es | Recorrido |
|---|---|---|---|---|---|
| 1 | Iniciar sesión | `/login` | todos | Formulario de correo y contraseña del personal. | pendiente |
| 2 | Inicio | `/inicio` | A T M | Saludo y accesos según el rol; búsqueda directa de carpetas. Marketing solo ve difusión. | borrador |

## Carpetas y expediente del paciente

| # | Pantalla | Ruta | Roles | Qué es | Recorrido |
|---|---|---|---|---|---|
| 3 | Carpetas | `/carpetas` | A T | Listado y búsqueda de carpetas con filtros por clasificación, estado y ciudad de residencia. | borrador |
| 4 | Registrar paciente | `/carpetas/nueva` | A | Formulario para registrar un paciente y abrir su carpeta. | borrador |
| 5 | Carpeta del paciente | `/carpetas/:id` | A T | Resumen de la carpeta: datos del paciente, terapeuta asignada, clasificación y estado; acceso a los apartados del expediente. | borrador |
| 6 | Origen y consentimiento | `/carpetas/:id/constancia` | A T | Tipo de ingreso, procedencia y constancia de consentimiento; contexto judicial si el caso es derivado. | pendiente |
| 7 | Ficha de diagnóstico | `/carpetas/:id/diagnostico` | A T | Evaluación inicial y diagnóstico de ingreso (opcional) del caso. | borrador |
| 8 | Composición familiar | `/carpetas/:id/familia` | A T | Registro y edición de los integrantes de la familia. | borrador |
| 9 | Genograma | `/carpetas/:id/genograma` | A T | Ver, ampliar, descargar y subir el genograma exportado de GenoPro (PDF, PNG o JPEG). No se dibuja aquí. | borrador |
| 10 | Sesiones y tareas | `/carpetas/:id/sesiones` | A T | Lista de sesiones del caso por fecha. | borrador |
| 11 | Registrar sesión | `/carpetas/:id/sesiones/nueva` | A T | Formulario de una sesión nueva con su seguimiento (fecha y evolución). | borrador |
| 12 | Sesión | `/carpetas/:id/sesiones/:sesionId` | A T | Detalle de una sesión y sus tareas terapéuticas. | borrador |
| 13 | Historial clínico | `/carpetas/:id/historial` | A T | Vista de lectura de todo el caso: identificación, constancia, diagnóstico, sesiones y, para administración, pagos. | borrador |
| 14 | Pagos | `/carpetas/:id/pagos` | A | Pagos del caso: uno por sesión, en Bs, por QR o transferencia. | borrador |
| 15 | Informes | `/carpetas/:id/informes` | T | Elegir plantilla y datos para generar el borrador de un informe. | pendiente |
| 16 | Informe | `/carpetas/:id/informes/:versionId` | T | Previsualizar, corregir y marcar como revisado un borrador; el revisado se puede exportar. | pendiente |
| 17 | Categorías de investigación del caso | `/carpetas/:id/investigacion` | A T | Asignar categorías de investigación al caso, a su diagnóstico o a una sesión. | pendiente |

## Investigación

| # | Pantalla | Ruta | Roles | Qué es | Recorrido |
|---|---|---|---|---|---|
| 18 | Investigación | `/investigacion` | A T | Catálogo de categorías, selección de casos y preparación del paquete para Atlas.ti. | pendiente |
| 19 | Revisar paquete para Atlas.ti | `/investigacion/exportaciones/:id` | A T | Revisión del paquete antes de descargarlo. | pendiente |

## Difusión

| # | Pantalla | Ruta | Roles | Qué es | Recorrido |
|---|---|---|---|---|---|
| 20 | Difusión | `/difusion` | A M | Listado de publicaciones (campañas, actividades y cursos) con filtros. | borrador |
| 21 | Nueva publicación | `/difusion/nueva` | A M | Crear una publicación; queda en borrador. | pendiente |
| 22 | Publicación | `/difusion/:id` | A M | Editar, publicar, retirar y gestionar la imagen de una publicación. | pendiente |

## Administración

| # | Pantalla | Ruta | Roles | Qué es | Recorrido |
|---|---|---|---|---|---|
| 23 | Importar registros históricos | `/importaciones` | A | Paso 1 del asistente: subir el archivo; el sistema lo valida y muestra una vista previa. | pendiente |
| 24 | Lote de importación | `/importaciones/:id` | A | Pasos 2 y 3: revisar cada fila (decidir, corregir) y confirmar la importación. | pendiente |
| 25 | Indicadores | `/indicadores` | A | Casos actuales y por estado, sesiones y pagos del período elegido, desglose por ciudad. | pendiente |
| 26 | Cuentas del personal | `/usuarios` | A | Listado y formulario de cuentas del personal. | pendiente |

## Portal público (sin cuenta)

| # | Pantalla | Ruta | Roles | Qué es | Recorrido |
|---|---|---|---|---|---|
| 27 | Fundación | `/fundacion` | público | Presentación, servicios y contacto de la Fundación. | no aplica |
| 28 | Publicaciones | `/publicaciones` | público | Campañas, actividades y cursos publicados. | no aplica |
| 29 | Detalle de publicación | `/publicaciones/:id` | público | Una publicación abierta. | no aplica |

## Avisos (sin recorrido)

| Pantalla | Cuándo aparece |
|---|---|
| Página no encontrada | Ruta interna o pública inexistente. |
| Sin permiso | El rol no puede ver esa pantalla. |
