import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { DatabaseService } from '../database/database.service.js';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Verificar estado del sistema',
    description:
      'Comprueba que el backend puede conectarse a la base de datos PostgreSQL. No requiere autenticación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sistema funcionando correctamente.',
    schema: {
      example: {
        estado: 'ok',
        baseDeDatos: 'conectada',
        hora: '2026-10-23T14:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'No se pudo establecer conexión con la base de datos.',
    schema: {
      example: {
        estado: 'error',
        baseDeDatos: 'sin conexion',
      },
    },
  })
  async comprobar() {
    try {
      const { rows } = await this.db.query<{ hora: Date }>(
        'select now() as hora',
      );

      return {
        estado: 'ok',
        baseDeDatos: 'conectada',
        hora: rows[0].hora,
      };
    } catch (error) {
      this.logger.error(
        `No se pudo conectar a la base: ${(error as Error).message}`,
      );

      throw new ServiceUnavailableException({
        estado: 'error',
        baseDeDatos: 'sin conexion',
      });
    }
  }
}