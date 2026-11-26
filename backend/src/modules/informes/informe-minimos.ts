import { UnprocessableEntityException } from '@nestjs/common';

type ComprobacionInforme = {
  campo: string;
  presente: boolean;
};

export function validarMinimosInforme(
  comprobaciones: readonly ComprobacionInforme[],
): void {
  const camposFaltantes = comprobaciones
    .filter(({ presente }) => !presente)
    .map(({ campo }) => campo);

  if (camposFaltantes.length > 0) {
    throw new UnprocessableEntityException({
      codigo: 'INFORME_DATOS_INSUFICIENTES',
      message: 'Faltan datos para generar el informe.',
      camposFaltantes,
    });
  }
}