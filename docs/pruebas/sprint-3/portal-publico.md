# FE-150 — Verificar navegación pública en móvil y escritorio

- **Historia:** FE-113, consultar servicios y publicaciones desde el portal público.
- **Base probada:** `main` integrado (`6baa8c5`), en la rama `feature/FE-150-verificacion-portal`. Incluye la página institucional de Andrea (FE-146), el contenido revisado por Gemina (FE-147), sus tarjetas y listado (FE-148) y las rutas públicas de Jorge (FE-149).
- **Trazabilidad:** N-18 (visitante público).
- **Responsable QA:** Emilia Crespo.
- **Fecha de ejecución:** 2026-11-27 (America/La_Paz) · Node v22.20.0
- **Resultado global:** 8/8 pruebas QA nuevas; 53/53 pruebas del portal y de difusión; recorrido manual en escritorio (1280 px) y móvil (375 px) aprobado. Sin defectos.

## 1. Alcance

| Qué | Cómo |
|---|---|
| Navegación sin sesión, contactos, detalle, vacío y error, teclado y ausencia de contenido privado (lo que pide FE-150) | `frontend/src/features/publico/PortalQA.test.tsx` (QA, 8 casos) |
| Lo ya cubierto por el equipo | `Publicaciones.test.tsx` (14), `Fundacion.test.tsx` (2), `Investigaciones.test.tsx` (7), `Difusion.test.tsx` (15) y `DifusionQA.test.tsx` (7) |
| Diseño, tamaños de pantalla y teclado real | Navegador integrado, modo simulado, sin sesión |

La API pública de publicaciones ya se verificó por HTTP en FE-145 (`difusion.md`: portal de solo lectura, campos públicos y separación clínica).

## 2. Cómo ejecutar

```powershell
cd frontend
npx vitest run src/features/publico src/features/difusion
```

## 3. Matriz (pruebas automáticas)

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| P1 | Teclado: primer Tab | "Saltar al contenido" recibe el foco y apunta a `#contenido`, que es el `<main>` | Aprobado |
| P2 | Teclado: orden de la cabecera | Logo, Fundación, Publicaciones e Ingreso del personal, en ese orden | Aprobado |
| P3 | Menú del portal | Solo Fundación, Publicaciones e Ingreso del personal; ninguna sección del personal (Carpetas, Indicadores, Difusión, Importación, Gastos) ni "Cerrar sesión" | Aprobado |
| P4 | Listado → detalle → volver | El detalle se abre y "Ver todas las publicaciones" regresa; ninguna llamada a rutas privadas | Aprobado |
| P5 | Contacto | Enlace `tel:` real en el pie; la página Fundación muestra el teléfono autorizado | Aprobado |
| P6 | Borrador por URL | "Esta publicación no está disponible", sin revelar que es un borrador | Aprobado |
| P7 | Página fuera de rango (`?pagina=999`) | El listado no se rompe ni muestra error | Aprobado |
| P8 | "Ingreso del personal" | Lleva al login sin abrir sesión | Aprobado |

## 4. Recorrido manual

| Paso | Escritorio (1280 px) | Móvil (375 px) |
|---|---|---|
| `/publicaciones` sin sesión: título, categorías y tarjetas legibles | Aprobado | Aprobado; sin desplazamiento horizontal (ancho 375 = 375) |
| Tab → "Saltar al contenido" visible al recibir el foco; Enter y Tab llevan al primer control del contenido ("Todas") | Aprobado | — |
| Detalle de una campaña: fecha, modalidad, lugar y botón de contacto | — | Aprobado; sin desplazamiento horizontal |
| `/fundacion`: presentación, servicio, contacto y botón hacia las publicaciones | — | Aprobado; `tel:+59177263336` en la página y en el pie |
| Ningún dato de pacientes, borradores ni navegación clínica | Aprobado | Aprobado |

## 5. Observaciones (no bloquean)

1. **En móvil no aparece el enlace "Publicaciones" en la cabecera** (`hidden sm:inline-block` en `PlantillaPublica.tsx`). Se puede volver por el logo y por el botón "Conocer campañas, actividades y cursos" de la página Fundación, pero un visitante podría no descubrirlo. Sugerencia: mostrar el enlace también en pantallas chicas.
2. Las **investigaciones públicas** todavía no tienen sección en el portal: la API ya existe (FE-184), pero la pantalla es de FE-187 (pendiente). No forma parte de FE-150.
3. Todo se probó en modo simulado; la API real del portal ya está cubierta en FE-145.

## 6. Cierre

- [x] Pruebas automáticas: 8/8 QA y 53/53 del portal y difusión (2026-11-27).
- [x] Recorrido en escritorio y móvil.
