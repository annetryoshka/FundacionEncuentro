import { Module } from '@nestjs/common';
import { SupabaseAdminClient } from './supabase-admin.client.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, SupabaseAdminClient],
})
export class UsuariosModule {}
