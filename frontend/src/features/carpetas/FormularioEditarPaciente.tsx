
import { useRef, useState, type FormEvent } from 'react'
import { ErrorApi, mensajeErrorGeneral } from '../../api/cliente'
import { Aviso, Boton, CampoTexto, Tarjeta } from '../../componentes/ui'
import { hoyIso } from '../../utilidades/fechas'
import { actualizarDatosPaciente } from './carpetasApi'
import { numeroCarpeta, type CarpetaDetalle } from './tipos'
import { validarNuevaCarpeta } from './validacion'

interface Props {
  carpeta: CarpetaDetalle
  alGuardar: (actualizada: CarpetaDetalle) => void
  alCancelar: () => void
}

export function FormularioEditarPaciente({
  carpeta,
  alGuardar,
  alCancelar,
}: Props) {
  const [nombreCompleto, setNombreCompleto] = useState(
    carpeta.paciente.nombreCompleto,
  )
  const [fechaIngreso, setFechaIngreso] = useState(
    carpeta.fechaIngreso,
  )
  const [errores, setErrores] = useState<{
    nombreCompleto?: string
    fechaIngreso?: string
  }>({})
  const [guardando, setGuardando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const refNombre = useRef<HTMLInputElement>(null)
  const refFecha = useRef<HTMLInputElement>(null)

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando) return

    setErrorGeneral(null)

    const encontrados = validarNuevaCarpeta({
      nombreCompleto,
      fechaIngreso,
      tipo: carpeta.tipo,
    })

    setErrores({
      nombreCompleto: encontrados.nombreCompleto,
      fechaIngreso: encontrados.fechaIngreso,
    })

    if (encontrados.nombreCompleto) {
      refNombre.current?.focus()
      return
    }

    if (encontrados.fechaIngreso) {
      refFecha.current?.focus()
      return
    }

    setGuardando(true)

    try {
      const actualizada = await actualizarDatosPaciente(carpeta.id, {
        nombreCompleto: nombreCompleto.trim().replace(/\s+/g, ' '),
        fechaIngreso,
      })

      alGuardar(actualizada)
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 400) {
        setErrorGeneral(error.message)
      } else {
        setErrorGeneral(mensajeErrorGeneral(error))
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta className="max-w-2xl">
      <h2 className="mb-2 text-xl font-semibold text-verde-oscuro">
        Editar datos del paciente
      </h2>

      <p className="mb-5 text-sm text-suave">
        Modifica el nombre o la fecha de ingreso.
      </p>

      <form noValidate onSubmit={guardar}>
        <fieldset disabled={guardando} className="space-y-5">
          <legend className="sr-only">Datos del paciente</legend>

          <CampoTexto
            ref={refNombre}
            etiqueta="Nombre completo del paciente"
            name="nombreCompleto"
            value={nombreCompleto}
            maxLength={150}
            onChange={(e) => {
              setNombreCompleto(e.target.value)
              setErrores((actual) => ({
                ...actual,
                nombreCompleto: undefined,
              }))
            }}
            error={errores.nombreCompleto}
          />

          <CampoTexto
            etiqueta="Número de carpeta"
            name="numeroCarpeta"
            value={numeroCarpeta(carpeta.numero)}
            readOnly
            ayuda="Este número es correlativo y no se puede modificar."
          />

          <CampoTexto
            ref={refFecha}
            etiqueta="Fecha de ingreso"
            name="fechaIngreso"
            type="date"
            max={hoyIso()}
            value={fechaIngreso}
            onChange={(e) => {
              setFechaIngreso(e.target.value)
              setErrores((actual) => ({
                ...actual,
                fechaIngreso: undefined,
              }))
            }}
            error={errores.fechaIngreso}
            className="sm:max-w-xs"
          />

          {errorGeneral && (
            <Aviso tipo="error">
              {errorGeneral}
            </Aviso>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Boton
              type="button"
              variante="secundario"
              onClick={alCancelar}
              disabled={guardando}
            >
              Cancelar
            </Boton>

            <Boton
              type="submit"
              cargando={guardando}
              textoCargando="Guardando..."
            >
              Guardar cambios
            </Boton>
          </div>
        </fieldset>
      </form>
    </Tarjeta>
  )
}
