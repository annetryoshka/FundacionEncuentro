# FE-196 · Acta técnica de aceptación del Sprint 3

Andrea Carolina Narváez Ortega · corte 26/11/2026. Base de backend `18ae1cf` y ampliaciones FE-124/146/162 de esta entrega, identificadas en los commits del PR correspondiente.

## Dictamen

Se entrega la revisión de las 13 HU vigentes: comportamiento comprobado, límites, aceptación técnica o devolución y trabajo faltante. **El incremento completo todavía no puede declararse terminado:** faltan gastos, la gestión/lectura de artículos públicos y la inserción gráfica del genograma en exportaciones. Las validaciones externas restantes se identifican por separado. HU4 y sus cinco subtareas están retiradas.

Esta acta cumple la revisión y definición de cierre de FE-196; no sustituye el cierre del incremento FE-119 ni la validación de la Fundación.

## Evidencia ejecutada y alcance

| Verificación | Resultado y entorno |
|---|---|
| Frontend final | Compilación y lint completados; **34 archivos, 285 pruebas aprobadas**. API simulada en pruebas de interfaz. |
| Backend actual: logout | Compilación y **23 pruebas HTTP aprobadas**, con dobles de proveedor y base para fallos controlados. |
| Backend de la base integrada | **279 unitarias y 413 de integración aprobadas, 0 fallos y 13 omitidas** en `18ae1cf`, según [evidencia](evaluacion-inicial.md). No cambió el backend en esta ampliación de Andrea; se reutiliza esa ejecución identificada. |
| Supabase real de Emilia | **12/12** en `b608d59`, [FE-193 y JSON](logout-supabase.md); código Auth/guards conservado. No ejecutado de nuevo por Andrea. |
| Chromium de escritorio y móvil emulado | **16 comprobaciones por tamaño** con API simulada y datos ficticios, sin errores JavaScript ni desborde horizontal de documento en las vistas verificadas. [JSON](aceptacion-andrea/navegador-resultados.json). |

El navegador recorrió portal público, contacto, navegación, resumen familiar y edad/ocupación, cancelación familiar, genograma vacío, evaluación sin diagnóstico/recarga, borrador/revisión de informe, vista previa/revisión requerida de investigación, logout/Atrás/recarga, revisión de importación, bloqueo por errores y exclusión/confirmación. La tabla móvil tiene su propia región desplazable. Las capturas son [portal móvil](aceptacion-andrea/portal-movil.png) y [resumen de escritorio](aceptacion-andrea/resumen-familiar-escritorio.png).

## Resultado por HU

| HU | Resultado técnico y evidencia | Decisión de cierre del producto |
|---|---|---|
| FE-110 · Familia y ficha | API/familia/lectura histórica y resumen completo, pruebas de FE-128, FE-124 y navegador. Evaluación requerida y diagnóstico opcional. | Aceptación técnica del comportamiento. FE-123 conserva cotejo externo de ficha de referencia. |
| FE-17 · GenoPro/genograma | Carga/descarga privada y visor de PDF/PNG/JPEG, límite 5 MiB; suites HTTP/PostgreSQL e interfaz. Navegador verificó ausencia. | Aceptación técnica del visor. FE-129 sigue pendiente de versión y muestra salida de la instalación de GenoPro. |
| FE-111 · Residencia | Catálogo, filtros combinados y conteos según residencia actual del paciente; suites de residencia y carpetas/indicadores. | Aceptación técnica del alcance actual. No se certifican estadísticas por residencia histórica. |
| FE-112 · Gestión de difusión | Ciclo crear/editar/publicar/retirar, roles, conflicto y API pública separados; suites de difusión. | Aceptación técnica. Cada contenido real adicional conserva su autorización propia. |
| FE-113 · Portal público | Listado/detalle de publicaciones; `/fundacion` con descripción, servicio y contacto autorizados. 16 pruebas específicas y navegador. | Aceptación técnica del contenido autorizado y la navegación. |
| FE-15 · Informes sistémico/judicial | Generación/revisión/versiones, mínimos actuales y ausencia de conclusiones inventadas; suite de informes y navegador. | Técnicamente operativo. FE-151 conserva validación externa de las dos estructuras institucionales. |
| FE-114 · PDF y Word | Generación/descarga real en PostgreSQL local y texto/tablas OpenXML editables. | **Devuelta por alcance parcial:** no incrusta el genograma y falta cotejo visual final en Word/PDF con varias páginas. FE-156 y FE-158/159/160/161 deben registrar la solución/evidencia que corresponda. |
| FE-9 · Importación histórica | CSV/XLSX normalizado, revisión/corrección/decisiones y confirmación transaccional/idempotente; suites de API y 13 de interfaz, más navegador. | Aceptación técnica del formato normalizado. El contraste de un archivo real autorizado de la Fundación sigue en FE-162. |
| FE-115 · Investigación | Catálogo, permisos, selección, DOCX/TXT, revisión previa y huella contra cambios; suites de investigación y navegador. | Técnicamente operativo. FE-167 conserva catálogo/perfiles reales y prueba en ATLAS.ti instalado. |
| FE-5 · Gastos | Contrato FE-172 con internet, electricidad, alquiler y otros; no hay API/pantalla integrada. | **No aceptada:** implementar FE-173/174/175/176 y ejecutar ejemplo 1700 → 1705 → 1585 Bs. |
| FE-116 · Artículos públicos | Alcance ratificado por la PO: artículos sin comentarios. Componentes visuales parciales; no hay flujo/API integrada. | **No aceptada:** completar FE-183 a FE-187 conforme al alcance reducido, sin añadir moderación de comentarios. |
| FE-117 · Consentimiento/pagos | Pago único, QR/transferencia y atención con constancia pendiente ratificados por la Fundación según Andrea. Regresión existente de constancia/pagos aprobada. | Aceptación técnica de esas tres reglas. FE-188 conserva los detalles no confirmados sin imponer reglas nuevas. |
| FE-118 · Logout | Contrato corregido y hallazgos revisados en [FE-194](FE-194-aceptacion-logout.md). | Aceptación técnica del contrato; comprobaciones de entorno real conservan su alcance declarado. |

## Para completar Sprint 3

1. Integrar gastos básicos y artículos públicos sin comentarios. Son alcance funcional pendiente del Sprint 3; no se trasladan automáticamente al Sprint 4.
2. Resolver y verificar la inserción gráfica del genograma en exportaciones y su legibilidad. Mantener lectura de genograma en la ficha, que ya está integrada.
3. Contrastar ficha de referencia, plantillas, archivo histórico, versión/muestra GenoPro y paquete de ATLAS.ti; dejar evidencia o una decisión explícita de aceptación del alcance entregado.
4. Aplicar migración 021 después de la 020 en Supabase antes de iniciar la API actualizada; comprobar la configuración del directorio privado de exportaciones. No se modificó la base compartida desde esta sesión.

## Mejoras para Sprint 4

- Recuperación/trazabilidad de auditoría cuando la revocación remota tiene éxito y la escritura local falla.
- Medición de carga y disponibilidad, reducción del bundle frontend (compila con advertencia por superar 500 kB), otros navegadores y recorrido con Supabase desde navegador.
- Ensayo de restauración que cubra SQL, bytes privados de genograma y archivos de exportación; no declarar RPO/RTO por pasar pruebas funcionales.
- Revisión de permisos, configuración de despliegue, accesibilidad y calidad, conservando las evidencias de esta entrega.

No se registran horas, firmas, reuniones, validaciones clínicas ni aceptación de la Fundación que no estén acreditadas. Los resultados técnicos positivos no cierran las HU con faltantes expresos de esta matriz.
