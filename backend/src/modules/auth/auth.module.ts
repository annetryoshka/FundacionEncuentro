import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { RolesGuard } from './roles.guard.js';
import { SupabaseAuthClient } from './supabase-auth.client.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SupabaseAuthClient,
    // Los guards globales corren en este orden:
    // 1) AuthGuard: ¿hay sesión válida?   2) RolesGuard: ¿su rol puede entrar?
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, SupabaseAuthClient],
})
export class AuthModule {}
