import { useId, useState } from 'react'
import { Boton } from '../../../componentes/ui'
import { fechaLarga } from '../../../utilidades/fechas'
import { nombreParentesco, textoEdad, type Familiar } from './familia'

/** FE-124 · Lectura del contexto familiar; no duplica ni modifica los datos del formulario. */
export function ResumenFamilia({ familiares }: { familiares: Familiar[] }) {
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const listaId = useId()
  const visibles = mostrarTodos ? familiares : familiares.slice(0, 4)

  if (familiares.length === 0) return <p className="text-suave">Registrada sin integrantes.</p>

  return (
    <>
      <ul id={listaId} aria-label="Resumen de integrantes de la familia" className="space-y-3">
        {visibles.map((f) => (
          <li key={f.id} className="min-w-0 break-words">
            <span className="font-semibold">{nombreParentesco(f)}</span>
            {f.nombreCompleto ? `: ${f.nombreCompleto}` : ' · Nombre desconocido'}
            <span className="block text-suave">{textoEdad(f, fechaLarga)}</span>
            <dl className="mt-1 text-sm">
              <div>
                <dt className="inline font-medium">Ocupación: </dt>
                <dd className="inline">{f.ocupacion || 'Desconocida'}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Trabajo o estudio: </dt>
                <dd className="inline">{f.lugarTrabajoEstudio || 'Desconocido'}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      {familiares.length > 4 && (
        <Boton
          variante="texto"
          className="mt-2 -ml-2"
          aria-controls={listaId}
          aria-expanded={mostrarTodos}
          onClick={() => setMostrarTodos((anterior) => !anterior)}
        >
          {mostrarTodos ? 'Ver menos integrantes' : `Ver los ${familiares.length} integrantes`}
        </Boton>
      )}
    </>
  )
}
