import { useRef, useState, type FormEvent } from 'react'
import { ErrorApi } from '../../../api/cliente'
import { useCarga } from '../../../api/useCarga'
import { ErrorDeCarga } from '../../../componentes/ErrorDeCarga'
import { AreaTexto, Aviso, Boton, CampoSeleccion, CampoTexto, Cargando, Tarjeta } from '../../../componentes/ui'
import { fechaLarga, hoyIso } from '../../../utilidades/fechas'
import { useSesion } from '../../auth/sesion'
import type { CarpetaDetalle } from '../../carpetas/tipos'
import { crearNombrador } from '../autoria'
import { enfocarPrimerError, mensajeNoGuardado } from '../errores'
import { SeccionCarpeta } from '../SeccionCarpeta'
import {
  LIMITES,
  NOMBRE_PARENTESCO,
  PARENTESCOS,
  aFila,
  cambios,
  filaVacia,
  guardarFamilia,
  nombreParentesco,
  obtenerFamilia,
  textoConvivencia,
  textoEdad,
  validarFila,
  type ErroresFila,
  type FichaFamiliar,
  type FilaFamiliar,
  type ModoEdad,
} from './familia'

/**
 * FE-127 · Composición familiar del caso (FE-123/FE-126). Administración y la terapeuta asignada la registran y
 * editan; el backend vuelve a comprobar el acceso. La ficha se guarda aparte del diagnóstico y del genograma.
 */
export function PaginaFamilia() {
  return (
    <SeccionCarpeta titulo="Composición familiar">{(carpeta) => <VistaFamilia carpeta={carpeta} />}</SeccionCarpeta>
  )
}

function VistaFamilia({ carpeta }: { carpeta: CarpetaDetalle }) {
  const { usuario } = useSesion()
  const { datos, error, recargar } = useCarga(() => obtenerFamilia(carpeta.id), [carpeta.id])
  const [guardada, setGuardada] = useState<FichaFamiliar | null>(null)
  const [editando, setEditando] = useState(false)
  const [exito, setExito] = useState(false)
  const refExito = useRef<HTMLDivElement>(null)
  const nombre = crearNombrador(carpeta, usuario)

  if (error !== undefined) {
    return <ErrorDeCarga error={error} alReintentar={recargar} contexto="No se pudo cargar la composición familiar." />
  }
  if (!datos) return <Cargando texto="Cargando composición familiar…" />

  // Tras guardar se muestra lo que confirmó el servidor; una recarga posterior vuelve a mandar.
  const ficha = guardada && guardada.version !== null && guardada.version >= (datos.version ?? 0) ? guardada : datos

  if (editando) {
    return (
      <EditorFamilia
        carpetaId={carpeta.id}
        ficha={ficha}
        alCancelar={() => setEditando(false)}
        alRecargar={() => {
          setGuardada(null)
          setEditando(false)
          recargar()
        }}
        alGuardar={(nueva) => {
          setGuardada(nueva)
          setEditando(false)
          setExito(true)
          requestAnimationFrame(() => refExito.current?.focus())
        }}
      />
    )
  }

  const empezar = () => {
    setExito(false)
    setEditando(true)
  }

  return (
    <div className="max-w-4xl space-y-4">
      {exito && (
        <Aviso ref={refExito} tipo="exito">
          Composición familiar guardada.
        </Aviso>
      )}
      <p className="text-sm text-suave">
        Cada integrante se describe por su relación con el paciente ({carpeta.paciente.nombreCompleto}). Los familiares
        no tienen carpeta propia.
      </p>

      {!ficha.registrada ? (
        <Tarjeta>
          <p className="text-lg font-semibold text-verde-oscuro">Sin composición familiar registrada</p>
          <p className="mt-1 text-suave">Todavía no se anotó quiénes forman la familia del paciente.</p>
          <Boton className="mt-4" icono="mas" onClick={empezar} data-recorrido="registrar-familia">
            Registrar composición familiar
          </Boton>
        </Tarjeta>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-verde-oscuro">
              {ficha.familiares.length === 0
                ? 'Registrada sin integrantes'
                : `${ficha.familiares.length} ${ficha.familiares.length === 1 ? 'integrante' : 'integrantes'}`}
            </h2>
            <Boton variante="secundario" icono="editar" onClick={empezar} data-recorrido="editar-familia">
              Editar composición
            </Boton>
          </div>
          {ficha.familiares.length === 0 ? (
            <Tarjeta>
              <p className="text-suave">La ficha familiar se guardó sin integrantes. Puedes agregarlos al editarla.</p>
            </Tarjeta>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2" data-recorrido="lista-familia">
              {ficha.familiares.map((f) => (
                <li key={f.id}>
                  <Tarjeta className="h-full">
                    <p className="text-sm font-semibold text-naranja-texto">{nombreParentesco(f)}</p>
                    <h3 className="text-lg font-semibold text-verde-oscuro">
                      {f.nombreCompleto ?? <span className="font-normal text-suave italic">Nombre no registrado</span>}
                    </h3>
                    <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                      <dt className="text-suave">Edad</dt>
                      <dd className="text-texto">{textoEdad(f, fechaLarga)}</dd>
                      <dt className="text-suave">Ocupación</dt>
                      <dd className="text-texto">{f.ocupacion ?? 'Sin dato'}</dd>
                      <dt className="text-suave">Trabajo o estudio</dt>
                      <dd className="text-texto">{f.lugarTrabajoEstudio ?? 'Sin dato'}</dd>
                      <dt className="text-suave">Vive con el paciente</dt>
                      <dd className="text-texto">{textoConvivencia(f.conviveConPaciente)}</dd>
                      {f.observaciones && (
                        <>
                          <dt className="text-suave">Observaciones</dt>
                          <dd className="whitespace-pre-line text-texto">{f.observaciones}</dd>
                        </>
                      )}
                    </dl>
                    <p className="mt-3 text-xs text-suave">
                      Actualizado por {nombre(f.actualizadoPor)} el {fechaLarga(f.actualizadoEn)}
                    </p>
                  </Tarjeta>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

interface PropsEditor {
  carpetaId: string
  ficha: FichaFamiliar
  alGuardar: (ficha: FichaFamiliar) => void
  alCancelar: () => void
  alRecargar: () => void
}

function EditorFamilia({ carpetaId, ficha, alGuardar, alCancelar, alRecargar }: PropsEditor) {
  const [filas, setFilas] = useState<FilaFamiliar[]>(() =>
    ficha.familiares.length ? ficha.familiares.map(aFila) : [filaVacia()],
  )
  /** Claves de integrantes ya guardados que se quitarán al guardar (se pueden recuperar antes). */
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set())
  const [errores, setErrores] = useState<Record<string, ErroresFila>>({})
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<{ mensaje: string; conflicto: boolean } | null>(null)
  const refForm = useRef<HTMLFormElement>(null)
  const refAviso = useRef<HTMLDivElement>(null)

  const vigentes = filas.filter((f) => !quitadas.has(f.clave))

  const validar = (lista: FilaFamiliar[]) =>
    Object.fromEntries(
      lista
        .filter((f) => !quitadas.has(f.clave))
        .map((f) => [f.clave, validarFila(f)] as const)
        .filter(([, e]) => Object.keys(e).length > 0),
    )

  const cambiar = (clave: string, cambio: Partial<FilaFamiliar>) => {
    const siguientes = filas.map((f) => (f.clave === clave ? { ...f, ...cambio } : f))
    setFilas(siguientes)
    if (intento) setErrores(validar(siguientes))
  }

  const agregar = () => {
    const nueva = filaVacia()
    setFilas([...filas, nueva])
    requestAnimationFrame(() =>
      refForm.current?.querySelector<HTMLSelectElement>(`[data-fila="${nueva.clave}"] select`)?.focus(),
    )
  }

  const quitar = (fila: FilaFamiliar) => {
    if (fila.id) setQuitadas(new Set(quitadas).add(fila.clave))
    else setFilas(filas.filter((f) => f.clave !== fila.clave))
    setErrores(({ [fila.clave]: _quitado, ...resto }) => resto)
  }

  const recuperar = (clave: string) => {
    const siguiente = new Set(quitadas)
    siguiente.delete(clave)
    setQuitadas(siguiente)
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    setIntento(true)
    setFallo(null)
    const encontrados = validar(filas)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return enfocarPrimerError(refForm.current)

    const { familiares, eliminarIds } = cambios(ficha.familiares, vigentes)
    setGuardando(true)
    try {
      alGuardar(await guardarFamilia(carpetaId, { version: ficha.version, familiares, eliminarIds }))
    } catch (error) {
      const conflicto = error instanceof ErrorApi && error.estado === 409
      setFallo({
        conflicto,
        mensaje: conflicto
          ? 'Otra persona guardó cambios en esta composición familiar mientras la editabas. Tus cambios siguen aquí, pero no se guardaron: carga la versión actual y vuelve a aplicarlos.'
          : mensajeNoGuardado(error),
      })
      setGuardando(false)
      requestAnimationFrame(() => refAviso.current?.focus())
    }
  }

  return (
    <form ref={refForm} noValidate onSubmit={guardar} className="max-w-4xl space-y-4">
      <p className="text-sm text-suave">
        Anota a cada integrante por su relación con el paciente. Si no conoces un dato, déjalo vacío: no se inventa.
      </p>

      <fieldset disabled={guardando} className="space-y-4">
        <legend className="sr-only">Integrantes de la familia</legend>
        {filas.map((fila, i) =>
          quitadas.has(fila.clave) ? (
            <Tarjeta key={fila.clave} className="flex flex-wrap items-center justify-between gap-3 border-dashed">
              <p className="text-suave">
                Se quitará a <strong className="text-texto">{fila.nombreCompleto.trim() || 'este integrante'}</strong>{' '}
                al guardar.
              </p>
              <Boton variante="texto" onClick={() => recuperar(fila.clave)}>
                Deshacer
              </Boton>
            </Tarjeta>
          ) : (
            <FilaEditable
              key={fila.clave}
              fila={fila}
              numero={i + 1}
              errores={errores[fila.clave] ?? {}}
              alCambiar={(cambio) => cambiar(fila.clave, cambio)}
              alQuitar={() => quitar(fila)}
            />
          ),
        )}

        <Boton variante="secundario" icono="mas" onClick={agregar} data-recorrido="agregar-integrante">
          Agregar integrante
        </Boton>
      </fieldset>

      {vigentes.length === 0 && (
        <Aviso tipo="info">
          <p>Se guardará la composición familiar sin integrantes.</p>
        </Aviso>
      )}

      {fallo && (
        <Aviso ref={refAviso} tipo="error">
          <p>{fallo.mensaje}</p>
          {fallo.conflicto && (
            <Boton variante="texto" className="mt-1 -ml-2" onClick={alRecargar}>
              Cargar la versión actual
            </Boton>
          )}
        </Aviso>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Boton variante="secundario" icono="cerrar" onClick={alCancelar} disabled={guardando}>
          Cancelar
        </Boton>
        <Boton
          type="submit"
          icono="guardar"
          cargando={guardando}
          textoCargando="Guardando…"
          data-recorrido="guardar-familia"
        >
          Guardar composición
        </Boton>
      </div>
    </form>
  )
}

const MODOS_EDAD: { valor: ModoEdad; nombre: string }[] = [
  { valor: 'nacimiento', nombre: 'Fecha de nacimiento' },
  { valor: 'referida', nombre: 'Edad referida' },
  { valor: 'desconocida', nombre: 'No se conoce' },
]

function FilaEditable({
  fila,
  numero,
  errores,
  alCambiar,
  alQuitar,
}: {
  fila: FilaFamiliar
  numero: number
  errores: ErroresFila
  alCambiar: (cambio: Partial<FilaFamiliar>) => void
  alQuitar: () => void
}) {
  const titulo = fila.parentesco
    ? nombreParentesco({ parentesco: fila.parentesco, parentescoDetalle: fila.parentescoDetalle.trim() || null })
    : `Integrante ${numero}`
  return (
    <Tarjeta>
      <fieldset data-fila={fila.clave} className="space-y-4">
        <legend className="flex w-full items-center justify-between gap-3">
          <span className="text-base font-semibold text-verde-oscuro">{titulo}</span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSeleccion
            etiqueta="Parentesco respecto del paciente"
            value={fila.parentesco}
            error={errores.parentesco}
            onChange={(e) => alCambiar({ parentesco: e.target.value as FilaFamiliar['parentesco'] })}
          >
            <option value="">Elige…</option>
            {PARENTESCOS.map((p) => (
              <option key={p} value={p}>
                {NOMBRE_PARENTESCO[p]}
              </option>
            ))}
          </CampoSeleccion>
          {fila.parentesco === 'otro' ? (
            <CampoTexto
              etiqueta="¿Qué parentesco?"
              value={fila.parentescoDetalle}
              maxLength={LIMITES.detalle}
              error={errores.parentescoDetalle}
              ayuda="Por ejemplo: madrina, primo, bisabuela."
              onChange={(e) => alCambiar({ parentescoDetalle: e.target.value })}
            />
          ) : (
            <div className="hidden sm:block" />
          )}
          <CampoTexto
            etiqueta="Nombre completo"
            value={fila.nombreCompleto}
            maxLength={LIMITES.nombre}
            autoComplete="off"
            error={errores.nombreCompleto}
            ayuda="Si no se conoce, déjalo vacío."
            onChange={(e) => alCambiar({ nombreCompleto: e.target.value })}
            className="sm:col-span-2"
          />
          <CampoSeleccion
            etiqueta="Edad"
            value={fila.modoEdad}
            onChange={(e) => alCambiar({ modoEdad: e.target.value as ModoEdad })}
          >
            {MODOS_EDAD.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.nombre}
              </option>
            ))}
          </CampoSeleccion>
          {fila.modoEdad === 'nacimiento' && (
            <CampoTexto
              etiqueta="Fecha de nacimiento"
              type="date"
              max={hoyIso()}
              value={fila.fechaNacimiento}
              error={errores.fechaNacimiento}
              onChange={(e) => alCambiar({ fechaNacimiento: e.target.value })}
            />
          )}
          {fila.modoEdad === 'referida' && (
            <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
              <CampoTexto
                etiqueta="Años"
                inputMode="numeric"
                value={fila.edadReferida}
                error={errores.edadReferida}
                onChange={(e) => alCambiar({ edadReferida: e.target.value.replace(/\D/g, '').slice(0, 3) })}
              />
              <CampoTexto
                etiqueta="Informada el"
                type="date"
                max={hoyIso()}
                value={fila.fechaReferencia}
                error={errores.fechaReferencia}
                onChange={(e) => alCambiar({ fechaReferencia: e.target.value })}
              />
            </div>
          )}
          {fila.modoEdad === 'desconocida' && <div className="hidden sm:block" />}
          <CampoTexto
            etiqueta="Ocupación o actividad"
            value={fila.ocupacion}
            maxLength={LIMITES.ocupacion}
            error={errores.ocupacion}
            ayuda="Estudiante, conductor, comerciante…"
            onChange={(e) => alCambiar({ ocupacion: e.target.value })}
          />
          <CampoTexto
            etiqueta="Lugar de trabajo o estudio"
            value={fila.lugarTrabajoEstudio}
            maxLength={LIMITES.lugar}
            error={errores.lugarTrabajoEstudio}
            onChange={(e) => alCambiar({ lugarTrabajoEstudio: e.target.value })}
          />
          <CampoSeleccion
            etiqueta="¿Vive con el paciente?"
            value={fila.convive}
            onChange={(e) => alCambiar({ convive: e.target.value as FilaFamiliar['convive'] })}
          >
            <option value="">Sin dato</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </CampoSeleccion>
          <AreaTexto
            etiqueta="Observaciones"
            rows={3}
            value={fila.observaciones}
            maxLength={LIMITES.observaciones}
            error={errores.observaciones}
            onChange={(e) => alCambiar({ observaciones: e.target.value })}
            className="sm:col-span-2"
          />
        </div>
        <div className="flex justify-end">
          <Boton variante="texto" icono="cerrar" onClick={alQuitar}>
            Quitar integrante
            <span className="sr-only">
              {' '}
              {numero} ({titulo})
            </span>
          </Boton>
        </div>
      </fieldset>
    </Tarjeta>
  )
}
