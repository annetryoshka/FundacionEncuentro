import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CasosModule } from './modules/casos/casos.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { IndicadoresModule } from './modules/indicadores/indicadores.module.js';
import { ExportacionesModule } from './modules/exportaciones/exportaciones.module.js';
import { ImportacionModule } from './modules/importacion/importacion.module.js';
import { InformesModule } from './modules/informes/informes.module.js';

import { DifusionModule } from './modules/difusion/difusion.module.js';

import { InvestigacionModule } from './modules/investigacion/investigacion.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    DatabaseModule,
    AuthModule,
    UsuariosModule,
    CasosModule,
    IndicadoresModule,
    ExportacionesModule,
    ImportacionModule,
    InformesModule,

    DifusionModule,

    InvestigacionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
