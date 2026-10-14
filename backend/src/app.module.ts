import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    DatabaseModule,
    AuthModule,
    UsuariosModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
