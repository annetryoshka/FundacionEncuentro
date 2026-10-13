import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SupabaseAuthClient } from './supabase-auth.client.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SupabaseAuthClient,
    // Protege TODA la API por defecto.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, SupabaseAuthClient],
})
export class AuthModule {}
