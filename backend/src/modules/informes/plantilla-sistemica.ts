import { contextoFamiliar, seguimientoSeleccionado } from './contenido-contexto.js';
import type { EntradaBorrador } from './informe-borrador.js';
import type { FotografiaInforme } from './informe-fotografia.js';

export function definirPlantillaSistemica(
  origen: Readonly<FotografiaInforme>,
): Omit<EntradaBorrador<FotografiaInforme>, 'origen'> {
  return {
    tipo: 'intervencion_sistemica',
    versionPlantilla: 'fe151-sistemica-v3',
    comprobaciones: [
      {
        campo: 'paciente.nombreCompleto',
        presente: Boolean(origen.paciente.nombreCompleto.trim()),
      },
    ],
    generarSecciones: ({ paciente, responsable, diagnostico, sesiones, familia }) => {
      const evaluacion = [
        diagnostico.evaluacionInicial,
        diagnostico.diagnosticoIngreso,
        diagnostico.hipotesisRelacional,
      ].filter((texto) => texto?.trim()).join('\n');

      const seguimiento = seguimientoSeleccionado(sesiones);

      return [
        { titulo: 'Identificación', contenido: paciente.nombreCompleto },
        {
          titulo: 'Profesional responsable',
          contenido: responsable?.nombreCompleto ?? 'Sin responsable registrado.',
        },
        ...contextoFamiliar(familia),
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