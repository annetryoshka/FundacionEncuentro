import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ErrorApi, esEndpointPendiente, mensajeErrorGeneral } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { claseCampo } from '../../componentes/estilos'
import { Aviso, Boton, Cargando, Tarjeta } from '../../componentes/ui'
import { fechaLarga } from '../../utilidades/fechas'
import { listarTerapeutasActivas } from '../usuarios/usuariosApi'
import { asignarTerapeuta } from './carpetasApi'
import type { CarpetaDetalle } from './tipos'

interface Props {
  carpeta: CarpetaDetalle
  puedeAsignar: boolean
  alActualizar: (carpeta: CarpetaDetalle) => void
}

/**
 * FE-36 · Asignación de la terapeuta responsable dentro de la carpeta (historia FE-35).
 * Una responsable por caso: al cambiarla, la anterior pierde el acceso (lo aplica el backend).
 */
export function AsignacionTerapeuta({ carpeta, puedeAsignar, alActualizar }: Props) {
  const actual = carpeta.terapeuta

  return (
    <Tarjeta>
      <h2 className="text-lg font-semibold text-verde-oscuro">Terapeuta responsable</h2>

      {actual ? (
        <p className="mt-2 text-texto">
          <span className="text-lg font-semibold">{actual.nombreCompleto}</span>
          {carpeta.asignadoEn && (
            <span className="block text-sm text-suave">
              Asignada el {fechaLarga(carpeta.asignadoEn)}
              {carpeta.asignadoPor && ` por ${carpeta.asignadoPor.nombreCompleto}`}.
            </span>
          )}
        </p>
      ) : (
        <p className="mt-2 text-texto">
          <span className="font-semibold text-naranja-texto">Sin terapeuta asignada.</span>{' '}
          <span className="text-suave">Por ahora solo la dirección puede ver esta carpeta.</span>
        </p>
      )}

      {puedeAsignar && <FormularioAsignacion carpeta={carpeta} alActualizar={alActualizar} />}
    </Tarjeta>
  )
}

function FormularioAsignacion({ carpeta, alActualizar }: Omit<Props, 'puedeAsignar'>) {
  const terapeutas = useCarga(listarTerapeutasActivas, [])
  const actualId = carpeta.terapeuta?.id ?? ''
  const [elegida, setElegida] = useState(actualId)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'exito' | 'error' | 'info'; texto: string } | null>(null)
  const refAviso = useRef<HTMLDivElement>(null)
  const id = useId()

  if (terapeutas.cargando && !terapeutas.datos) return <Cargando texto="Cargando terapeutas…" />

  if (terapeutas.error !== undefined) {
    return (
      <ErrorDeCarga
        error={terapeutas.error}
        alReintentar={terapeutas.recargar}
        contexto="No se pudo cargar la lista de terapeutas."
        className="mt-4"
      />
    )
  }

  const lista = terapeutas.datos ?? []
  if (lista.length === 0) {
    return (
      <p className="mt-4 rounded-xl bg-crema px-4 py-3 text-sm text-suave">
        No hay terapeutas activas para asignar.{' '}
        <Link to="/usuarios" className="font-semibold text-naranja-texto underline-offset-4 hover:underline">
          Crear una cuenta de terapeuta
        </Link>
      </p>
    )
  }

  const asignar = async () => {
    if (!elegida || elegida === actualId) return
    const anterior = carpeta.terapeuta
    setGuardando(true)
    setResultado(null)
    try {
      const actualizada = await asignarTerapeuta(carpeta.id, elegida)
      const nueva = actualizada.terapeuta?.nombreCompleto ?? 'La terapeuta elegida'
      setResultado({
        tipo: 'exito',
        texto: anterior
          ? `${nueva} es ahora la responsable. ${anterior.nombreCompleto} ya no puede ver esta carpeta.`
          : `${nueva} es ahora la responsable y ya puede ver esta carpeta.`,
      })
      alActualizar(actualizada)
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 400) {
        setResultado({
          tipo: 'error',
          texto: 'Esa persona ya no es una terapeuta activa. Actualizamos la lista: elige otra.',
        })
        terapeutas.recargar()
      } else if (esEndpointPendiente(error)) {
        // PUT /api/casos/:id/terapeuta llega con FE-37.
        setResultado({ tipo: 'info', texto: mensajeErrorGeneral(error) })
      } else {
        setResultado({ tipo: 'error', texto: mensajeErrorGeneral(error) })
      }
    } finally {
      setGuardando(false)
      requestAnimationFrame(() => refAviso.current?.focus())
    }
  }

  return (
    <div className="mt-5 border-t border-linea pt-5">
      <label htmlFor={`${id}-terapeuta`} className="block text-sm font-semibold text-texto">
        {actualId ? 'Cambiar responsable' : 'Asignar a'}
      </label>
      <div className="mt-1.5 flex flex-col gap-3 sm:flex-row">
        <select
          id={`${id}-terapeuta`}
          value={elegida}
          onChange={(e) => {
            setElegida(e.target.value)
            setResultado(null)
          }}
          disabled={guardando}
          className={`${claseCampo(false)} mt-0 sm:flex-1`}
        >
          {!actualId && <option value="">Elige una terapeuta</option>}
          {lista.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombreCompleto}
              {t.id === actualId ? ' (actual)' : ''}
            </option>
          ))}
        </select>
        <Boton
          onClick={asignar}
          disabled={!elegida || elegida === actualId}
          cargando={guardando}
          textoCargando="Guardando…"
        >
          {actualId ? 'Cambiar responsable' : 'Asignar'}
        </Boton>
      </div>
      <p className="mt-1.5 text-sm text-suave">Solo aparecen terapeutas con cuenta activa.</p>

      {resultado && (
        <Aviso ref={refAviso} tipo={resultado.tipo} className="mt-4">
          {resultado.texto}
        </Aviso>
      )}
    </div>
  )
}
