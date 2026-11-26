/**
 * Estado vacío de un listado público. Es un aviso de estado, no un error: un fallo de carga se
 * muestra aparte con `ErrorDeCarga` y nunca se presenta como lista vacía.
 */
export function VacioPublico({ mensaje }: { mensaje: string }) {
  return (
    <p
      role="status"
      className="rounded-3xl border border-dashed border-linea bg-crema px-6 py-10 text-center text-suave"
    >
      {mensaje}
    </p>
  )
}
