import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  /** Sirve para comprobar que la API arrancó y que llega a la base de datos. */
  @Get()
  async comprobar() {
    try {
      const { rows } = await this.db.query<{ hora: Date }>('select now() as hora');
      return { estado: 'ok', baseDeDatos: 'conectada', hora: rows[0].hora };
    } catch {
      throw new ServiceUnavailableException({
        estado: 'error',
        baseDeDatos: 'sin conexion',
      });
    }
  }
}
