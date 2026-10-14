# Fundación Encuentro — Sistema de Gestión Clínica y Administrativa

Proyecto SIS-213 · Grupo 7 · Universidad Católica Boliviana

Sistema web para digitalizar el registro de pacientes, casos, fichas clínicas,
pagos e informes de la Fundación Encuentro.

## Integrantes
- Andrea Narváez
- Adriana Pando
- Jorge Calizaya

## Estructura del repositorio
- `docs/` entrevistas, SRS, trazabilidad y arquitectura
- `modelos/c4/` modelo C4
- `db/` scripts SQL versionados
- `backend/` API NestJS + PostgreSQL (Supabase)
- `frontend/` interfaz web React + Vite + TypeScript
- `docs/api/` contrato entre frontend y backend

## Cómo levantar el backend
1. `cd backend`
2. Copiar `.env.example` como `.env` y llenar los valores
3. `npm install`
4. `npm run start:dev`
5. Verificar en http://localhost:3000/api/health

## Cómo levantar el frontend
1. Con el backend corriendo en el puerto 3000
2. `cd frontend`
3. `npm install`
4. `npm run dev`
5. Abrir http://localhost:5173

Sin backend: `npm run dev:simulado` (API simulada en el navegador). Detalles en `frontend/README.md`.
