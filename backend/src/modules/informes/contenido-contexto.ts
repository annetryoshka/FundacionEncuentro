import type { FotografiaInforme } from './informe-fotografia.js';

/** Solo representa los datos guardados en la fotografía seleccionada. */
export function contextoFamiliar(familia: FotografiaInforme['familia']) {
  if (!familia) return [];
  const contenido = !familia.registrada ? 'Sin ficha familiar registrada.'
    : !familia.integrantes?.length ? 'Ficha familiar sin integrantes registrados.'
    : familia.integrantes.map((f) => [
      f.parentescoDetalle?.trim() || f.parentesco.replaceAll('_', ' '),
      f.nombreCompleto?.trim() || 'Nombre no registrado',
      f.fechaNacimiento ? `Nacimiento: ${f.fechaNacimiento}`
        : f.edadReferida != null ? `${f.edadReferida} años al ${f.fechaReferencia ?? 'momento no registrado'} (edad referida)` : 'Edad no registrada',
      f.ocupacion?.trim(), f.lugarTrabajoEstudio?.trim(),
    ].filter(Boolean).join(' · ')).join('\n');
  return [{ titulo: 'Contexto familiar', contenido }];
}

export function seguimientoSeleccionado(sesiones: FotografiaInforme['sesiones']) {
  return sesiones.map(({ fecha, nroSesion, evolucion, tareas }) => [
    `${fecha} · Sesión ${nroSesion}`,
    evolucion?.trim() || 'Sin evolución registrada.',
    ...(tareas?.length ? ['Tareas terapéuticas:', ...tareas.map((t) => `• ${t.descripcion}`)] : []),
  ].join('\n')).join('\n\n');
}
