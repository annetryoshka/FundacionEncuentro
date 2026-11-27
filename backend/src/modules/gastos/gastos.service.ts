import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import type { GuardarGastoDto } from './dto/guardar-gasto.dto.js';

export type Gasto = {
  id: string;
  fecha: string;
  categoria: string;
  descripcion: string | null;
  monto: string;
  anulado: boolean;
  anuladoEn: string | null;
  anuladoPor: string | null;
  motivoAnulacion: string | null;
  registradoPor: string;
  creadoEn: string;
  actualizadoPor: string | null;
  actualizadoEn: string;
};

const MENSAJES_REGLA: [RegExp, string][] = [
  [/futura/i, 'La fecha del gasto no puede ser futura'],
  [/decimales/i, 'El monto admite hasta dos decimales'],
];

@Injectable()
export class GastosService {
  constructor(private readonly db: DatabaseService) {}

  consultarMes(usuarioId: string, mes?: string) {
    return this.ejecutar(usuarioId, async (client) => {
      const { rows } = await client.query<{ resumen: unknown }>(
        'select public.consultar_gastos_mes($1) as resumen',
        [mes ?? null],
      );
      return rows[0].resumen;
    });
  }

  async registrar(usuarioId: string, dto: GuardarGastoDto) {
    const datos = this.normalizar(dto);
    return this.ejecutar(usuarioId, async (client) => {
      const { rows } = await client.query<{ gasto: Gasto }>(
        `insert into public.movimientos_contables (tipo, categoria, fecha, monto, descripcion)
         values ('egreso', $1, $2, $3, $4)
         returning public.gasto_json(movimientos_contables) as gasto`,
        [datos.categoria, datos.fecha, datos.monto, datos.descripcion],
      );
      return rows[0].gasto;
    });
  }

  async corregir(usuarioId: string, id: string, dto: GuardarGastoDto) {
    const datos = this.normalizar(dto);
    return this.ejecutar(usuarioId, async (client) => {
      const { rows: [actual] } = await client.query<{ anulado: boolean }>(
        `select anulado_en is not null as anulado
           from public.movimientos_contables
          where id = $1 and tipo = 'egreso'
          for update`,
        [id],
      );
      if (!actual) throw new NotFoundException('Gasto no encontrado');
      if (actual.anulado) throw new ConflictException('Un gasto anulado no se modifica');

      const { rows } = await client.query<{ gasto: Gasto }>(
        `update public.movimientos_contables
            set categoria = $2, fecha = $3, monto = $4, descripcion = $5
          where id = $1 and tipo = 'egreso'
          returning public.gasto_json(movimientos_contables) as gasto`,
        [id, datos.categoria, datos.fecha, datos.monto, datos.descripcion],
      );
      return rows[0].gasto;
    });
  }

  anular(usuarioId: string, id: string, motivo?: string | null) {
    return this.ejecutar(usuarioId, async (client) => {
      const { rows } = await client.query<{ gasto: Gasto }>(
        'select public.anular_gasto($1, $2) as gasto',
        [id, motivo?.trim() || null],
      );
      return rows[0].gasto;
    });
  }

  private normalizar(dto: GuardarGastoDto) {
    const descripcion = dto.descripcion?.trim() || null;
    if (dto.categoria === 'otros' && !descripcion) {
      throw new BadRequestException('«Otros gastos» requiere una descripción breve');
    }
    return { categoria: dto.categoria, fecha: dto.fecha, monto: dto.monto, descripcion };
  }

  private async ejecutar<T>(usuarioId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction(usuarioId, fn);
    } catch (error) {
      throw this.traducir(error);
    }
  }

  private traducir(error: unknown): unknown {
    if (!(error instanceof Error) || !('code' in error)) return error;
    const mensaje = error.message;
    switch (error.code) {
      case '42501':
        return new ForbiddenException('Solo administración gestiona los gastos');
      case 'P0002':
        return new NotFoundException('Gasto no encontrado');
      case '22023':
        return new BadRequestException('El mes debe tener formato AAAA-MM');
      case '22008':
        return new BadRequestException('La fecha del gasto no es válida');
      case '23502':
        return new BadRequestException('Faltan datos obligatorios del gasto');
      case '23514': {
        if (/anulado/i.test(mensaje)) return new ConflictException('Un gasto anulado no se modifica');
        const conocido = MENSAJES_REGLA.find(([patron]) => patron.test(mensaje));
        return new BadRequestException(conocido?.[1] ?? 'Revisa el tipo, la fecha, el monto y la descripción del gasto');
      }
      default:
        return error;
    }
  }
}
