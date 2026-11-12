import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Aviso, AreaTexto, Boton, CampoTexto, Tarjeta } from '../../componentes/ui'
import { esFechaValida, hoyIso } from '../../utilidades/fechas'
import type { CarpetaDetalle } from '../carpetas/tipos'
import { mensajeNoGuardado, LIMITE_TEXTO_LARGO, tieneTexto } from './errores'
import { registrarSesion } from './expedienteApi'
import { SeccionCarpeta } from './SeccionCarpeta'

/** FE-72 · Registrar una sesión con su seguimiento (fecha y evolución) en una sola operación. */
export function PaginaNuevaSesion() {
  return (
    <SeccionCarpeta titulo="Registrar sesión">{(carpeta) => <FormularioSesion carpeta={carpeta} />}</SeccionCarpeta>
  )
}

interface Errores {
  fecha?: string
  evolucion?: string
}

function validar(fecha: string, evolucion: string): Errores {
  const errores: Errores = {}
  if (!fecha) errores.fecha = 'Indica la fecha de la sesión.'
  else if (!esFechaValida(fecha)) errores.fecha = 'La fecha no es válida.'
  if (!tieneTexto(evolucion)) errores.evolucion = 'Escribe la evolución de la sesión.'
  else if (evolucion.length > LIMITE_TEXTO_LARGO) errores.evolucion = 'La evolución supera los 10 000 caracteres.'
  return errores
}

function FormularioSesion({ carpeta }: { carpeta: CarpetaDetalle }) {
  const navegar = useNavigate()
  const [fecha, setFecha] = useState(hoyIso())
  const [evolucion, setEvolucion] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const refFecha = useRef<HTMLInputElement>(null)
  const refEvolucion = useRef<HTMLTextAreaElement>(null)
  const refFallo = useRef<HTMLDivElement>(null)

  if (!carpeta.terapeuta) {
    return (
      <Aviso tipo="info">
        Para registrar sesiones, la carpeta necesita una terapeuta asignada.{' '}
        <Link to={`/carpetas/${carpeta.id}`} className="font-semibold underline underline-offset-2">
          Ir al resumen de la carpeta
        </Link>
      </Aviso>
    )
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    const encontrados = validar(fecha, evolucion)
    setErrores(encontrados)
    setFallo(null)
    if (encontrados.fecha) return refFecha.current?.focus()
    if (encontrados.evolucion) return refEvolucion.current?.focus()

    setGuardando(true)
    try {
      const sesion = await registrarSesion(carpeta.id, { fecha, evolucion: evolucion.trim() })
      navegar(`/carpetas/${carpeta.id}/sesiones/${sesion.id}`, { state: { recienCreada: true } })
    } catch (error) {
      // Se conserva lo escrito: la evolución puede ser larga.
      setFallo(mensajeNoGuardado(error))
      setGuardando(false)
      requestAnimationFrame(() => refFallo.current?.focus())
    }
  }

  return (
    <Tarjeta className="max-w-3xl">
      <form onSubmit={enviar} noValidate className="space-y-5">
        <p className="text-sm text-suave">
          Responsable: <span className="font-semibold text-texto">{carpeta.terapeuta.nombreCompleto}</span> (terapeuta
          asignada). El número de sesión lo asigna el sistema.
        </p>
        <CampoTexto
          ref={refFecha}
          etiqueta="Fecha de la sesión"
          type="date"
          value={fecha}
          max="9999-12-31"
          onChange={(e) => setFecha(e.target.value)}
          error={errores.fecha}
          className="max-w-xs"
        />
        <AreaTexto
          ref={refEvolucion}
          etiqueta="Evolución"
          value={evolucion}
          rows={8}
          maxLength={LIMITE_TEXTO_LARGO}
          onChange={(e) => setEvolucion(e.target.value)}
          error={errores.evolucion}
          ayuda="Qué se trabajó en la sesión y cómo evolucionó el caso."
        />

        {fallo && (
          <Aviso ref={refFallo} tipo="error">
            {fallo}
          </Aviso>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to={`/carpetas/${carpeta.id}/sesiones`}
            className="inline-flex items-center justify-center rounded-full px-5 py-2.5 font-semibold text-naranja-texto underline-offset-4 hover:underline"
          >
            Cancelar
          </Link>
          <Boton type="submit" cargando={guardando} textoCargando="Guardando sesión…">
            Guardar sesión
          </Boton>
        </div>
      </form>
    </Tarjeta>
  )
}
