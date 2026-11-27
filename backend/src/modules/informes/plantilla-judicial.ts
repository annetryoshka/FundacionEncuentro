import { contextoFamiliar, seguimientoSeleccionado } from './contenido-contexto.js';
import type { EntradaBorrador } from './informe-borrador.js';
import type { FotografiaInforme } from './informe-fotografia.js';

export function definirPlantillaJudicial(
  origen: Readonly<FotografiaInforme>,
  objeto?: string,
): Omit<EntradaBorrador<FotografiaInforme>, 'origen'> {
  const juzgado = origen.judicial?.juzgado?.trim() ?? '';
  const objetoInforme = objeto?.trim() ?? '';

  return {
    tipo: 'judicial',
    versionPlantilla: 'fe151-judicial-v3',
    comprobaciones: [
      { campo: 'paciente.nombreCompleto', presente: Boolean(origen.paciente.nombreCompleto.trim()) },
      { campo: 'judicial.juzgado', presente: Boolean(juzgado) },
      { campo: 'objeto', presente: Boolean(objetoInforme) },
    ],
    generarSecciones: ({ paciente, responsable, judicial, sesiones, diagnostico, familia }) => {
      const seguimiento = seguimientoSeleccionado(sesiones);

      return [
        { titulo: 'Destinatario', contenido: juzgado },
        {
          titulo: 'Referencia de expediente',
          contenido: judicial?.nroExpediente?.trim() || 'Sin referencia registrada.',
        },
        { titulo: 'Identificación', contenido: paciente.nombreCompleto },
        {
          titulo: 'Profesional responsable',
          contenido: responsable?.nombreCompleto ?? 'Sin responsable registrado.',
        },
        ...contextoFamiliar(familia),
        { titulo: 'Objeto del informe', contenido: objetoInforme },
        ...(diagnostico.evaluacionInicial
          ? [{ titulo: 'Evaluación inicial', contenido: diagnostico.evaluacionInicial }]
          : []),
        {
          titulo: 'Intervención y observaciones',
          contenido: seguimiento || 'Sin sesiones seleccionadas.',
        },
        { titulo: 'Conclusiones', contenido: 'Pendiente de redacción profesional.' },
      ];
    },
  };
}