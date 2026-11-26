import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ErrorApi } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import {
  AreaTexto,
  Aviso,
  Boton,
  CampoSeleccion,
  CampoTexto,
  Cargando,
  EncabezadoPagina,
  GrupoOpciones,
  Insignia,
  Tarjeta,
} from '../../componentes/ui'
import { useSesion } from '../auth/sesion'
import { FILTRO_SIN_REGISTRAR, NOMBRE_RESIDENCIA, SIN_REGISTRAR } from '../carpetas/residencia'
import { NOMBRE_TIPO, numeroCarpeta } from '../carpetas/tipos'
import { mensajeNoGuardado } from '../expediente/errores'
import {
  NOMBRE_SECCION_INV,
  crearCategoria,
  editarCategoria,
  esCodigoCategoria,
  listarCategorias,
  listarSeleccion,
  prepararExportacion,
  type Categoria,
  type FiltrosSeleccion,
  type SeccionInvestigacion,
} from './investigacion'

const RESIDENCIAS = [
  ...Object.entries(NOMBRE_RESIDENCIA).map(([valor, nombre]) => ({ valor, nombre })),
  { valor: FILTRO_SIN_REGISTRAR, nombre: SIN_REGISTRAR },
] as { valor: FiltrosSeleccion['residencias'][number]; nombre: string }[]

/**
 * FE-170 · Investigación: catálogo de categorías, selección de casos y preparación del paquete para Atlas.ti.
 * La revisión y la descarga siguen en /investigacion/exportaciones/:id.
 */
export function PaginaInvestigacion() {
  const { tieneRol } = useSesion()
  const esAdmin = tieneRol('administrador')
  const categorias = useCarga(listarCategorias, [])

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Investigación"
        descripcion="Categoriza casos y prepara paquetes anónimos para analizarlos en Atlas.ti. Solo entran los casos que tu cuenta puede ver."
      />
      {categorias.error !== undefined ? (
        <ErrorDeCarga
          error={categorias.error}
          alReintentar={categorias.recargar}
          contexto="No se pudieron cargar las categorías."
        />
      ) : !categorias.datos ? (
        <Cargando texto="Cargando categorías…" />
      ) : (
        <>
          <Catalogo categorias={categorias.datos} esAdmin={esAdmin} alCambiar={categorias.recargar} />
          <Seleccion categorias={categorias.datos} />
        </>
      )}
    </div>
  )
}

function Catalogo({
  categorias,
  esAdmin,
  alCambiar,
}: {
  categorias: Categoria[]
  esAdmin: boolean
  alCambiar: () => void
}) {
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const porId = new Map(categorias.map((c) => [c.id, c]))

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-verde-oscuro">Categorías</h2>
        {esAdmin && !editando && (
          <Boton variante="secundario" icono="mas" onClick={() => setEditando('nueva')}>
            Nueva categoría
          </Boton>
        )}
      </div>
      {mensaje && (
        <Aviso tipo="exito" className="mt-3">
          <p>{mensaje}</p>
        </Aviso>
      )}
      {editando && (
        <FormularioCategoria
          categoria={editando === 'nueva' ? null : editando}
          categorias={categorias}
          alCancelar={() => setEditando(null)}
          alGuardar={(texto) => {
            setEditando(null)
            setMensaje(texto)
            alCambiar()
          }}
        />
      )}
      {categorias.length === 0 ? (
        <p className="mt-3 text-suave">
          Todavía no hay categorías.
          {esAdmin ? ' Crea la primera para empezar a etiquetar casos.' : ' La dirección las define.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-linea/70">
          {categorias.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  {c.color && (
                    <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: c.color }} />
                  )}
                  <code className="text-sm font-semibold text-naranja-texto">{c.codigo}</code>
                  <span className="font-semibold text-texto">{c.nombre}</span>
                  {!c.activa && <Insignia color="gris">Inactiva</Insignia>}
                </span>
                <span className="block text-sm text-suave">
                  {c.padreId && porId.get(c.padreId) ? `Dentro de ${porId.get(c.padreId)!.codigo} · ` : ''}
                  {c.casos} {c.casos === 1 ? 'caso' : 'casos'} ·{' '}
                  {c.etiquetasCaso + c.etiquetasDiagnostico + c.etiquetasSesion} etiquetas
                </span>
              </span>
              {esAdmin && !editando && (
                <Boton variante="texto" icono="editar" onClick={() => setEditando(c)}>
                  Editar<span className="sr-only"> {c.codigo}</span>
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

function FormularioCategoria({
  categoria,
  categorias,
  alGuardar,
  alCancelar,
}: {
  categoria: Categoria | null
  categorias: Categoria[]
  alGuardar: (mensaje: string) => void
  alCancelar: () => void
}) {
  const [codigo, setCodigo] = useState(categoria?.codigo ?? '')
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? '')
  const [padreId, setPadreId] = useState(categoria?.padreId ?? '')
  const [color, setColor] = useState(categoria?.color ?? '#2E7D32')
  const [activa, setActiva] = useState(categoria?.activa ?? true)
  const [errores, setErrores] = useState<{ codigo?: string; nombre?: string }>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    const e: typeof errores = {}
    if (!categoria && !esCodigoCategoria(codigo.trim()))
      e.codigo = 'Usa letras, números y guiones (máx. 30), p. ej. COM-FAM.'
    if (!nombre.trim()) e.nombre = 'Escribe el nombre de la categoría.'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true)
    setFallo(null)
    const datos = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      padreId: padreId || null,
      color: color || null,
      activa,
    }
    try {
      if (categoria) await editarCategoria(categoria.id, datos)
      else await crearCategoria({ ...datos, codigo: codigo.trim() })
      alGuardar(categoria ? 'Categoría actualizada.' : 'Categoría creada.')
    } catch (error) {
      setFallo(
        error instanceof ErrorApi && error.estado === 409
          ? 'Ya existe una categoría con ese código.'
          : mensajeNoGuardado(error),
      )
      setGuardando(false)
    }
  }

  return (
    <form noValidate onSubmit={guardar} className="mt-4 space-y-4 rounded-2xl bg-crema p-4">
      <fieldset disabled={guardando} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">{categoria ? `Editar ${categoria.codigo}` : 'Nueva categoría'}</legend>
        <CampoTexto
          etiqueta="Código"
          value={codigo}
          readOnly={Boolean(categoria)}
          maxLength={30}
          error={errores.codigo}
          ayuda={
            categoria ? 'El código no cambia: identifica la categoría en Atlas.ti.' : 'Corto y estable, p. ej. COM-FAM.'
          }
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        />
        <CampoTexto
          etiqueta="Nombre"
          value={nombre}
          maxLength={100}
          error={errores.nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <AreaTexto
          etiqueta="Descripción"
          rows={2}
          value={descripcion}
          maxLength={1000}
          onChange={(e) => setDescripcion(e.target.value)}
          className="sm:col-span-2"
        />
        <CampoSeleccion etiqueta="Categoría superior" value={padreId} onChange={(e) => setPadreId(e.target.value)}>
          <option value="">Ninguna</option>
          {categorias
            .filter((c) => c.id !== categoria?.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} · {c.nombre}
              </option>
            ))}
        </CampoSeleccion>
        <CampoTexto
          etiqueta="Color"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="[&_input]:h-12"
        />
        {categoria && (
          <label className="flex items-center gap-3 text-texto sm:col-span-2">
            <input
              type="checkbox"
              className="size-4 accent-verde"
              checked={activa}
              onChange={(e) => setActiva(e.target.checked)}
            />
            Activa (si la desactivas no se puede asignar a casos nuevos, pero se conserva en lo ya etiquetado)
          </label>
        )}
      </fieldset>
      {fallo && (
        <Aviso tipo="error">
          <p>{fallo}</p>
        </Aviso>
      )}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" icono="guardar" cargando={guardando} textoCargando="Guardando…">
          Guardar categoría
        </Boton>
        <Boton variante="secundario" icono="cerrar" disabled={guardando} onClick={alCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}

const SIN_FILTROS: FiltrosSeleccion = { desde: '', hasta: '', residencias: [], categorias: [] }

function Seleccion({ categorias }: { categorias: Categoria[] }) {
  const navegar = useNavigate()
  const [filtros, setFiltros] = useState<FiltrosSeleccion>(SIN_FILTROS)
  const [aplicados, setAplicados] = useState<FiltrosSeleccion>(SIN_FILTROS)
  const resultado = useCarga(() => listarSeleccion(aplicados), [JSON.stringify(aplicados)])
  const [elegidos, setElegidos] = useState<string[]>([])
  const [secciones, setSecciones] = useState<SeccionInvestigacion[]>(['diagnostico', 'seguimiento'])
  const [formato, setFormato] = useState<'txt' | 'docx'>('docx')
  const [preparando, setPreparando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const refFallo = useRef<HTMLDivElement>(null)
  const casos = resultado.datos ?? []
  const visibles = new Set(casos.map((c) => c.casoId))
  const seleccion = elegidos.filter((id) => visibles.has(id))

  const alternar = <T,>(lista: T[], valor: T, si: boolean) =>
    si ? [...lista, valor] : lista.filter((x) => x !== valor)

  async function preparar() {
    if (preparando) return
    setFallo(null)
    if (seleccion.length === 0 || secciones.length === 0) {
      setFallo(seleccion.length === 0 ? 'Elige al menos un caso.' : 'Elige al menos una sección.')
      return requestAnimationFrame(() => refFallo.current?.focus())
    }
    setPreparando(true)
    try {
      const { exportacionId } = await prepararExportacion({
        casosIds: seleccion,
        secciones,
        formato,
        ...(aplicados.desde ? { desde: aplicados.desde } : {}),
        ...(aplicados.hasta ? { hasta: aplicados.hasta } : {}),
      })
      navegar(`/investigacion/exportaciones/${exportacionId}`)
    } catch (error) {
      setPreparando(false)
      setFallo(
        error instanceof ErrorApi && error.estado === 403
          ? 'Tu cuenta no puede exportar alguno de esos casos.'
          : mensajeNoGuardado(error).replace('No se guardó', 'No se preparó'),
      )
      requestAnimationFrame(() => refFallo.current?.focus())
    }
  }

  return (
    <Tarjeta>
      <h2 className="text-lg font-semibold text-verde-oscuro">Selección para Atlas.ti</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setAplicados(filtros)
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            etiqueta="Sesiones desde"
            type="date"
            value={filtros.desde}
            onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
          />
          <CampoTexto
            etiqueta="Sesiones hasta"
            type="date"
            value={filtros.hasta}
            onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
          />
        </div>
        <fieldset>
          <legend className="text-sm font-semibold text-texto">Residencia</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-2">
            {RESIDENCIAS.map((r) => (
              <label key={r.valor} className="flex items-center gap-2 text-texto">
                <input
                  type="checkbox"
                  className="size-4 accent-verde"
                  checked={filtros.residencias.includes(r.valor)}
                  onChange={(e) =>
                    setFiltros({ ...filtros, residencias: alternar(filtros.residencias, r.valor, e.target.checked) })
                  }
                />
                {r.nombre}
              </label>
            ))}
          </div>
        </fieldset>
        {categorias.length > 0 && (
          <fieldset>
            <legend className="text-sm font-semibold text-texto">Con alguna de estas categorías</legend>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-2">
              {categorias.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-texto">
                  <input
                    type="checkbox"
                    className="size-4 accent-verde"
                    checked={filtros.categorias.includes(c.id)}
                    onChange={(e) =>
                      setFiltros({ ...filtros, categorias: alternar(filtros.categorias, c.id, e.target.checked) })
                    }
                  />
                  {c.codigo}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Boton type="submit" variante="secundario" icono="buscar">
          Aplicar filtros
        </Boton>
      </form>

      <div className="mt-6">
        {resultado.error !== undefined ? (
          <ErrorDeCarga
            error={resultado.error}
            alReintentar={resultado.recargar}
            contexto="No se pudo consultar la selección."
          />
        ) : !resultado.datos ? (
          <Cargando texto="Buscando casos…" />
        ) : casos.length === 0 ? (
          <p role="status" className="rounded-2xl border border-dashed border-linea px-4 py-6 text-center text-suave">
            Ningún caso cumple esos filtros.
          </p>
        ) : (
          <fieldset aria-busy={resultado.cargando}>
            <legend className="text-sm font-semibold text-texto">
              Casos ({seleccion.length} de {casos.length} elegidos)
            </legend>
            <Boton
              variante="texto"
              className="-ml-2"
              onClick={() => setElegidos(seleccion.length === casos.length ? [] : casos.map((c) => c.casoId))}
            >
              {seleccion.length === casos.length ? 'Quitar todos' : 'Elegir todos'}
            </Boton>
            <ul className="mt-1 divide-y divide-linea/70 rounded-2xl border border-linea">
              {casos.map((c) => (
                <li key={c.casoId}>
                  <label className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-verde"
                      checked={seleccion.includes(c.casoId)}
                      onChange={(e) => setElegidos(alternar(seleccion, c.casoId, e.target.checked))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">
                        Carpeta {numeroCarpeta(c.numeroCorrelativo)} ({NOMBRE_TIPO[c.tipo]})
                      </span>
                      <span className="block text-sm text-suave">
                        {c.categorias.length ? c.categorias.join(', ') : 'Sin categorías'} · {c.sesionesEnPeriodo}{' '}
                        {c.sesionesEnPeriodo === 1 ? 'sesión' : 'sesiones'} en el período ·{' '}
                        {c.tieneDiagnostico ? 'con diagnóstico' : 'sin diagnóstico'}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </div>

      <div className="mt-6 space-y-4 border-t border-linea pt-5">
        <fieldset>
          <legend className="text-sm font-semibold text-texto">Qué se exporta de cada caso</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-2">
            {(Object.keys(NOMBRE_SECCION_INV) as SeccionInvestigacion[]).map((s) => (
              <label key={s} className="flex items-center gap-2 text-texto">
                <input
                  type="checkbox"
                  className="size-4 accent-verde"
                  checked={secciones.includes(s)}
                  onChange={(e) => setSecciones(alternar(secciones, s, e.target.checked))}
                />
                {NOMBRE_SECCION_INV[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <GrupoOpciones
          leyenda="Formato de los documentos"
          nombre="formato-investigacion"
          valor={formato}
          alCambiar={setFormato}
          opciones={[
            { valor: 'docx', nombre: 'Word (.docx)', descripcion: 'Atlas.ti conserva los títulos de cada sección.' },
            { valor: 'txt', nombre: 'Texto plano (.txt)', descripcion: 'El formato más simple y liviano.' },
          ]}
        />
        <Aviso tipo="info">
          <p className="font-semibold">Tratamiento de identificadores</p>
          <p>
            Cada caso sale con un código (INV-001, INV-002…). El paquete no incluye nombres, números de carpeta,
            teléfonos ni residencia, y las fechas de sesión quedan solo como mes. Antes de descargar podrás leer todo el
            contenido y confirmar que no queda un dato que identifique a alguien dentro de los textos.
          </p>
        </Aviso>
        {fallo && (
          <Aviso ref={refFallo} tipo="error">
            <p>{fallo}</p>
          </Aviso>
        )}
        <Boton icono="ojo" cargando={preparando} textoCargando="Preparando…" onClick={preparar}>
          Preparar y revisar ({seleccion.length} {seleccion.length === 1 ? 'caso' : 'casos'})
        </Boton>
      </div>
    </Tarjeta>
  )
}
