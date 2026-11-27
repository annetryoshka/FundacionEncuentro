# Instrucciones para agentes

## Recorridos guiados (botón «?»)

Algunas pantallas internas tienen un recorrido guiado para el personal, pensado para personas mayores. Lista y estado: `docs/manuales/recorridos-pantallas.md`. Pasos: `frontend/src/features/recorridos/recorridos.ts`.

**Si cambias una pantalla que tiene recorrido, actualiza su recorrido en el mismo cambio.** Las pantallas cambian y el recorrido deja de coincidir sin avisar. Al tocar una de esas pantallas:

1. Revisa sus pasos en `recorridos.ts`: que los textos nombren los botones, campos y secciones tal como se ven ahora («Guardar sesión», «Registrar pago», etc.) y que el orden siga el de la pantalla.
2. Conserva las marcas `data-recorrido="…"`. Si mueves, renombras o quitas un elemento marcado, mueve la marca o cambia el paso.
3. Si la pantalla gana o pierde algo importante, agrega o quita el paso.
4. Corre `npx vitest run src/features/recorridos` en `frontend/`. Falla si un paso apunta a una marca que ya no existe o si una ruta de `App.tsx` falta en `RECORRIDOS`. No detecta textos desactualizados: eso hay que leerlo.
5. Comprueba el recorrido en el navegador (`npm run dev:simulado`, botón «?» abajo a la derecha).

Una pantalla nueva en `App.tsx` se agrega a `RECORRIDOS` (con `null` si aún no tiene recorrido; el botón «?» no aparece en esas pantallas).

Al escribir pasos nuevos: 3 a 7 pasos por pantalla, una idea por paso, frases cortas y concretas, tuteo como el resto de la interfaz, sin jerga técnica. El primer paso, sin elemento, dice para qué sirve la pantalla. Al terminar, marca la pantalla como «borrador» en el inventario hasta que la Fundación valide el texto.
