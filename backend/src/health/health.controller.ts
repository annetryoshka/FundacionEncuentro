import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { DatabaseService } from '../database/database.service.js';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async comprobar() {
    try {
      const { rows } = await this.db.query<{ hora: Date }>('select now() as hora');
      return { estado: 'ok', baseDeDatos: 'conectada', hora: rows[0].hora };
    } catch (error) {
      this.logger.error(`No se pudo conectar a la base: ${(error as Error).message}`);
      throw new ServiceUnavailableException({
        estado: 'error',
        baseDeDatos: 'sin conexion',
      });
    }
  }
}
