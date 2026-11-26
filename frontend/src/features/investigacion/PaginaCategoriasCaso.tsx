import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { AreaTexto, Aviso, Boton, CampoSeleccion, Cargando, GrupoOpciones, Tarjeta } from '../../componentes/ui'
import { fechaLarga } from '../../utilidades/fechas'
import type { CarpetaDetalle } from '../carpetas/tipos'
import { mensajeNoGuardado } from '../expediente/errores'
import { listarSesiones, obtenerDiagnostico } from '../expediente/expedienteApi'
import { SeccionCarpeta } from '../expediente/SeccionCarpeta'
import { etiquetarCaso, listarCategorias, listarSeleccion } from './investigacion'

type Ambito = 'caso' | 'diagnostico' | 'sesion'

/** FE-170 · Asignar categorías de investigación a un caso: al caso entero, a su diagnóstico o a una sesión. */
export function PaginaCategoriasCaso() {
  return (
    <SeccionCarpeta titulo="Categorías de investigación">
      {(carpeta) => <CategoriasCaso carpeta={carpeta} />}
    </SeccionCarpeta>
  )
}

function CategoriasCaso({ carpeta }: { carpeta: CarpetaDetalle }) {
  const datos = useCarga(
    () =>
      Promise.all([
        listarCategorias(),
        obtenerDiagnostico(carpeta.id),
        listarSesiones(carpeta.id),
        listarSeleccion({ desde: '', hasta: '', residencias: [], categorias: [] }),
      ]),
    [carpeta.id],
  )
  const [categoriaId, setCategoriaId] = useState('')
  const [ambito, setAmbito] = useState<Ambito>('caso')
  const [sesionId, setSesionId] = useState('')
  const [fragmento, setFragmento] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const refMensaje = useRef<HTMLDivElement>(null)

  if (datos.error !== undefined) {
    return (
      <ErrorDeCarga
        error={datos.error}
        alReintentar={datos.recargar}
        contexto="No se pudieron cargar las categorías."
      />
    )
  }
  if (!datos.datos) return <Cargando texto="Cargando categorías…" />
  const [categorias, diagnostico, sesiones, seleccion] = datos.datos
  const activas = categorias.filter((c) => c.activa)
  const asignadas = seleccion.find((c) => c.casoId === carpeta.id)?.categorias ?? []

  const ambitos: { valor: Ambito; nombre: string; descripcion: string }[] = [
    { valor: 'caso', nombre: 'Todo el caso', descripcion: 'La categoría describe el caso en general.' },
    ...(diagnostico
      ? [
          {
            valor: 'diagnostico' as const,
            nombre: 'El diagnóstico',
            descripcion: `Ficha del ${fechaLarga(diagnostico.fecha)}.`,
          },
        ]
      : []),
    ...(sesiones.length
      ? [{ valor: 'sesion' as const, nombre: 'Una sesión', descripcion: 'Un fragmento del seguimiento.' }]
      : []),
  ]

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    setMensaje(null)
    if (!categoriaId) return setError('Elige una categoría.')
    if (ambito === 'sesion' && !sesionId) return setError('Elige la sesión.')
    setError(null)
    setGuardando(true)
    try {
      await etiquetarCaso(carpeta.id, {
        categoriaId,
        ...(ambito === 'diagnostico' && diagnostico ? { fichaDiagnosticoId: diagnostico.id } : {}),
        ...(ambito === 'sesion' ? { fichaSeguimientoId: sesionId } : {}),
        fragmento: fragmento.trim() || null,
        nota: nota.trim() || null,
      })
      setMensaje({ tipo: 'exito', texto: 'Categoría asignada.' })
      setFragmento('')
      setNota('')
      datos.recargar()
    } catch (e) {
      setMensaje({
        tipo: 'error',
        texto:
          e instanceof ErrorApi && e.estado === 409
            ? 'Esa categoría ya está asignada en ese mismo lugar.'
            : mensajeNoGuardado(e),
      })
    } finally {
      setGuardando(false)
      requestAnimationFrame(() => refMensaje.current?.focus())
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Tarjeta>
        <h2 className="font-semibold text-verde-oscuro">Categorías del caso</h2>
        {asignadas.length ? (
          <p className="mt-1">
            {asignadas.map((c) => (
              <code key={c} className="mr-2 font-semibold text-naranja-texto">
                {c}
              </code>
            ))}
          </p>
        ) : (
          <p className="mt-1 text-suave">Este caso todavía no tiene categorías.</p>
        )}
        <Link
          to="/investigacion"
          className="mt-2 inline-block text-sm font-semibold text-naranja-texto underline underline-offset-4"
        >
          Ir a la selección para Atlas.ti
        </Link>
      </Tarjeta>

      {activas.length === 0 ? (
        <Tarjeta>
          <p className="text-suave">No hay categorías activas. La dirección las crea en «Investigación».</p>
        </Tarjeta>
      ) : (
        <Tarjeta>
          <form noValidate onSubmit={guardar}>
            <fieldset disabled={guardando} className="space-y-4">
              <legend className="text-lg font-semibold text-verde-oscuro">Asignar una categoría</legend>
              <CampoSeleccion
                etiqueta="Categoría"
                value={categoriaId}
                error={error === 'Elige una categoría.' ? error : undefined}
                onChange={(e) => setCategoriaId(e.target.value)}
              >
                <option value="">Elige…</option>
                {activas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} · {c.nombre}
                  </option>
                ))}
              </CampoSeleccion>
              <GrupoOpciones
                leyenda="¿A qué se aplica?"
                nombre="ambito-categoria"
                opciones={ambitos}
                valor={ambito}
                alCambiar={setAmbito}
              />
              {ambito === 'sesion' && (
                <CampoSeleccion
                  etiqueta="Sesión"
                  value={sesionId}
                  error={error === 'Elige la sesión.' ? error : undefined}
                  onChange={(e) => setSesionId(e.target.value)}
                >
                  <option value="">Elige…</option>
                  {sesiones.map((s) => (
                    <option key={s.id} value={s.id}>
                      Sesión {s.numero} · {fechaLarga(s.fecha)}
                    </option>
                  ))}
                </CampoSeleccion>
              )}
              {ambito !== 'caso' && (
                <AreaTexto
                  etiqueta="Fragmento (opcional)"
                  rows={2}
                  maxLength={2000}
                  value={fragmento}
                  ayuda="Copia el texto exacto del diagnóstico o de la sesión al que se refiere la categoría."
                  onChange={(e) => setFragmento(e.target.value)}
                />
              )}
              <AreaTexto
                etiqueta="Nota para el análisis (opcional)"
                rows={2}
                maxLength={2000}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              {mensaje && (
                <Aviso ref={refMensaje} tipo={mensaje.tipo}>
                  <p>{mensaje.texto}</p>
                </Aviso>
              )}
              <Boton type="submit" icono="etiqueta" cargando={guardando} textoCargando="Asignando…">
                Asignar categoría
              </Boton>
            </fieldset>
          </form>
        </Tarjeta>
      )}
    </div>
  )
}
