import { useRef, useState, type FormEvent } from 'react'
import { ErrorApi, mensajeErrorGeneral } from '../../api/cliente'
import { Aviso, Boton, CampoTexto, Tarjeta } from '../../componentes/ui'
import { hoyIso } from '../../utilidades/fechas'
import { actualizarDatosPaciente } from './carpetasApi'
import {
  aDatosResidencia,
  aValorResidencia,
  validarResidencia,
  type ErroresResidencia,
  type ValorResidencia,
} from './residencia'
import { SelectorResidencia } from './SelectorResidencia'
import { numeroCarpeta, type CarpetaDetalle } from './tipos'
import { validarNuevaCarpeta } from './validacion'

interface Props {
  carpeta: CarpetaDetalle
  alGuardar: (actualizada: CarpetaDetalle) => void
  alCancelar: () => void
}

/**
 * FE-52 · Corrección de los datos del paciente (solo administración).
 * FE-138 · Incluye la ciudad de residencia. Cambiarla actualiza las agrupaciones actuales sin tocar
 * número, origen, historial ni asignación (FE-134).
 */
export function FormularioEditarPaciente({ carpeta, alGuardar, alCancelar }: Props) {
  const [nombreCompleto, setNombreCompleto] = useState(carpeta.paciente.nombreCompleto)
  const [fechaIngreso, setFechaIngreso] = useState(carpeta.fechaIngreso)
  const [residencia, setResidencia] = useState<ValorResidencia>(() =>
    aValorResidencia({
      ciudadResidencia: carpeta.paciente.ciudadResidencia ?? null,
      otraLocalidad: carpeta.paciente.otraLocalidad ?? null,
    }),
  )
  const [errores, setErrores] = useState<{ nombreCompleto?: string; fechaIngreso?: string }>({})
  const [erroresResidencia, setErroresResidencia] = useState<ErroresResidencia>({})
  const [guardando, setGuardando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const refNombre = useRef<HTMLInputElement>(null)
  const refFecha = useRef<HTMLInputElement>(null)
  const refResidencia = useRef<HTMLDivElement>(null)
  const refAviso = useRef<HTMLDivElement>(null)

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando) return
    setErrorGeneral(null)

    const encontrados = validarNuevaCarpeta({ nombreCompleto, fechaIngreso, tipo: carpeta.tipo })
    const enResidencia = validarResidencia(residencia)
    setErrores({ nombreCompleto: encontrados.nombreCompleto, fechaIngreso: encontrados.fechaIngreso })
    setErroresResidencia(enResidencia)

    if (encontrados.nombreCompleto) return refNombre.current?.focus()
    if (encontrados.fechaIngreso) return refFecha.current?.focus()
    if (enResidencia.ciudad || enResidencia.localidad) {
      // El campo con error ya existe (select o localidad): se enfoca sin esperar al nuevo render.
      return refResidencia.current?.querySelector<HTMLElement>(enResidencia.ciudad ? 'select' : 'input')?.focus()
    }

    setGuardando(true)
    try {
      const actualizada = await actualizarDatosPaciente(carpeta.id, {
        nombreCompleto: nombreCompleto.trim().replace(/\s+/g, ' '),
        fechaIngreso,
        ...aDatosResidencia(residencia),
      })
      alGuardar(actualizada)
    } catch (error) {
      setErrorGeneral(error instanceof ErrorApi && error.estado === 400 ? error.message : mensajeErrorGeneral(error))
      requestAnimationFrame(() => refAviso.current?.focus())
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta className="max-w-2xl">
      <h2 className="mb-2 text-xl font-semibold text-verde-oscuro">Editar datos del paciente</h2>
      <p className="mb-5 text-sm text-suave">Modifica el nombre, la fecha de ingreso o la ciudad de residencia.</p>

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
              setErrores((actual) => ({ ...actual, nombreCompleto: undefined }))
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
              setErrores((actual) => ({ ...actual, fechaIngreso: undefined }))
            }}
            error={errores.fechaIngreso}
            className="sm:max-w-xs"
          />

          <div ref={refResidencia}>
            <SelectorResidencia
              valor={residencia}
              errores={erroresResidencia}
              alCambiar={(valor) => {
                setResidencia(valor)
                setErroresResidencia({})
              }}
            />
          </div>

          {errorGeneral && (
            <Aviso ref={refAviso} tipo="error">
              <p>{errorGeneral}</p>
            </Aviso>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Boton type="button" variante="secundario" icono="cerrar" onClick={alCancelar} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" icono="guardar" cargando={guardando} textoCargando="Guardando…">
              Guardar cambios
            </Boton>
          </div>
        </fieldset>
      </form>
    </Tarjeta>
  )
}
