import {
  BadRequestException, Injectable, InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { ConsultarIndicadoresQuery } from './dto/consultar-indicadores.query.js';

interface FilaIndicadores {
  casos_actuales: number;
  casos_iniciados: number;
  casos_en_proceso: number;
  casos_concluidos: number;
  sesiones: number;
  pagos_recibidos: string;
}

@Injectable()
export class IndicadoresService {
  constructor(private readonly db: DatabaseService) {}

  async consultar(filtros: ConsultarIndicadoresQuery) {
    const { desde, hasta } = filtros;

    if (desde > hasta) {
      throw new BadRequestException(
        'La fecha desde no puede ser posterior a hasta',
      );
    }

    const { rows } = await this.db.query<FilaIndicadores>(
      `select casos_actuales, casos_iniciados,
              casos_en_proceso, casos_concluidos, sesiones,
              round(pagos_recibidos, 2)::text as pagos_recibidos
         from public.indicadores_operativos($1::date, $2::date)`,
      [desde, hasta],
    );

    if (!rows[0]) {
      throw new InternalServerErrorException(
        'No se pudieron obtener los indicadores',
      );
    }

    const fila = rows[0];

    return {
      periodo: { desde, hasta },
      casosActuales: fila.casos_actuales,
      casosPorEstado: {
        iniciado: fila.casos_iniciados,
        en_proceso: fila.casos_en_proceso,
        concluido: fila.casos_concluidos,
      },
      sesiones: fila.sesiones,
      pagosRecibidos: {
        monto: fila.pagos_recibidos,
        moneda: 'BOB',
      },
    };
  }
}