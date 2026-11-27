# FE-191 — Repetir escenarios de constancia, pagos y conciliación

- **Historia:** FE-117, aplicar reglas definitivas de consentimiento y pagos del caso.
- **Base probada:** `main` integrado (`7e67568`), en la rama `feature/FE-191-verificacion-constancia-pagos`. Incluye FE-189 (Adriana, PR #78) y FE-190 (Jorge, PR #101).
- **Referencia:** `docs/srs/sprint-3/FE-188-decisiones-consentimiento-pagos.md` (sección 4 de aceptación y reglas ratificadas el 26/11/2026).
- **Responsable QA:** Emilia Crespo.
- **Fecha de ejecución:** 2026-11-27 (America/La_Paz) · **Commit probado:** `7e67568` · PostgreSQL 17 local, Node v22.20.0
- **Resultado global:** API 9/9 (8,4 s); interfaz 17/17. Sin defectos.

## 1. Reglas que se verifican

| Regla | Estado según FE-188 |
|---|---|
| Atención con consentimiento pendiente (DEC-C02) | **Ratificada**: no se bloquea la atención |
| Un pago por sesión, sin cuotas (DEC-P01) | **Ratificada** |
| Solo QR o transferencia; sin efectivo (DEC-P02) | **Ratificada** |
| Evidencia admitida, No aplica, alcance familiar, edición clínica y corrección de pagos (DEC-C01/C03/C04/C05/P03) | Pendientes, pasan a FE-211 (Sprint 4). Se prueba el contrato vigente, **sin** presentarlo como regla aprobada. |

## 2. Cómo ejecutar

Requisito previo: los roles `anon` y `authenticated` ya no hacen falta (la 012 está corregida). Si el build falla con `Cannot find module`, correr `npm ci`.

```powershell
cd backend
npm run build
$env:FE_PG_QA = '1'; $env:FE_PG_ADMIN_URL = 'postgres://postgres:<tu-clave>@localhost:5432/postgres'
node --test --test-force-exit test/constancia-pagos-qa-postgres.test.mjs
Remove-Item Env:FE_PG_QA, Env:FE_PG_ADMIN_URL
cd ..\frontend
npx vitest run src/features/expediente/Constancia.test.tsx src/features/expediente/Pagos.test.tsx
```

## 3. Matriz (API, `backend/test/constancia-pagos-qa-postgres.test.mjs`)

| # | Escenario | Esperado | Observado | Resultado |
|---|---|---|---|---|
| C1 | Consentimiento **pendiente** y registro de sesiones | Las sesiones se registran (201); la constancia sigue "pendiente" | Sesiones 201; constancia sigue pendiente | Aprobado |
| C2 | 9 combinaciones inválidas (pendiente con fecha o evidencia, registrada sin evidencia, fecha imposible, explicación en registrada, no aplica sin explicación o con fecha, judicial sin juzgado, estado desconocido) | 400 y la constancia anterior queda igual | 9/9 con 400; constancia anterior intacta | Aprobado |
| C3 | No aplica válido, judicial con contexto y terapeuta ajena | Se guardan y recargan; la terapeuta ajena no obtiene la constancia | Guardadas y recargadas; ajena sin acceso | Aprobado |
| P1 | Pago y reintento idéntico | Un solo pago; el reintento devuelve el mismo con `reutilizado: true` | Un pago; reintento reutilizado=true | Aprobado |
| P2 | Misma sesión con otro monto, método, fecha o referencia | 409, sin reemplazar ni duplicar | 4/4 con 409; sin cambios | Aprobado |
| P3 | Efectivo, tarjeta, "QR" en mayúsculas o vacío | 400; transferencia válida se acepta | 4/4 con 400; transferencia aceptada | Aprobado |
| P4 | Monto cero, negativo, tres decimales, coma, número; fecha imposible; sesión de otro caso o inexistente; moneda o autor enviados por el cliente | Rechazo sin escritura | Todos rechazados; 0 escrituras | Aprobado |
| P5 | Permisos | Terapeuta y marketing: 403 al ver y registrar pagos; el historial de la terapeuta no trae montos | 403 en ver y registrar; historial sin montos | Aprobado |
| K1 | **Conciliación** | La suma de la lista de pagos (75,50 + 100,00 = 175,50) es igual al total de indicadores del período; un reintento no lo duplica; fuera del período, 0,00 | 175,50 = 175,50; reintento sin duplicar; 0,00 fuera del período | Aprobado |

## 4. Interfaz (FE-190)

`Constancia.test.tsx` y `Pagos.test.tsx`: **17/17** en verde el 2026-11-27. Incluyen los casos nuevos de FE-190: con el consentimiento pendiente la pantalla avisa que la atención continúa y deja registrar sesiones; Pagos explica las reglas ratificadas (un pago completo por sesión, solo QR o transferencia) y un 409 se explica sin duplicar. No hizo falta agregar pruebas de interfaz.

## 5. Hallazgos

No se encontraron defectos. Las tres reglas ratificadas (atención con consentimiento pendiente, un pago por sesión y solo QR o transferencia) se cumplen por la API y en la interfaz, y la conciliación coincide exactamente con los pagos registrados. Las reglas DEC-C01/C03/C04/C05/P03 siguen pendientes en FE-211 (Sprint 4).

## 6. Cierre

- [x] Suite de API ejecutada; resultados en la matriz (9/9, 2026-11-27).
- [x] Interfaz: 17/17 (2026-11-27).
