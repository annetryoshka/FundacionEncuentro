import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

const { Pool } = pg;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: InstanceType<typeof Pool>;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('DATABASE_URL');
    const esLocal = /@(localhost|127\.0\.0\.1)/.test(url);

    this.pool = new Pool({
      connectionString: url,
      ssl: esLocal ? false : { rejectUnauthorized: false },
      max: 10,
    });

    this.pool.on('error', (err) => {
      this.logger.error(`Error inesperado en el pool de la base: ${err.message}`);
    });
  }

  /** Consulta simple */
  query<T extends QueryResultRow = any>(
    texto: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(texto, params);
  }

  async transaction<T>(
    usuarioId: string | null,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`select set_config('app.usuario_id', $1, true)`, [
        usuarioId ?? '',
      ]);
      const resultado = await fn(client);
      await client.query('COMMIT');
      return resultado;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
