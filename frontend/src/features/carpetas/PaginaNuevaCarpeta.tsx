import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ErrorApi, mensajeErrorGeneral } from '../../api/cliente'
import { AreaTexto, Aviso, Boton, CampoTexto, EncabezadoPagina, GrupoOpciones, Tarjeta } from '../../componentes/ui'
import { hoyIso } from '../../utilidades/fechas'
import { registrarCarpeta } from './carpetasApi'
import type { TipoCaso } from './tipos'
import {
  aNuevaCarpeta,
  FORMULARIO_VACIO,
  validarNuevaCarpeta,
  type ErroresCarpeta,
  type FormularioCarpeta,
} from './validacion'

const TIPOS: { valor: TipoCaso; nombre: string; descripcion: string }[] = [
  {
    valor: 'voluntario',
    nombre: 'Voluntario',
    descripcion: 'Llegó por su cuenta: llamada, redes sociales o contactos.',
  },
  {
    valor: 'derivado',
    nombre: 'Derivado',
    descripcion: 'Lo envió una institución: juzgado, Aldeas SOS, universidad u otra.',
  },
]

/** Orden en que se enfoca el primer campo con error. */
const ORDEN_CAMPOS: (keyof FormularioCarpeta)[] = [
  'nombreCompleto',
  'fechaNacimiento',
  'telefono',
  'fechaIngreso',
  'tipo',
  'fechaDerivacion',
]

/**
 * FE-31 · Registro integral de paciente y apertura de carpeta (historia FE-11).
 * Usa POST /api/casos (FE-32): paciente + caso (+ contexto judicial si es derivado) en una transacción.
 */
export function PaginaNuevaCarpeta() {
  const navegar = useNavigate()
  const [form, setForm] = useState<FormularioCarpeta>({ ...FORMULARIO_VACIO, fechaIngreso: hoyIso() })
  const [errores, setErrores] = useState<ErroresCarpeta>({})
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const refFormulario = useRef<HTMLFormElement>(null)
  const refAviso = useRef<HTMLDivElement>(null)

  const cambiar = (campo: keyof FormularioCarpeta, valor: string) => {
    const siguiente = { ...form, [campo]: valor }
    setForm(siguiente)
    if (intento) setErrores(validarNuevaCarpeta(siguiente))
  }

  const enfocar = (campo: keyof FormularioCarpeta) =>
    refFormulario.current?.querySelector<HTMLElement>(`[name="${campo}"]`)?.focus()

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando) return
    setIntento(true)
    setErrorGeneral(null)

    const encontrados = validarNuevaCarpeta(form)
    setErrores(encontrados)
    const primero = ORDEN_CAMPOS.find((c) => encontrados[c])
    if (primero) return enfocar(primero)

    setGuardando(true)
    try {
      const carpeta = await registrarCarpeta(aNuevaCarpeta(form))
      navegar(`/carpetas/${carpeta.id}`, {
        state: { recienCreada: true, posiblesDuplicados: carpeta.posiblesDuplicados ?? [] },
      })
    } catch (error) {
      setGuardando(false)
      setErrorGeneral(
        error instanceof ErrorApi && error.estado === 400
          ? `El servidor rechazó los datos: ${error.message}`
          : mensajeErrorGeneral(error),
      )
      requestAnimationFrame(() => refAviso.current?.focus())
    }
  }

  const derivado = form.tipo === 'derivado'

  return (
    <div className="space-y-6">
      <Link to="/carpetas" className="text-sm font-semibold text-naranja-texto underline-offset-4 hover:underline">
        Volver a carpetas
      </Link>
      <EncabezadoPagina
        titulo="Registrar paciente"
        descripcion="Se abre su carpeta digital con estado «Iniciado». Los datos clínicos se completan después, en las fichas."
      />

      <Tarjeta className="max-w-2xl">
        <form ref={refFormulario} noValidate onSubmit={guardar}>
          <fieldset disabled={guardando} className="space-y-5">
            <legend className="text-lg font-semibold text-verde-oscuro">Paciente</legend>

            <CampoTexto
              etiqueta="Nombre completo del paciente"
              name="nombreCompleto"
              autoComplete="off"
              value={form.nombreCompleto}
              onChange={(e) => cambiar('nombreCompleto', e.target.value)}
              error={errores.nombreCompleto}
              ayuda="Para una familia puedes escribir, por ejemplo, «Familia Quispe Mamani»."
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <CampoTexto
                etiqueta="Fecha de nacimiento (opcional)"
                name="fechaNacimiento"
                type="date"
                max={form.fechaIngreso || hoyIso()}
                value={form.fechaNacimiento}
                onChange={(e) => cambiar('fechaNacimiento', e.target.value)}
                error={errores.fechaNacimiento}
                ayuda="Con ella se calcula la edad al ingreso."
              />
              <CampoTexto
                etiqueta="Teléfono (opcional)"
                name="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={form.telefono}
                onChange={(e) => cambiar('telefono', e.target.value)}
                error={errores.telefono}
              />
            </div>

            <h2 className="border-t border-linea pt-5 text-lg font-semibold text-verde-oscuro">Carpeta</h2>

            <CampoTexto
              etiqueta="Fecha de ingreso"
              name="fechaIngreso"
              type="date"
              max={hoyIso()}
              value={form.fechaIngreso}
              onChange={(e) => cambiar('fechaIngreso', e.target.value)}
              error={errores.fechaIngreso}
              className="sm:max-w-xs"
            />

            <GrupoOpciones
              leyenda="¿Cómo llegó el paciente?"
              nombre="tipo"
              opciones={TIPOS}
              valor={form.tipo as TipoCaso | ''}
              alCambiar={(tipo) => cambiar('tipo', tipo)}
              error={errores.tipo}
            />

            {derivado && (
              <fieldset className="space-y-5 rounded-2xl bg-crema p-4 sm:p-5">
                <legend className="sr-only">Contexto judicial</legend>
                <p className="font-semibold text-verde-oscuro">Contexto de la derivación (opcional)</p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <CampoTexto
                    etiqueta="Juzgado o institución"
                    name="juzgado"
                    autoComplete="off"
                    maxLength={200}
                    value={form.juzgado}
                    onChange={(e) => cambiar('juzgado', e.target.value)}
                  />
                  <CampoTexto
                    etiqueta="Nº de expediente"
                    name="nroExpediente"
                    autoComplete="off"
                    maxLength={100}
                    value={form.nroExpediente}
                    onChange={(e) => cambiar('nroExpediente', e.target.value)}
                  />
                </div>
                <CampoTexto
                  etiqueta="Fecha de derivación"
                  name="fechaDerivacion"
                  type="date"
                  max={hoyIso()}
                  value={form.fechaDerivacion}
                  onChange={(e) => cambiar('fechaDerivacion', e.target.value)}
                  error={errores.fechaDerivacion}
                  className="sm:max-w-xs"
                />
                <AreaTexto
                  etiqueta="Observaciones"
                  name="observaciones"
                  maxLength={5000}
                  value={form.observaciones}
                  onChange={(e) => cambiar('observaciones', e.target.value)}
                />
              </fieldset>
            )}

            <AreaTexto
              etiqueta="Motivo de consulta o diagnóstico de ingreso (opcional)"
              name="diagnosticoIngreso"
              maxLength={5000}
              value={form.diagnosticoIngreso}
              onChange={(e) => cambiar('diagnosticoIngreso', e.target.value)}
            />

            <p className="rounded-xl bg-crema px-4 py-3 text-sm text-suave">
              El número de carpeta se asigna automáticamente al guardar (una numeración para voluntarios y otra para
              derivados) y no se puede cambiar.
            </p>

            {errorGeneral && (
              <Aviso ref={refAviso} tipo="error">
                {errorGeneral}
              </Aviso>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                to="/carpetas"
                className="inline-flex items-center justify-center rounded-full px-5 py-3 font-semibold text-suave hover:text-texto"
              >
                Cancelar
              </Link>
              <Boton type="submit" cargando={guardando} textoCargando="Registrando…">
                Registrar y abrir carpeta
              </Boton>
            </div>
          </fieldset>
        </form>
      </Tarjeta>
    </div>
  )
}
