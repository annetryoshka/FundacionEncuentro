import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ErrorApi, mensajeErrorGeneral } from '../../api/cliente'
import { Aviso, Boton, CampoTexto, EncabezadoPagina, GrupoOpciones, Tarjeta } from '../../componentes/ui'
import { hoyIso } from '../../utilidades/fechas'
import { registrarCarpeta } from './carpetasApi'
import { NOMBRE_TIPO, numeroCarpeta, type NuevaCarpeta, type PosibleDuplicado, type TipoCaso } from './tipos'
import { validarNuevaCarpeta, type ErroresCarpeta } from './validacion'

type Formulario = { [K in keyof NuevaCarpeta]: string }

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

/** FE-31 · Formulario de registro de paciente y apertura de carpeta (historia FE-11). */
export function PaginaNuevaCarpeta() {
  const navegar = useNavigate()
  const [form, setForm] = useState<Formulario>({ nombreCompleto: '', fechaIngreso: hoyIso(), tipo: '' })
  const [errores, setErrores] = useState<ErroresCarpeta>({})
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [duplicados, setDuplicados] = useState<PosibleDuplicado[]>([])

  const refNombre = useRef<HTMLInputElement>(null)
  const refFecha = useRef<HTMLInputElement>(null)
  const refAviso = useRef<HTMLDivElement>(null)

  const cambiar = (campo: keyof Formulario, valor: string) => {
    const siguiente = { ...form, [campo]: valor }
    setForm(siguiente)
    if (campo === 'nombreCompleto') setDuplicados([])
    if (intento) setErrores(validarNuevaCarpeta(siguiente))
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando) return
    setIntento(true)
    setErrorGeneral(null)
    setDuplicados([])

    const encontrados = validarNuevaCarpeta(form)
    setErrores(encontrados)
    if (encontrados.nombreCompleto) return refNombre.current?.focus()
    if (encontrados.fechaIngreso) return refFecha.current?.focus()
    if (encontrados.tipo) return

    setGuardando(true)
    try {
      const carpeta = await registrarCarpeta({
        nombreCompleto: form.nombreCompleto.trim().replace(/\s+/g, ' '),
        fechaIngreso: form.fechaIngreso,
        tipo: form.tipo as TipoCaso,
      })
      navegar(`/carpetas/${carpeta.id}`, { state: { recienCreada: true } })
    } catch (error) {
      setGuardando(false)
      if (error instanceof ErrorApi && error.estado === 409) {
        setDuplicados((error.datos.posiblesDuplicados as PosibleDuplicado[] | undefined) ?? [])
        setErrorGeneral('Ya existe una carpeta con un nombre igual. No se registró una nueva para evitar duplicados.')
      } else {
        setErrorGeneral(
          error instanceof ErrorApi && error.estado === 400
            ? 'El servidor rechazó los datos. Revisa el nombre y la fecha de ingreso.'
            : mensajeErrorGeneral(error),
        )
      }
      requestAnimationFrame(() => refAviso.current?.focus())
    }
  }

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
        <form noValidate onSubmit={guardar}>
          <fieldset disabled={guardando} className="space-y-5">
            <legend className="sr-only">Datos del paciente</legend>

            <CampoTexto
              ref={refNombre}
              etiqueta="Nombre completo del paciente"
              name="nombreCompleto"
              autoComplete="off"
              value={form.nombreCompleto}
              onChange={(e) => cambiar('nombreCompleto', e.target.value)}
              error={errores.nombreCompleto}
              ayuda="Para una familia puedes escribir, por ejemplo, «Familia Quispe Mamani»."
            />

            <CampoTexto
              ref={refFecha}
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

            <p className="rounded-xl bg-crema px-4 py-3 text-sm text-suave">
              El número de carpeta se asigna automáticamente al guardar y no se puede cambiar.
            </p>

            {errorGeneral && (
              <Aviso ref={refAviso} tipo="error">
                <p>{errorGeneral}</p>
                {duplicados.length > 0 && (
                  <>
                    <p className="mt-2 text-texto">Revisa si es la misma persona:</p>
                    <ul className="mt-1 space-y-1">
                      {duplicados.map((d) => (
                        <li key={d.id}>
                          <Link
                            to={`/carpetas/${d.id}`}
                            className="font-semibold text-texto underline underline-offset-2"
                          >
                            Carpeta {numeroCarpeta(d.numero)} ({NOMBRE_TIPO[d.tipo]}): {d.nombreCompleto}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
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
