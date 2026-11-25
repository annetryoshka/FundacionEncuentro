import type { EntradaBorrador } from './informe-borrador.js';
import type { FotografiaInforme } from './informe-fotografia.js';

export function definirPlantillaSistemica(
  origen: Readonly<FotografiaInforme>,
): Omit<EntradaBorrador<FotografiaInforme>, 'origen'> {
  return {
    tipo: 'intervencion_sistemica',
    versionPlantilla: 'fe151-sistemica-v1',
    comprobaciones: [
      {
        campo: 'paciente.nombreCompleto',
        presente: Boolean(origen.paciente.nombreCompleto.trim()),
      },
    ],
    generarSecciones: ({ paciente, responsable, diagnostico, sesiones }) => {
      const evaluacion = [
        diagnostico.diagnosticoIngreso,
        diagnostico.hipotesisRelacional,
      ].filter((texto) => texto?.trim()).join('\n');

      const seguimiento = sesiones.map(({ fecha, nroSesion, evolucion }) =>
        `${fecha} · Sesión ${nroSesion}\n${evolucion?.trim() || 'Sin evolución registrada.'}`,
      ).join('\n\n');

      return [
        { titulo: 'Identificación', contenido: paciente.nombreCompleto },
        {
          titulo: 'Profesional responsable',
          contenido: responsable?.nombreCompleto ?? 'Sin responsable registrado.',
        },
        { titulo: 'Evaluación', contenido: evaluacion || 'Sin datos registrados.' },
        { titulo: 'Intervención y evolución', contenido: seguimiento || 'Sin sesiones seleccionadas.' },
        {
          titulo: 'Conclusiones y recomendaciones',
          contenido: 'Pendiente de redacción profesional.',
        },
      ];
    },
  };
}