/**
 * API SIMULADA del Sprint 3. Imita los endpoints de los PR del backend con los mismos permisos, códigos y formas
 * de respuesta: familia y diagnóstico vigente (FE-126), genograma (FE-131), informes (FE-153), difusión y portal
 * público (FE-143), investigación (FE-169), importación histórica (FE-164) y exportación PDF/Word (FE-159).
 * Solo se usa en desarrollo (VITE_API_SIMULADA) y en las pruebas.
 */
import type { Rol } from '../../features/auth/tipos'
import type { ExpedienteSim } from './expediente'

export interface CasoSprint3 {
  id: string
  numero: number
  tipo: string
  estado: string
  clasificacion: string | null
  fechaIngreso: string
  paciente: { id: string; nombreCompleto: string; ciudadResidencia: string | null; otraLocalidad: string | null }
  asignacion: { perfilId: string } | null
}

export interface FamiliarSim {
  id: string
  parentesco: string
  parentescoDetalle: string | null
  nombreCompleto: string | null
  fechaNacimiento: string | null
  edadReferida: number | null
  fechaReferencia: string | null
  ocupacion: string | null
  lugarTrabajoEstudio: string | null
  conviveConPaciente: boolean | null
  observaciones: string | null
  creadoPor: string
  creadoEn: string
  actualizadoPor: string
  actualizadoEn: string
}

export interface GenogramaSim {
  nombre: string
  tipo: string
  tamanio: number
  autorId: string
  actualizadoEn: string
  /** Bytes en base64 (localStorage solo guarda texto). */
  contenido: string
}

export interface Sprint3Sim {
  familias: Record<string, { version: number; familiares: FamiliarSim[] }>
  genogramas: Record<string, GenogramaSim>
  // Las demás colecciones se agregan en las secciones de abajo.
  [otra: string]: unknown
}

export interface Contexto3 {
  yo: { id: string; rol: Rol }
  metodo: string
  ruta: string
  cuerpo: Record<string, unknown>
  /** Cuerpo multipart (FormData) cuando la petición lo trae. */
  formulario: FormData | null
  params: URLSearchParams
  casos: CasoSprint3[]
  perfiles: { id: string; nombreCompleto: string; rol: Rol; activo: boolean }[]
  expediente: ExpedienteSim
  estado: Sprint3Sim
  /** Último número de carpeta por tipo (contadores_caso). */
  contadores: Record<'voluntario' | 'derivado', number>
  json: (estado: number, cuerpo: unknown) => Response
  error: (estado: number, mensaje: string | string[], extra?: Record<string, unknown>) => Response
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA = /^\d{4}-\d{2}-\d{2}$/
export const ahora = () => new Date().toISOString()
export const hoy = () => {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}
export const fechaValida = (valor: unknown): valor is string => {
  if (typeof valor !== 'string' || !FECHA.test(valor)) return false
  const [a, m, d] = valor.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d))
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
}

export interface IdsIniciales {
  casos: { id: string }[]
  sofia: string
  direccion: string
  diego: string
}

/** Semillas de cada sección (informes, difusión…). Se registran junto a su sección. */
export const semillas: ((estado: Sprint3Sim, ids: IdsIniciales) => void)[] = []

/**
 * Carpeta 1 (Mariana, de Sofía): composición familiar del caso A de FE-123 (paciente de 12 años; padre, madre,
 * hermana y abuela materna), sin genograma. Las demás carpetas empiezan sin ficha familiar.
 */
export function estadoSprint3Inicial(ids: IdsIniciales): Sprint3Sim {
  const creado = '2026-10-12T15:00:00.000Z'
  const familiar = (n: number, datos: Partial<FamiliarSim>): FamiliarSim => ({
    id: `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    parentesco: 'otro',
    parentescoDetalle: null,
    nombreCompleto: null,
    fechaNacimiento: null,
    edadReferida: null,
    fechaReferencia: null,
    ocupacion: null,
    lugarTrabajoEstudio: null,
    conviveConPaciente: null,
    observaciones: null,
    creadoPor: ids.sofia,
    creadoEn: creado,
    actualizadoPor: ids.sofia,
    actualizadoEn: creado,
    ...datos,
  })
  const referida = (edad: number) => ({ edadReferida: edad, fechaReferencia: '2026-10-12' })
  const estado: Sprint3Sim = {
    familias: {
      [ids.casos[0].id]: {
        version: 1,
        familiares: [
          familiar(1, {
            parentesco: 'padre',
            nombreCompleto: 'Padre QA',
            ...referida(44),
            ocupacion: 'Conductor',
            lugarTrabajoEstudio: 'Empresa ficticia',
            conviveConPaciente: true,
          }),
          familiar(2, {
            parentesco: 'madre',
            nombreCompleto: 'Madre QA',
            ...referida(41),
            ocupacion: 'Comerciante',
            conviveConPaciente: true,
          }),
          familiar(3, {
            parentesco: 'hermana',
            nombreCompleto: 'Hermana QA',
            ...referida(8),
            ocupacion: 'Estudiante',
            conviveConPaciente: true,
          }),
          familiar(4, { parentesco: 'abuela_materna', ...referida(68), conviveConPaciente: false }),
        ],
      },
    },
    genogramas: {},
  }
  for (const sembrar of semillas) sembrar(estado, ids)
  return estado
}

/** Caso al que la cuenta tiene acceso clínico (administración o terapeuta asignada), o null → 404. */
export function casoAccesible(ctx: Contexto3, id: string) {
  const caso = ctx.casos.find((c) => c.id === id)
  if (!caso) return null
  return ctx.yo.rol === 'administrador' || (ctx.yo.rol === 'terapeuta' && caso.asignacion?.perfilId === ctx.yo.id)
    ? caso
    : null
}

const aBase64 = (bytes: Uint8Array) => {
  let texto = ''
  for (const b of bytes) texto += String.fromCharCode(b)
  return btoa(texto)
}
export const deBase64 = (texto: string) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))

/** Archivo binario como lo envía NestJS con StreamableFile. */
export function archivo(bytes: Uint8Array, tipo: string, nombre: string) {
  return new Response(bytes as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': tipo,
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

/** Devuelve la respuesta, o null si la ruta no es del Sprint 3. */
export async function atenderSprint3(ctx: Contexto3): Promise<Response | null> {
  const { ruta, metodo, yo, error } = ctx

  const clinica = ruta.match(/^\/carpetas\/([^/]+)\/(familia|genograma|diagnostico\/vigente)(\/archivo)?$/)
  if (clinica) {
    const [, casoId, apartado, sub] = clinica
    if (yo.rol === 'marketing') return error(403, 'No tienes permiso para realizar esta acción')
    if (!UUID.test(casoId)) return error(400, 'Validation failed (uuid is expected)')
    const caso = casoAccesible(ctx, casoId)
    if (!caso) return error(404, 'Caso no encontrado')
    if (apartado === 'familia' && !sub) {
      if (metodo === 'GET') return ctx.json(200, familia(ctx, caso))
      if (metodo === 'PUT') return guardarFamilia(ctx, caso)
    }
    if (apartado === 'diagnostico/vigente' && !sub && metodo === 'GET') return diagnosticoVigente(ctx, caso)
    if (apartado === 'genograma') {
      if (!sub && metodo === 'GET') return verGenograma(ctx, caso)
      if (!sub && metodo === 'PUT') return cargarGenograma(ctx, caso)
      if (sub && metodo === 'GET') return descargarGenograma(ctx, caso)
    }
  }

  for (const atender of manejadores) {
    const respuesta = await atender(ctx)
    if (respuesta) return respuesta
  }
  return null
}

/** Las secciones siguientes (informes, difusión, etc.) se registran aquí. */
export const manejadores: ((ctx: Contexto3) => Response | null | Promise<Response | null>)[] = []

// ---- FE-126 · Familia --------------------------------------------------------

const PARENTESCOS = [
  'madre',
  'padre',
  'hermano',
  'hermana',
  'hijo',
  'hija',
  'abuelo_materno',
  'abuela_materna',
  'abuelo_paterno',
  'abuela_paterna',
  'tio',
  'tia',
  'pareja',
  'tutor',
  'tutora',
  'otro',
]
const CAMPOS_FAMILIAR = [
  'parentesco',
  'parentescoDetalle',
  'nombreCompleto',
  'fechaNacimiento',
  'edadReferida',
  'fechaReferencia',
  'ocupacion',
  'lugarTrabajoEstudio',
  'conviveConPaciente',
  'observaciones',
] as const

function familia(ctx: Contexto3, caso: CasoSprint3) {
  const ficha = ctx.estado.familias[caso.id]
  return {
    casoId: caso.id,
    pacienteId: caso.paciente.id,
    registrada: Boolean(ficha),
    version: ficha?.version ?? null,
    familiares: ficha?.familiares ?? [],
  }
}

/** Mismas reglas que la base (015): si un integrante es inválido no se guarda ninguno (400). */
function valido(f: Omit<FamiliarSim, 'id' | 'creadoPor' | 'creadoEn' | 'actualizadoPor' | 'actualizadoEn'>) {
  const largo = (v: string | null, max: number) => v === null || (v.trim() !== '' && v.length <= max)
  return (
    PARENTESCOS.includes(f.parentesco) &&
    (f.parentesco === 'otro' ? Boolean(f.parentescoDetalle?.trim()) : f.parentescoDetalle === null) &&
    largo(f.nombreCompleto, 150) &&
    largo(f.ocupacion, 200) &&
    largo(f.lugarTrabajoEstudio, 150) &&
    largo(f.observaciones, 2000) &&
    (f.fechaNacimiento === null || (fechaValida(f.fechaNacimiento) && f.fechaNacimiento <= hoy())) &&
    (f.edadReferida === null) === (f.fechaReferencia === null) &&
    (f.fechaNacimiento === null || f.edadReferida === null) &&
    (f.edadReferida === null || (Number.isInteger(f.edadReferida) && f.edadReferida >= 0 && f.edadReferida <= 130)) &&
    (f.fechaReferencia === null || (fechaValida(f.fechaReferencia) && f.fechaReferencia <= hoy()))
  )
}

function guardarFamilia(ctx: Contexto3, caso: CasoSprint3) {
  const {
    version,
    familiares,
    eliminarIds = [],
  } = ctx.cuerpo as {
    version: unknown
    familiares: unknown
    eliminarIds?: unknown
  }
  if (!(version === null || (Number.isInteger(version) && (version as number) >= 1)) || !Array.isArray(familiares)) {
    return ctx.error(400, ['version must not be less than 1', 'familiares must be an array'])
  }
  if (!Array.isArray(eliminarIds) || eliminarIds.some((id) => typeof id !== 'string' || !UUID.test(id))) {
    return ctx.error(400, ['each value in eliminarIds must be a UUID'])
  }
  const ficha = ctx.estado.familias[caso.id]
  if (version !== (ficha?.version ?? null)) {
    return ctx.error(409, 'La ficha familiar cambió. Vuelve a consultarla antes de guardar.')
  }
  const ids = [...familiares.flatMap((f: { id?: string }) => (f.id ? [f.id] : [])), ...(eliminarIds as string[])]
  if (new Set(ids).size !== ids.length)
    return ctx.error(400, 'Un familiar solo puede aparecer una vez en la solicitud.')

  // Se trabaja sobre una copia: un error deja la ficha como estaba (transacción).
  const lista = (ficha?.familiares ?? []).map((f) => ({ ...f }))
  const momento = ahora()
  for (const entrada of familiares as Record<string, unknown>[]) {
    const existente = entrada.id ? lista.find((f) => f.id === entrada.id) : undefined
    if (entrada.id && !existente) return ctx.error(404, 'Familiar no encontrado en el caso')
    const base = existente ?? {
      id: crypto.randomUUID(),
      parentesco: '',
      parentescoDetalle: null,
      nombreCompleto: null,
      fechaNacimiento: null,
      edadReferida: null,
      fechaReferencia: null,
      ocupacion: null,
      lugarTrabajoEstudio: null,
      conviveConPaciente: null,
      observaciones: null,
      creadoPor: ctx.yo.id,
      creadoEn: momento,
      actualizadoPor: ctx.yo.id,
      actualizadoEn: momento,
    }
    const nuevo: FamiliarSim = { ...base }
    for (const campo of CAMPOS_FAMILIAR) {
      if (!(campo in entrada)) continue // omitido: se conserva
      const valor = entrada[campo]
      ;(nuevo as unknown as Record<string, unknown>)[campo] = typeof valor === 'string' ? valor.trim() || null : valor
    }
    if (!valido(nuevo)) return ctx.error(400, 'Revisa las fechas, la edad y los datos de parentesco de los familiares.')
    nuevo.actualizadoPor = ctx.yo.id
    nuevo.actualizadoEn = momento
    if (existente) lista.splice(lista.indexOf(existente), 1, nuevo)
    else lista.push(nuevo)
  }
  for (const id of eliminarIds as string[]) {
    const i = lista.findIndex((f) => f.id === id)
    if (i < 0) return ctx.error(404, 'Familiar no encontrado en el caso')
    lista.splice(i, 1)
  }
  ctx.estado.familias[caso.id] = { version: (ficha?.version ?? 0) + 1, familiares: lista }
  return ctx.json(200, familia(ctx, caso))
}

function diagnosticoVigente(ctx: Contexto3, caso: CasoSprint3) {
  const ficha = ctx.expediente.diagnosticos.find((d) => d.casoId === caso.id)
  const alta = { diagnosticoIngreso: null, hipotesisRelacional: null, comentariosClinicos: null }
  if (!ficha) {
    return ctx.json(200, {
      origen: 'sin_datos',
      fichaId: null,
      fichaFecha: null,
      diagnosticoIngreso: null,
      hipotesisRelacional: null,
      comentariosClinicos: null,
      alta,
    })
  }
  return ctx.json(200, {
    origen: 'ficha',
    fichaId: ficha.id,
    fichaFecha: ficha.fecha,
    diagnosticoIngreso: ficha.diagnosticoIngreso,
    hipotesisRelacional: ficha.hipotesisRelacional,
    comentariosClinicos: ficha.comentariosClinicos,
    alta,
  })
}

// ---- FE-131 · Genograma ------------------------------------------------------

const LIMITE = 5 * 1024 * 1024
const FIRMAS: { tipo: string; firma: number[] }[] = [
  { tipo: 'application/pdf', firma: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { tipo: 'image/png', firma: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { tipo: 'image/jpeg', firma: [0xff, 0xd8, 0xff] },
]

function verGenograma(ctx: Contexto3, caso: CasoSprint3) {
  const g = ctx.estado.genogramas[caso.id]
  if (!g) return ctx.error(404, 'Genograma no encontrado')
  return ctx.json(200, {
    nombre: g.nombre,
    tipo: g.tipo,
    tamanio: g.tamanio,
    autorId: g.autorId,
    actualizadoEn: g.actualizadoEn,
  })
}

function descargarGenograma(ctx: Contexto3, caso: CasoSprint3) {
  const g = ctx.estado.genogramas[caso.id]
  if (!g) return ctx.error(404, 'Genograma no encontrado')
  return archivo(deBase64(g.contenido), g.tipo, g.nombre.replace(/[^a-zA-Z0-9._-]/g, '_'))
}

/** Igual que validarArchivoGenograma: tamaño (413), firma real del archivo y tipo declarado (415). */
async function cargarGenograma(ctx: Contexto3, caso: CasoSprint3) {
  const recibido = ctx.formulario?.get('archivo')
  if (!recibido || typeof recibido === 'string' || recibido.size === 0) {
    return ctx.error(400, 'Adjunta un archivo de genograma')
  }
  if (recibido.size > LIMITE) return ctx.error(413, 'File too large')
  const bytes = new Uint8Array(await recibido.arrayBuffer())
  const formato = FIRMAS.find(({ firma }) => firma.every((b, i) => bytes[i] === b))
  if (!formato || formato.tipo !== recibido.type) return ctx.error(415, 'El archivo debe ser PDF, PNG o JPEG')
  ctx.estado.genogramas[caso.id] = {
    nombre: recibido.name,
    tipo: formato.tipo,
    tamanio: bytes.length,
    autorId: ctx.yo.id,
    actualizadoEn: ahora(),
    contenido: aBase64(bytes),
  }
  return new Response(null, { status: 204 })
}

// ---- FE-143 · Difusión (administración y marketing) y portal público -----------------

interface RecursoSim {
  id: string
  ruta: string
  tipoMime: string
  tamanoBytes: number
  textoAlternativo: string
  ancho: number | null
  alto: number | null
  principal: boolean
}

export interface PublicacionSim {
  id: string
  tipo: string
  titulo: string
  resumen: string | null
  contenido: string | null
  estado: 'borrador' | 'publicado' | 'retirado'
  fechaInicio: string | null
  fechaFin: string | null
  modalidad: string | null
  lugar: string | null
  contactoUrl: string | null
  creadoPor: string | null
  actualizadoPor: string | null
  publicadoEn: string | null
  retiradoEn: string | null
  actualizadoEn: string
  recursos: RecursoSim[]
}

const publicaciones = (ctx: { estado: Sprint3Sim }) => ctx.estado.publicaciones as PublicacionSim[]
const TIPOS_PUB = ['campana', 'actividad', 'curso']
const MODALIDADES = ['presencial', 'virtual', 'mixta']
const ANTERIOR: Record<string, string> = { publicado: 'borrador', retirado: 'publicado', borrador: 'retirado' }

/** Publicaciones de demostración de FE-141 (docs/contenido/difusion/publicaciones-demostracion.json). */
semillas.push((estado, ids) => {
  const pub = (n: number, datos: Partial<PublicacionSim>): PublicacionSim => ({
    id: `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    tipo: 'actividad',
    titulo: '',
    resumen: null,
    contenido: null,
    estado: 'borrador',
    fechaInicio: null,
    fechaFin: null,
    modalidad: null,
    lugar: null,
    contactoUrl: null,
    creadoPor: ids.diego,
    actualizadoPor: ids.diego,
    publicadoEn: null,
    retiradoEn: null,
    actualizadoEn: '2026-11-20T15:00:00.000Z',
    recursos: [],
    ...datos,
  })
  estado.publicaciones = [
    pub(1, {
      tipo: 'campana',
      titulo: '[DEMO QA] Campaña ficticia de sensibilización',
      resumen: 'Texto de prueba de una campaña. No describe ninguna campaña real de la Fundación.',
      contenido: 'Contenido de ejemplo para revisar el portal. Sin datos de pacientes.',
      estado: 'publicado',
      fechaInicio: '2026-12-01',
      fechaFin: '2026-12-15',
      modalidad: 'mixta',
      lugar: 'Lugar ficticio de QA',
      contactoUrl: 'https://ejemplo.invalid/contacto-qa',
      publicadoEn: '2026-11-21T14:00:00.000Z',
    }),
    pub(2, {
      titulo: '[DEMO QA] Actividad ficticia',
      resumen: 'Texto de prueba para revisar el portal.',
      contenido: 'Ejemplo sin datos de pacientes.',
      fechaInicio: '2026-12-01',
      fechaFin: '2026-12-01',
      modalidad: 'presencial',
      lugar: 'Lugar ficticio de QA',
    }),
    pub(3, {
      tipo: 'curso',
      titulo: '[DEMO QA] Curso ficticio',
      resumen: 'Texto de prueba de un curso. No implica inscripción, cobro ni reserva.',
      estado: 'publicado',
      modalidad: 'virtual',
      publicadoEn: '2026-11-22T14:00:00.000Z',
    }),
    pub(4, {
      tipo: 'campana',
      titulo: '[DEMO QA] Campaña ficticia retirada',
      resumen: 'Texto de prueba de una publicación retirada.',
      estado: 'retirado',
      publicadoEn: '2026-11-10T14:00:00.000Z',
      retiradoEn: '2026-11-18T14:00:00.000Z',
    }),
    pub(5, { titulo: '[DEMO QA] Actividad ficticia incompleta' }),
  ]
})

function admin(p: PublicacionSim, conRecursos = false) {
  const { recursos, actualizadoEn: _orden, ...resto } = p
  return conRecursos ? { ...resto, recursos } : resto
}

function publica(p: PublicacionSim) {
  const principal = p.recursos.find((r) => r.principal)
  return {
    id: p.id,
    tipo: p.tipo,
    titulo: p.titulo,
    resumen: p.resumen,
    contenido: p.contenido,
    fechaInicio: p.fechaInicio,
    fechaFin: p.fechaFin,
    modalidad: p.modalidad,
    lugar: p.lugar,
    contactoUrl: p.contactoUrl,
    publicadoEn: p.publicadoEn,
    imagen: principal
      ? {
          ruta: principal.ruta,
          textoAlternativo: principal.textoAlternativo,
          ancho: principal.ancho,
          alto: principal.alto,
        }
      : null,
  }
}

function paginar<T>(lista: T[], params: URLSearchParams) {
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)
  const tamano = Math.min(100, Math.max(1, Number(params.get('tamano')) || 10))
  return { elementos: lista.slice((pagina - 1) * tamano, pagina * tamano), total: lista.length, pagina, tamano }
}

/** Rutas @Public: se atienden antes del guard de sesión. */
export function atenderPublico(ctx: Pick<Contexto3, 'metodo' | 'ruta' | 'params' | 'estado' | 'json' | 'error'>) {
  if (ctx.metodo !== 'GET') return null
  if (ctx.ruta === '/publico/publicaciones') {
    const tipo = ctx.params.get('tipo')
    if (tipo !== null && !TIPOS_PUB.includes(tipo))
      return ctx.error(400, ['tipo must be one of the following values: campana, actividad, curso'])
    const lista = publicaciones(ctx)
      .filter((p) => p.estado === 'publicado' && (!tipo || p.tipo === tipo))
      .sort((a, b) => (b.publicadoEn ?? '').localeCompare(a.publicadoEn ?? ''))
    const { elementos, ...resto } = paginar(lista, ctx.params)
    return ctx.json(200, { publicaciones: elementos.map(publica), ...resto })
  }
  const una = ctx.ruta.match(/^\/publico\/publicaciones\/([^/]+)$/)
  if (una) {
    if (!UUID.test(una[1])) return ctx.error(400, 'Validation failed (uuid is expected)')
    const p = publicaciones(ctx).find((x) => x.id === una[1] && x.estado === 'publicado')
    return p ? ctx.json(200, publica(p)) : ctx.error(404, 'Publicación no encontrada')
  }
  return null
}

function leerPublicacion(ctx: Contexto3) {
  const c = ctx.cuerpo
  const texto = (v: unknown, max: number) =>
    v === undefined || v === null ? null : typeof v === 'string' && v.length <= max ? v.trim() || null : false
  const datos = {
    tipo: c.tipo,
    titulo: typeof c.titulo === 'string' && c.titulo.trim() && c.titulo.length <= 150 ? c.titulo.trim() : false,
    resumen: texto(c.resumen, 500),
    contenido: texto(c.contenido, 10000),
    fechaInicio: c.fechaInicio ?? null,
    fechaFin: c.fechaFin ?? null,
    modalidad: c.modalidad ?? null,
    lugar: texto(c.lugar, 200),
    contactoUrl: texto(c.contactoUrl, 500),
  }
  const errores: string[] = []
  if (!TIPOS_PUB.includes(datos.tipo as string))
    errores.push('tipo must be one of the following values: campana, actividad, curso')
  if (datos.titulo === false) errores.push('titulo must match /\\S/ regular expression')
  for (const k of ['resumen', 'contenido', 'lugar', 'contactoUrl'] as const)
    if (datos[k] === false) errores.push(`${k} is too long`)
  for (const k of ['fechaInicio', 'fechaFin'] as const)
    if (datos[k] !== null && !fechaValida(datos[k])) errores.push(`${k} must be a valid ISO 8601 date string`)
  if (datos.modalidad !== null && !MODALIDADES.includes(datos.modalidad as string))
    errores.push('modalidad must be one of the following values: presencial, virtual, mixta')
  if (typeof datos.contactoUrl === 'string' && !/^https?:\/\/[^\s/]+\.[^\s]+$/.test(datos.contactoUrl))
    errores.push('contactoUrl must be a URL address')
  if (errores.length) return { error: ctx.error(400, errores) }
  if (datos.fechaInicio && datos.fechaFin && (datos.fechaFin as string) < (datos.fechaInicio as string)) {
    return { error: ctx.error(400, 'La fecha de fin no puede ser anterior al inicio') }
  }
  return {
    datos: datos as Omit<
      PublicacionSim,
      'id' | 'estado' | 'creadoPor' | 'actualizadoPor' | 'publicadoEn' | 'retiradoEn' | 'actualizadoEn' | 'recursos'
    >,
  }
}

manejadores.push((ctx) => {
  const m = ctx.ruta.match(/^\/difusion\/publicaciones(?:\/([^/]+))?(\/estado|\/recursos(?:\/([^/]+))?)?$/)
  if (!m) return null
  if (ctx.yo.rol !== 'administrador' && ctx.yo.rol !== 'marketing') {
    return ctx.error(403, 'No tienes permiso para realizar esta acción')
  }
  const [, id, sub, recursoId] = m
  if ((id && !UUID.test(id)) || (recursoId && !UUID.test(recursoId)))
    return ctx.error(400, 'Validation failed (uuid is expected)')
  const lista = publicaciones(ctx)

  if (!id) {
    if (ctx.metodo === 'GET') {
      const estado = ctx.params.get('estado')
      const tipo = ctx.params.get('tipo')
      const filtradas = lista
        .filter((p) => (!estado || p.estado === estado) && (!tipo || p.tipo === tipo))
        .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
      const { elementos, ...resto } = paginar(filtradas, ctx.params)
      return ctx.json(200, { publicaciones: elementos.map((p) => admin(p)), ...resto })
    }
    if (ctx.metodo === 'POST') {
      const leido = leerPublicacion(ctx)
      if (leido.error) return leido.error
      const nueva: PublicacionSim = {
        id: crypto.randomUUID(),
        ...leido.datos,
        estado: 'borrador',
        creadoPor: ctx.yo.id,
        actualizadoPor: ctx.yo.id,
        publicadoEn: null,
        retiradoEn: null,
        actualizadoEn: ahora(),
        recursos: [],
      }
      lista.push(nueva)
      return ctx.json(201, admin(nueva))
    }
    return null
  }

  const p = lista.find((x) => x.id === id)
  if (!p) return ctx.error(404, 'Publicación no encontrada')

  if (!sub) {
    if (ctx.metodo === 'GET') return ctx.json(200, admin(p, true))
    if (ctx.metodo === 'PUT') {
      const leido = leerPublicacion(ctx)
      if (leido.error) return leido.error
      Object.assign(p, leido.datos, { actualizadoPor: ctx.yo.id, actualizadoEn: ahora() })
      return ctx.json(200, admin(p))
    }
  }
  if (sub === '/estado' && ctx.metodo === 'PATCH') {
    const estado = ctx.cuerpo.estado as string
    if (!(estado in ANTERIOR))
      return ctx.error(400, ['estado must be one of the following values: borrador, publicado, retirado'])
    if (p.estado !== ANTERIOR[estado]) return ctx.error(409, 'El cambio de estado no está permitido')
    if (estado === 'publicado' && !p.resumen?.trim()) {
      return ctx.error(422, 'Faltan datos para publicar', { camposFaltantes: ['resumen'] })
    }
    p.estado = estado as PublicacionSim['estado']
    if (estado === 'publicado') p.publicadoEn = ahora()
    if (estado === 'retirado') p.retiradoEn = ahora()
    p.actualizadoPor = ctx.yo.id
    p.actualizadoEn = ahora()
    return ctx.json(200, admin(p))
  }
  if (sub === '/recursos' && ctx.metodo === 'POST') {
    const r = ctx.cuerpo as Record<string, unknown>
    const errores: string[] = []
    if (typeof r.ruta !== 'string' || !/^(?!.*\.\.)[A-Za-z0-9_-][A-Za-z0-9/_.-]*$/.test(r.ruta))
      errores.push('ruta must match regular expression')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(r.tipoMime as string))
      errores.push('tipoMime must be one of the following values')
    if (
      !Number.isInteger(r.tamanoBytes) ||
      (r.tamanoBytes as number) < 1 ||
      (r.tamanoBytes as number) > 5 * 1024 * 1024
    )
      errores.push('tamanoBytes must not be greater than 5242880')
    if (typeof r.textoAlternativo !== 'string' || !r.textoAlternativo.trim())
      errores.push('textoAlternativo must match /\\S/ regular expression')
    if (errores.length) return ctx.error(400, errores)
    if (
      lista.some((x) => x.recursos.some((y) => y.ruta === r.ruta)) ||
      (r.principal && p.recursos.some((y) => y.principal))
    ) {
      return ctx.error(409, 'La ruta ya está registrada o ya existe una imagen principal')
    }
    const recurso: RecursoSim = {
      id: crypto.randomUUID(),
      ruta: r.ruta as string,
      tipoMime: r.tipoMime as string,
      tamanoBytes: r.tamanoBytes as number,
      textoAlternativo: (r.textoAlternativo as string).trim(),
      ancho: (r.ancho as number) ?? null,
      alto: (r.alto as number) ?? null,
      principal: Boolean(r.principal),
    }
    p.recursos.push(recurso)
    return ctx.json(201, recurso)
  }
  if (sub?.startsWith('/recursos/') && ctx.metodo === 'DELETE') {
    const i = p.recursos.findIndex((x) => x.id === recursoId)
    if (i < 0) return ctx.error(404, 'Recurso no encontrado en la publicación')
    p.recursos.splice(i, 1)
    return new Response(null, { status: 204 })
  }
  return null
})

// ---- FE-153 · Informes (solo la terapeuta asignada) ---------------------------------

interface InformeSim {
  id: string
  informeId: string
  casoId: string
  tipo: 'intervencion_sistemica' | 'judicial'
  nroVersion: number
  versionPlantilla: string
  estado: 'borrador' | 'revisado'
  secciones: { titulo: string; contenido: string }[]
  creadoPor: string
  creadoEn: string
  revisadoPor: string | null
  revisadoEn: string | null
}

semillas.push((estado) => {
  estado.informes = []
  estado.exportaciones = []
})

const informes = (ctx: Contexto3) => ctx.estado.informes as InformeSim[]

function generarInformeSim(ctx: Contexto3, caso: CasoSprint3) {
  const c = ctx.cuerpo as {
    tipo?: string
    sesionesIds?: unknown
    incluirFamilia?: unknown
    incluirGenograma?: unknown
    objeto?: unknown
  }
  if (c.tipo !== 'intervencion_sistemica' && c.tipo !== 'judicial') {
    return ctx.error(400, ['tipo must be one of the following values: intervencion_sistemica, judicial'])
  }
  const ids = Array.isArray(c.sesionesIds) ? (c.sesionesIds as string[]) : []
  const sesiones = ctx.expediente.sesiones
    .filter((s) => s.casoId === caso.id && ids.includes(s.id))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const terapeuta = ctx.perfiles.find((p) => p.id === caso.asignacion?.perfilId)?.nombreCompleto ?? 'Sin asignar'
  const diag = ctx.expediente.diagnosticos.find((d) => d.casoId === caso.id)
  const seguimiento = sesiones.map((s) => `Sesión ${s.numero} (${s.fecha}): ${s.evolucion}`).join('\n')
  const familia = c.incluirFamilia
    ? (ctx.estado.familias[caso.id]?.familiares ?? [])
        .map((f) => `${f.parentesco}: ${f.nombreCompleto ?? 'sin nombre'}`)
        .join('\n')
    : ''
  let secciones: InformeSim['secciones']
  if (c.tipo === 'judicial') {
    const juzgado = ctx.expediente.constancias.find((k) => k.casoId === caso.id)?.contextoJudicial?.juzgado ?? ''
    const objeto = typeof c.objeto === 'string' ? c.objeto.trim() : ''
    const faltan = [!juzgado && 'judicial.juzgado', !objeto && 'objeto'].filter(Boolean)
    if (faltan.length) {
      return ctx.error(422, 'Faltan datos para generar el informe.', {
        codigo: 'INFORME_DATOS_INSUFICIENTES',
        camposFaltantes: faltan,
      })
    }
    secciones = [
      { titulo: 'Destinatario', contenido: juzgado },
      { titulo: 'Identificación', contenido: caso.paciente.nombreCompleto },
      { titulo: 'Profesional responsable', contenido: terapeuta },
      { titulo: 'Objeto del informe', contenido: objeto },
      { titulo: 'Intervención y observaciones', contenido: seguimiento || 'Sin sesiones seleccionadas.' },
      { titulo: 'Conclusiones', contenido: 'Pendiente de redacción profesional.' },
    ]
  } else {
    secciones = [
      { titulo: 'Identificación', contenido: caso.paciente.nombreCompleto },
      { titulo: 'Profesional responsable', contenido: terapeuta },
      ...(familia ? [{ titulo: 'Composición familiar', contenido: familia }] : []),
      { titulo: 'Evaluación', contenido: diag?.diagnosticoIngreso || 'Sin datos registrados.' },
      { titulo: 'Intervención y evolución', contenido: seguimiento || 'Sin sesiones seleccionadas.' },
      { titulo: 'Conclusiones y recomendaciones', contenido: 'Pendiente de redacción profesional.' },
    ]
  }
  const version: InformeSim = {
    id: crypto.randomUUID(),
    informeId: crypto.randomUUID(),
    casoId: caso.id,
    tipo: c.tipo,
    nroVersion: 1,
    versionPlantilla: c.tipo === 'judicial' ? 'fe151-judicial-v1' : 'fe151-sistemica-v1',
    estado: 'borrador',
    secciones,
    creadoPor: ctx.yo.id,
    creadoEn: ahora(),
    revisadoPor: null,
    revisadoEn: null,
  }
  informes(ctx).push(version)
  return ctx.json(201, {
    id: version.id,
    informeId: version.informeId,
    nroVersion: 1,
    estado: 'borrador',
    creadoPor: ctx.yo.id,
  })
}

manejadores.push((ctx) => {
  const m = ctx.ruta.match(/^\/carpetas\/([^/]+)\/informes(?:\/([^/]+))?(\/revision)?$/)
  if (!m) return null
  if (ctx.yo.rol !== 'terapeuta') return ctx.error(403, 'No tienes permiso para realizar esta acción')
  const [, casoId, versionId, revision] = m
  if (!UUID.test(casoId) || (versionId && !UUID.test(versionId)))
    return ctx.error(400, 'Validation failed (uuid is expected)')
  const caso = casoAccesible(ctx, casoId)
  if (!caso) return ctx.error(404, 'Caso no encontrado')
  if (!versionId && ctx.metodo === 'POST') return generarInformeSim(ctx, caso)
  const version = informes(ctx).find((v) => v.id === versionId && v.casoId === caso.id)
  if (versionId && !revision && ctx.metodo === 'GET') {
    if (!version) return ctx.error(404, 'Versión de informe no encontrada')
    const { casoId: _caso, ...resto } = version
    return ctx.json(200, resto)
  }
  if (versionId && revision && ctx.metodo === 'PATCH') {
    const secciones = (ctx.cuerpo as { secciones?: unknown }).secciones
    if (
      !Array.isArray(secciones) ||
      secciones.length === 0 ||
      secciones.some((s) => typeof s?.titulo !== 'string' || !s.titulo.trim() || typeof s?.contenido !== 'string')
    ) {
      return ctx.error(400, ['secciones should not be empty'])
    }
    if (!version) return ctx.error(404, 'Versión de informe no encontrada')
    if (version.estado !== 'borrador') return ctx.error(409, 'Esta versión del informe ya fue revisada')
    Object.assign(version, { secciones, estado: 'revisado', revisadoPor: ctx.yo.id, revisadoEn: ahora() })
    return ctx.json(200, { id: version.id, estado: 'revisado', revisadoPor: ctx.yo.id, revisadoEn: version.revisadoEn })
  }
  return null
})

// ---- FE-159 · Exportación a PDF y Word ------------------------------------------------

interface ExportacionSim {
  id: string
  casoId: string
  autorId: string
  formato: 'pdf' | 'docx'
  nombre: string
  contenido: string
}

const PERMITIDAS: Record<string, string[]> = {
  ficha: ['identificacion', 'familia', 'diagnostico'],
  historial: ['identificacion', 'familia', 'diagnostico', 'sesiones'],
}

manejadores.push((ctx) => {
  const m = ctx.ruta.match(/^\/carpetas\/([^/]+)\/exportaciones(?:\/([^/]+)\/archivo)?$/)
  if (!m) return null
  if (ctx.yo.rol !== 'administrador' && ctx.yo.rol !== 'terapeuta') return ctx.error(403, 'Forbidden resource')
  const [, casoId, exportacionId] = m
  if (!UUID.test(casoId) || (exportacionId && !UUID.test(exportacionId)))
    return ctx.error(400, 'Validation failed (uuid is expected)')
  const caso = casoAccesible(ctx, casoId)
  const lista = ctx.estado.exportaciones as ExportacionSim[]

  if (exportacionId && ctx.metodo === 'GET') {
    const e = lista.find((x) => x.id === exportacionId && x.casoId === casoId)
    if (!caso || !e) return ctx.error(404, 'Exportación no encontrada')
    return archivo(
      deBase64(e.contenido),
      e.formato === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      e.nombre,
    )
  }
  if (exportacionId || ctx.metodo !== 'POST') return null

  const p = ctx.cuerpo as {
    documento?: string
    formato?: string
    secciones?: string[]
    informeVersionId?: string
    incluirPagos?: boolean
    incluirGenograma?: boolean
  }
  if (!['informe', 'ficha', 'historial'].includes(p.documento ?? '') || !['pdf', 'docx'].includes(p.formato ?? '')) {
    return ctx.error(400, 'La selección de exportación es inválida.')
  }
  if (p.incluirPagos && ctx.yo.rol !== 'administrador')
    return ctx.error(403, 'No tienes permiso para esta exportación.')
  if (!caso) return ctx.error(404, 'Caso o versión del informe no disponible.')
  if (p.incluirGenograma) return ctx.error(409, 'El genograma aún no está disponible para exportar.')
  if (p.documento === 'informe') {
    const v = informes(ctx).find((x) => x.id === p.informeVersionId && x.casoId === casoId)
    if (!v || p.secciones?.length || p.incluirPagos)
      return ctx.error(
        v ? 400 : 404,
        v ? 'La selección de exportación es inválida.' : 'Caso o versión del informe no disponible.',
      )
    if (v.estado !== 'revisado')
      return ctx.error(409, 'Revisa que el informe esté revisado o actualiza la vista previa.')
  } else {
    if (p.informeVersionId) return ctx.error(400, 'La selección de exportación es inválida.')
    const secciones = p.secciones ?? []
    if (
      Array.isArray(p.secciones) &&
      (secciones.length === 0 || secciones.some((s) => !PERMITIDAS[p.documento!].includes(s)))
    ) {
      return ctx.error(400, 'La selección de exportación es inválida.')
    }
    if (p.incluirPagos && p.documento !== 'historial') return ctx.error(400, 'La selección de exportación es inválida.')
  }
  const texto =
    p.formato === 'pdf' ? `%PDF-1.7\n% ${p.documento} de prueba (QA)\n` : `PK\u0003\u0004 ${p.documento} de prueba (QA)`
  const e: ExportacionSim = {
    id: crypto.randomUUID(),
    casoId,
    autorId: ctx.yo.id,
    formato: p.formato as 'pdf' | 'docx',
    nombre: `${p.documento}-${caso.numero}.${p.formato}`,
    contenido: btoa(texto),
  }
  lista.push(e)
  return ctx.json(201, { exportacionId: e.id })
})

// ---- FE-164 · Importación histórica (solo administración) ------------------------------

const COLUMNAS_IMPORTACION = [
  'referenciaOrigen',
  'nombreCompleto',
  'fechaNacimiento',
  'edadAlIngreso',
  'telefono',
  'tipo',
  'numeroCorrelativo',
  'fechaIngreso',
  'clasificacion',
  'ciudadResidencia',
  'otraLocalidad',
  'diagnosticoIngreso',
  'hipotesisRelacional',
  'comentariosClinicos',
  'estado',
  'juzgado',
  'nroExpediente',
  'fechaDerivacion',
]

interface FilaLoteSim {
  numeroFila: number
  referenciaOrigen: string | null
  datos: Record<string, string | null>
  estado: string
  errores: { campo: string; mensaje: string }[]
  advertencias: { tipo: string; mensaje: string }[]
  coincidencias: Record<string, unknown>[]
  decision: string | null
  destino: { pacienteDestinoId?: string; casoDestinoId?: string; filaDestino?: number } | null
  resultado: string | null
  casoId: string | null
  pacienteId: string | null
}

interface LoteSim {
  loteId: string
  version: number
  estado: 'en_revision' | 'confirmada'
  archivoNombre: string
  origen: string | null
  huella: string
  filas: FilaLoteSim[]
  confirmadaEn: string | null
}

semillas.push((estado) => {
  estado.importaciones = []
})

/** CSV con comas y comillas dobles, como csv-parse. */
function leerCsv(texto: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') comillas = false
      else campo += c
    } else if (c === '"') comillas = true
    else if (c === ',') {
      fila.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo)
      if (fila.some((x) => x !== '')) filas.push(fila)
      fila = []
      campo = ''
    } else campo += c
  }
  if (campo || fila.length) {
    fila.push(campo)
    if (fila.some((x) => x !== '')) filas.push(fila)
  }
  return filas
}

const texto = (d: Record<string, string | null>, k: string) => d[k]?.trim() || null
const normalizarNombre = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Subconjunto de validar_fila_importacion (migración 017) con los mismos mensajes. */
function validarFilaSim(d: Record<string, string | null>) {
  const e: { campo: string; mensaje: string }[] = []
  const tipo = texto(d, 'tipo')
  if (!texto(d, 'nombreCompleto')) e.push({ campo: 'nombreCompleto', mensaje: 'Falta el nombre del paciente' })
  if (!tipo) e.push({ campo: 'tipo', mensaje: 'Falta el origen del caso' })
  else if (tipo !== 'voluntario' && tipo !== 'derivado')
    e.push({ campo: 'tipo', mensaje: 'El origen debe ser voluntario o derivado' })
  const ingreso = texto(d, 'fechaIngreso')
  if (!ingreso) e.push({ campo: 'fechaIngreso', mensaje: 'Falta la fecha de ingreso' })
  else if (!fechaValida(ingreso)) e.push({ campo: 'fechaIngreso', mensaje: 'Fecha inválida, use AAAA-MM-DD' })
  else if (ingreso < '1990-01-01' || ingreso > hoy())
    e.push({ campo: 'fechaIngreso', mensaje: 'La fecha de ingreso debe estar entre 1990-01-01 y hoy' })
  const numero = texto(d, 'numeroCorrelativo')
  if (numero && !/^[1-9]\d{0,8}$/.test(numero))
    e.push({ campo: 'numeroCorrelativo', mensaje: 'El número de carpeta debe ser un entero positivo' })
  const clasificacion = texto(d, 'clasificacion')
  if (clasificacion && clasificacion !== 'social' && clasificacion !== 'privado')
    e.push({ campo: 'clasificacion', mensaje: 'La clasificación debe ser social o privado' })
  if (texto(d, 'ciudadResidencia') === 'otra' && !texto(d, 'otraLocalidad'))
    e.push({ campo: 'otraLocalidad', mensaje: 'Indique la localidad' })
  const edad = texto(d, 'edadAlIngreso')
  if (edad && (!/^\d{1,3}$/.test(edad) || Number(edad) > 120))
    e.push({ campo: 'edadAlIngreso', mensaje: 'La edad debe ser un entero entre 0 y 120' })
  if (tipo === 'voluntario' && (texto(d, 'juzgado') || texto(d, 'nroExpediente')))
    e.push({ campo: 'juzgado', mensaje: 'Un caso voluntario no lleva contexto judicial' })
  return e
}

function clasificarLote(ctx: Contexto3, lote: LoteSim) {
  for (const f of lote.filas) {
    f.errores = validarFilaSim(f.datos)
    f.referenciaOrigen = texto(f.datos, 'referenciaOrigen')
    const tipo = texto(f.datos, 'tipo')
    const numero = Number(texto(f.datos, 'numeroCorrelativo')) || null
    const nombre = normalizarNombre(texto(f.datos, 'nombreCompleto') ?? '')
    const coincidencias: Record<string, unknown>[] = []
    for (const c of ctx.casos) {
      if (numero && c.tipo === tipo && c.numero === numero) {
        coincidencias.push({
          tipo: 'carpeta',
          casoId: c.id,
          pacienteId: c.paciente.id,
          nombreCompleto: c.paciente.nombreCompleto,
          tipoCaso: c.tipo,
          numero: c.numero,
          eliminado: false,
        })
      }
    }
    for (const c of ctx.casos) {
      if (nombre && normalizarNombre(c.paciente.nombreCompleto) === nombre) {
        coincidencias.push({
          tipo: 'nombre',
          pacienteId: c.paciente.id,
          nombreCompleto: c.paciente.nombreCompleto,
          similitud: 1,
          mismaFechaNacimiento: false,
        })
      }
    }
    for (const o of lote.filas) {
      if (o === f) continue
      const mismoNumero = Boolean(
        numero && texto(o.datos, 'tipo') === tipo && Number(texto(o.datos, 'numeroCorrelativo')) === numero,
      )
      if (mismoNumero || (nombre && normalizarNombre(texto(o.datos, 'nombreCompleto') ?? '') === nombre)) {
        coincidencias.push({ tipo: 'fila', numeroFila: o.numeroFila, mismoNumero })
      }
    }
    f.coincidencias = coincidencias
    f.estado = f.errores.length
      ? 'error'
      : coincidencias.some((c) => c.tipo === 'carpeta' || c.tipo === 'nombre')
        ? 'posible_duplicado'
        : coincidencias.some((c) => c.tipo === 'fila')
          ? 'duplicado_en_lote'
          : 'valida_nueva'
    f.advertencias = []
    if (numero && (tipo === 'voluntario' || tipo === 'derivado') && numero > ctx.contadores[tipo]) {
      f.advertencias.push({
        tipo: 'contador',
        mensaje: `El último número ${tipo} es ${ctx.contadores[tipo]}: el contador pasará a ${numero}`,
      })
    }
    if (f.estado === 'valida_nueva' && !f.decision) f.decision = 'crear'
    if (f.estado !== 'valida_nueva' && f.decision === 'crear' && f.estado === 'error') f.decision = null
  }
}

function vistaLote(lote: LoteSim) {
  return {
    loteId: lote.loteId,
    version: lote.version,
    estado: lote.estado,
    archivoNombre: lote.archivoNombre,
    origen: lote.origen,
    resumen: {
      total: lote.filas.length,
      validas: lote.filas.filter((f) => f.estado === 'valida_nueva').length,
      advertencias: lote.filas.filter((f) => f.estado === 'posible_duplicado' || f.estado === 'duplicado_en_lote')
        .length,
      errores: lote.filas.filter((f) => f.estado === 'error').length,
    },
    filas: lote.filas.map(({ destino: _d, casoId: _c, pacienteId: _p, ...f }) => f),
  }
}

function resumenLote(ctx: Contexto3, lote: LoteSim) {
  return {
    importacionId: lote.loteId,
    estado: lote.estado,
    version: lote.version,
    confirmadaEn: lote.confirmadaEn,
    confirmadaPor: ctx.yo.id,
    creadas: lote.filas.filter((f) => f.resultado === 'creada').length,
    vinculadas: lote.filas.filter((f) => f.resultado === 'vinculada').length,
    excluidas: lote.filas.filter((f) => f.resultado === 'excluida').length,
    filas: lote.filas.map((f) => {
      const caso = ctx.casos.find((c) => c.id === f.casoId)
      return {
        numeroFila: f.numeroFila,
        referenciaOrigen: f.referenciaOrigen,
        resultado: f.resultado,
        pacienteId: f.pacienteId,
        casoId: f.casoId,
        tipo: caso?.tipo ?? null,
        numeroCorrelativo: caso?.numero ?? null,
      }
    }),
  }
}

async function cargarLote(ctx: Contexto3) {
  const archivoLote = ctx.formulario?.get('archivo')
  if (!archivoLote || typeof archivoLote === 'string' || archivoLote.size === 0)
    return ctx.error(400, 'Adjunta un archivo CSV o XLSX')
  if (archivoLote.size > 5 * 1024 * 1024) return ctx.error(413, 'File too large')
  const nombre = archivoLote.name
  const ext = nombre.toLowerCase().split('.').pop()
  if (ext !== 'csv' && ext !== 'xlsx') return ctx.error(415, 'Solo se admite CSV o XLSX')
  if (ext === 'xlsx') return ctx.error(400, 'La API simulada solo lee CSV; prueba XLSX con el backend real')
  const bytes = new Uint8Array(await archivoLote.arrayBuffer())
  let contenido: string
  try {
    contenido = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return ctx.error(400, 'El CSV debe estar codificado en UTF-8')
  }
  const huella = String(contenido.length) + contenido.slice(0, 200)
  const lotes = ctx.estado.importaciones as LoteSim[]
  const previo = lotes.find((l) => l.huella === huella && l.estado === 'confirmada')
  if (previo) return ctx.error(409, 'Este archivo ya fue importado', { loteId: previo.loteId })
  const [encabezado, ...filas] = leerCsv(contenido)
  if (!encabezado || encabezado.join(',') !== COLUMNAS_IMPORTACION.join(',')) {
    return ctx.error(400, 'Los encabezados del CSV deben coincidir con la plantilla de importación')
  }
  if (filas.length === 0) return ctx.error(400, 'El CSV no contiene filas para importar')
  if (filas.some((f) => f.length !== encabezado.length)) {
    return ctx.error(400, 'El CSV tiene comillas inválidas o filas con distinta cantidad de columnas')
  }
  const origen = ctx.formulario?.get('origen')
  const lote: LoteSim = {
    loteId: crypto.randomUUID(),
    version: 1,
    estado: 'en_revision',
    archivoNombre: nombre,
    origen: typeof origen === 'string' && origen.trim() ? origen.trim() : null,
    huella,
    confirmadaEn: null,
    filas: filas.map((f, i) => ({
      numeroFila: i + 2,
      referenciaOrigen: null,
      datos: Object.fromEntries(COLUMNAS_IMPORTACION.map((c, j) => [c, f[j]])),
      estado: 'valida_nueva',
      errores: [],
      advertencias: [],
      coincidencias: [],
      decision: null,
      destino: null,
      resultado: null,
      casoId: null,
      pacienteId: null,
    })),
  }
  clasificarLote(ctx, lote)
  lotes.push(lote)
  return ctx.json(201, vistaLote(lote))
}

function confirmarLote(ctx: Contexto3, lote: LoteSim) {
  if (lote.estado === 'confirmada') return ctx.json(200, resumenLote(ctx, lote))
  const { version, aceptaAvanceContador } = ctx.cuerpo as { version?: number; aceptaAvanceContador?: boolean }
  if (version !== lote.version) return ctx.error(409, 'El lote o los datos cambiaron. Revisa la vista previa.')
  const pendientes = lote.filas
    .map((f) => ({
      numeroFila: f.numeroFila,
      motivo: !f.decision
        ? 'Falta la decisión'
        : f.estado === 'error' && f.decision !== 'excluir'
          ? 'Corrija o excluya la fila con errores'
          : f.decision === 'crear' && f.coincidencias.some((c) => c.tipo === 'carpeta')
            ? 'El número ya existe: vincule al caso existente o excluya'
            : null,
    }))
    .filter((p) => p.motivo)
  if (pendientes.length)
    return ctx.error(422, 'Hay filas sin resolver o no quedan filas para importar', { filas: pendientes })
  const crean = lote.filas.filter(
    (f) => f.decision === 'crear' || (f.decision === 'vincular' && !f.destino?.casoDestinoId),
  )
  if (!lote.filas.some((f) => f.decision !== 'excluir')) {
    return ctx.error(422, 'Hay filas sin resolver o no quedan filas para importar', { filas: [] })
  }
  if (!aceptaAvanceContador) {
    const saltos = (['voluntario', 'derivado'] as const).flatMap((tipo) => {
      const numeros = crean
        .filter((f) => texto(f.datos, 'tipo') === tipo)
        .map((f) => Number(texto(f.datos, 'numeroCorrelativo')) || 0)
      const maximo = Math.max(0, ...numeros)
      const cantidad = numeros.filter((n) => n > ctx.contadores[tipo]).length
      return maximo > ctx.contadores[tipo] + cantidad
        ? [{ tipo, ultimoActual: ctx.contadores[tipo], nuevoUltimo: maximo }]
        : []
    })
    if (saltos.length) return ctx.error(422, 'Debes aceptar el avance del contador', { saltos })
  }
  const prioridad = (f: FilaLoteSim) => (f.decision === 'crear' ? 0 : f.decision === 'vincular' ? 1 : 2)
  const orden = [...lote.filas].sort((a, b) => prioridad(a) - prioridad(b) || a.numeroFila - b.numeroFila)
  for (const f of orden) {
    if (f.decision === 'excluir') {
      f.resultado = 'excluida'
      continue
    }
    if (f.decision === 'vincular' && f.destino?.casoDestinoId) {
      const caso = ctx.casos.find((c) => c.id === f.destino!.casoDestinoId)
      Object.assign(f, { resultado: 'vinculada', casoId: caso?.id ?? null, pacienteId: caso?.paciente.id ?? null })
      continue
    }
    const tipo = texto(f.datos, 'tipo') as 'voluntario' | 'derivado'
    const numeroPedido = Number(texto(f.datos, 'numeroCorrelativo')) || null
    const numero = numeroPedido ?? ctx.contadores[tipo] + 1
    ctx.contadores[tipo] = Math.max(ctx.contadores[tipo], numero)
    const pacienteExistente = f.destino?.pacienteDestinoId
      ? ctx.casos.find((c) => c.paciente.id === f.destino!.pacienteDestinoId)?.paciente
      : f.destino?.filaDestino
        ? ctx.casos.find(
            (c) => c.paciente.id === lote.filas.find((o) => o.numeroFila === f.destino!.filaDestino)?.pacienteId,
          )?.paciente
        : undefined
    const paciente = pacienteExistente ?? {
      id: crypto.randomUUID(),
      nombreCompleto: texto(f.datos, 'nombreCompleto')!,
      ciudadResidencia: texto(f.datos, 'ciudadResidencia'),
      otraLocalidad: texto(f.datos, 'otraLocalidad'),
    }
    const caso = {
      id: crypto.randomUUID(),
      numero,
      tipo,
      estado: texto(f.datos, 'estado') ?? 'iniciado',
      clasificacion: texto(f.datos, 'clasificacion'),
      fechaIngreso: texto(f.datos, 'fechaIngreso')!,
      paciente,
      creadoPor: ctx.yo.id,
      creadoEn: ahora(),
      asignacion: null,
    }
    ctx.casos.push(caso)
    Object.assign(f, {
      resultado: f.decision === 'crear' ? 'creada' : 'vinculada',
      casoId: caso.id,
      pacienteId: paciente.id,
    })
  }
  lote.estado = 'confirmada'
  lote.confirmadaEn = ahora()
  return ctx.json(200, resumenLote(ctx, lote))
}

manejadores.push(async (ctx) => {
  const m = ctx.ruta.match(/^\/importaciones(?:\/([^/]+))?(?:\/filas\/([^/]+)(\/datos)?|(\/confirmar))?$/)
  if (!m) return null
  if (ctx.yo.rol !== 'administrador') return ctx.error(403, 'No tienes permiso para realizar esta acción')
  const [, id, numeroFila, datos, confirmar] = m
  if (!id) return ctx.metodo === 'POST' ? cargarLote(ctx) : null
  if (!UUID.test(id)) return ctx.error(400, 'Validation failed (uuid is expected)')
  const lote = (ctx.estado.importaciones as LoteSim[]).find((l) => l.loteId === id)
  if (!lote) return ctx.error(404, 'Lote de importación no encontrado')
  if (!numeroFila && !confirmar && ctx.metodo === 'GET') return ctx.json(200, vistaLote(lote))
  if (confirmar && ctx.metodo === 'POST') return confirmarLote(ctx, lote)
  if (numeroFila && ctx.metodo === 'PATCH') {
    const c = ctx.cuerpo as {
      version?: number
      decision?: string
      datos?: Record<string, string | null>
      pacienteDestinoId?: string
      casoDestinoId?: string
      filaDestino?: number
    }
    const fila = lote.filas.find((f) => f.numeroFila === Number(numeroFila))
    if (!datos) {
      const destinos = [c.pacienteDestinoId, c.casoDestinoId, c.filaDestino].filter((x) => x !== undefined)
      if (!['crear', 'vincular', 'excluir'].includes(c.decision ?? ''))
        return ctx.error(400, ['decision must be one of the following values: crear, vincular, excluir'])
      if (destinos.length !== (c.decision === 'vincular' ? 1 : 0))
        return ctx.error(400, 'Vincular requiere un único destino')
    } else if (
      !c.datos ||
      Object.entries(c.datos).some(
        ([k, v]) => !COLUMNAS_IMPORTACION.includes(k) || (v !== null && typeof v !== 'string'),
      )
    ) {
      return ctx.error(400, 'Envía columnas de la plantilla con valores de texto o null')
    }
    if (lote.estado !== 'en_revision' || c.version !== lote.version)
      return ctx.error(409, 'El lote cambió. Vuelve a consultar la vista previa.')
    if (!fila) return ctx.error(404, 'Fila de importación no encontrada')
    if (datos) {
      fila.datos = { ...fila.datos, ...c.datos }
    } else {
      fila.decision = c.decision!
      fila.destino =
        c.decision === 'vincular'
          ? { pacienteDestinoId: c.pacienteDestinoId, casoDestinoId: c.casoDestinoId, filaDestino: c.filaDestino }
          : null
    }
    lote.version += 1
    clasificarLote(ctx, lote)
    return ctx.json(200, vistaLote(lote))
  }
  return null
})

// ---- FE-169 · Investigación y exportación para Atlas.ti -------------------------------

interface CategoriaSim {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  padreId: string | null
  color: string | null
  activa: boolean
}

interface EtiquetaSim {
  id: string
  casoId: string
  categoriaId: string
  fichaDiagnosticoId: string | null
  fichaSeguimientoId: string | null
  fragmento: string | null
  nota: string | null
}

interface PaqueteSim {
  id: string
  autorId: string
  casosIds: string[]
  secciones: string[]
  formato: 'txt' | 'docx'
  desde: string | null
  hasta: string | null
  huellaRevisada: string | null
  revisadoEn: string | null
}

semillas.push((estado, ids) => {
  estado.categorias = [
    {
      id: '60000000-0000-4000-8000-000000000001',
      codigo: 'COM-FAM',
      nombre: 'Comunicación familiar',
      descripcion: 'Categoría ficticia de QA.',
      padreId: null,
      color: '#2E7D32',
      activa: true,
    },
    {
      id: '60000000-0000-4000-8000-000000000002',
      codigo: 'LIM',
      nombre: 'Límites',
      descripcion: null,
      padreId: null,
      color: '#F57C00',
      activa: true,
    },
    {
      id: '60000000-0000-4000-8000-000000000003',
      codigo: 'ANT',
      nombre: 'Categoría antigua',
      descripcion: null,
      padreId: null,
      color: null,
      activa: false,
    },
  ] satisfies CategoriaSim[]
  estado.etiquetas = [
    {
      id: crypto.randomUUID(),
      casoId: ids.casos[0].id,
      categoriaId: '60000000-0000-4000-8000-000000000001',
      fichaDiagnosticoId: null,
      fichaSeguimientoId: null,
      fragmento: null,
      nota: null,
    },
  ] satisfies EtiquetaSim[]
  estado.paquetes = []
})

const categoriasSim = (ctx: Contexto3) => ctx.estado.categorias as CategoriaSim[]
const etiquetasSim = (ctx: Contexto3) => ctx.estado.etiquetas as EtiquetaSim[]

/** Huella estable del contenido (en el backend es SHA-256 hex; aquí basta un hash determinista de 64 caracteres). */
function huellaDe(valor: unknown) {
  const texto = JSON.stringify(valor)
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < texto.length; i++) {
    h1 = Math.imul(h1 ^ texto.charCodeAt(i), 16777619) >>> 0
    h2 = Math.imul(h2 + texto.charCodeAt(i), 2246822519) >>> 0
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4)
}

function contenidoPaquete(ctx: Contexto3, p: PaqueteSim) {
  const cats = categoriasSim(ctx)
  const documentos = p.casosIds.map((casoId, i) => {
    const codigo = `INV-${String(i + 1).padStart(3, '0')}`
    const etiquetas = etiquetasSim(ctx).filter((e) => e.casoId === casoId)
    const diag = ctx.expediente.diagnosticos.find((d) => d.casoId === casoId)
    const sesiones = ctx.expediente.sesiones
      .filter((s) => s.casoId === casoId && (!p.desde || s.fecha >= p.desde) && (!p.hasta || s.fecha <= p.hasta))
      .sort((a, b) => a.numero - b.numero)
    const doc: Record<string, unknown> = {
      idExportacion: codigo,
      archivo: `${codigo}.${p.formato}`,
      secciones: p.secciones,
      categorias: etiquetas.map((e) => {
        const c = cats.find((x) => x.id === e.categoriaId)!
        return {
          codigo: c.codigo,
          nombre: c.nombre,
          ambito: e.fichaDiagnosticoId ? 'diagnostico' : e.fichaSeguimientoId ? 'sesion' : 'caso',
          fragmento: e.fragmento,
          nota: e.nota,
          nroSesion: e.fichaSeguimientoId
            ? (ctx.expediente.sesiones.find((s) => s.id === e.fichaSeguimientoId)?.numero ?? null)
            : null,
        }
      }),
    }
    if (p.secciones.includes('diagnostico')) {
      doc.diagnostico = diag
        ? {
            origen: 'ficha',
            diagnosticoIngreso: diag.diagnosticoIngreso,
            hipotesisRelacional: diag.hipotesisRelacional,
            comentariosClinicos: diag.comentariosClinicos,
          }
        : { origen: 'sin_datos', diagnosticoIngreso: null, hipotesisRelacional: null, comentariosClinicos: null }
    }
    if (p.secciones.includes('seguimiento')) {
      doc.seguimiento = sesiones.map((s) => ({
        nroSesion: s.numero,
        mes: s.fecha.slice(0, 7),
        evolucion: s.evolucion,
        ...(p.secciones.includes('tareas')
          ? {
              tareas: ctx.expediente.tareas
                .filter((t) => t.sesionId === s.id)
                .map((t) => ({ descripcion: t.descripcion, completada: t.completada })),
            }
          : {}),
      }))
    }
    return doc
  })
  const usados = new Set(documentos.flatMap((d) => (d.categorias as { codigo: string }[]).map((c) => c.codigo)))
  const manifiesto = {
    formato: p.formato,
    formatoVersion: 1,
    periodo: { desde: p.desde, hasta: p.hasta },
    catalogo: cats
      .filter((c) => usados.has(c.codigo))
      .map((c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        descripcion: c.descripcion,
        padre: cats.find((x) => x.id === c.padreId)?.codigo ?? null,
      })),
    documentos: documentos.map((d) => ({
      idExportacion: d.idExportacion,
      archivo: d.archivo,
      secciones: d.secciones,
      categorias: [...new Set((d.categorias as { codigo: string }[]).map((c) => c.codigo))],
    })),
  }
  return { manifiesto, documentos, huella: huellaDe({ manifiesto, documentos }) }
}

manejadores.push((ctx) => {
  if (!ctx.ruta.startsWith('/investigacion/')) return null
  if (ctx.yo.rol !== 'administrador' && ctx.yo.rol !== 'terapeuta')
    return ctx.error(403, 'No tienes permiso para realizar esta acción')
  const visibles = ctx.casos.filter((c) => casoAccesible(ctx, c.id))
  const cats = categoriasSim(ctx)

  if (ctx.ruta === '/investigacion/categorias') {
    if (ctx.metodo === 'GET') {
      return ctx.json(200, {
        categorias: cats.map((c) => {
          const propias = etiquetasSim(ctx).filter(
            (e) => e.categoriaId === c.id && visibles.some((v) => v.id === e.casoId),
          )
          return {
            id: c.id,
            codigo: c.codigo,
            nombre: c.nombre,
            padreId: c.padreId,
            activa: c.activa,
            casos: new Set(propias.map((e) => e.casoId)).size,
            etiquetasCaso: propias.filter((e) => !e.fichaDiagnosticoId && !e.fichaSeguimientoId).length,
            etiquetasDiagnostico: propias.filter((e) => e.fichaDiagnosticoId).length,
            etiquetasSesion: propias.filter((e) => e.fichaSeguimientoId).length,
          }
        }),
      })
    }
    if (ctx.metodo === 'POST') {
      if (ctx.yo.rol !== 'administrador') return ctx.error(403, 'Forbidden resource')
      const c = ctx.cuerpo as Partial<CategoriaSim>
      if (
        typeof c.codigo !== 'string' ||
        !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(c.codigo) ||
        typeof c.nombre !== 'string' ||
        !c.nombre.trim()
      ) {
        return ctx.error(400, ['codigo must match regular expression', 'nombre must match /\\S/ regular expression'])
      }
      if (cats.some((x) => x.codigo === c.codigo)) return ctx.error(409, 'Ya existe una categoría con ese código')
      const nueva: CategoriaSim = {
        id: crypto.randomUUID(),
        codigo: c.codigo,
        nombre: c.nombre.trim(),
        descripcion: c.descripcion ?? null,
        padreId: c.padreId ?? null,
        color: c.color ?? null,
        activa: c.activa ?? true,
      }
      cats.push(nueva)
      return ctx.json(201, nueva)
    }
  }
  const editar = ctx.ruta.match(/^\/investigacion\/categorias\/([^/]+)$/)
  if (editar && ctx.metodo === 'PUT') {
    if (ctx.yo.rol !== 'administrador') return ctx.error(403, 'Forbidden resource')
    const c = cats.find((x) => x.id === editar[1])
    if (!c) return ctx.error(404, 'Categoría no encontrada')
    const d = ctx.cuerpo as Partial<CategoriaSim>
    Object.assign(c, {
      nombre: String(d.nombre ?? c.nombre).trim(),
      descripcion: d.descripcion ?? null,
      padreId: d.padreId ?? null,
      color: d.color ?? null,
      activa: d.activa ?? c.activa,
    })
    return ctx.json(200, c)
  }

  if (ctx.ruta === '/investigacion/seleccion' && ctx.metodo === 'GET') {
    const desde = ctx.params.get('desde')
    const hasta = ctx.params.get('hasta')
    const residencias = ctx.params.getAll('residencias')
    const filtroCats = ctx.params.getAll('categorias')
    const casos = visibles
      .filter((c) => !residencias.length || residencias.includes(c.paciente.ciudadResidencia ?? 'sin_registrar'))
      .filter(
        (c) =>
          !filtroCats.length || etiquetasSim(ctx).some((e) => e.casoId === c.id && filtroCats.includes(e.categoriaId)),
      )
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.numero - b.numero)
      .map((c) => ({
        casoId: c.id,
        tipo: c.tipo,
        numeroCorrelativo: c.numero,
        categorias: [
          ...new Set(
            etiquetasSim(ctx)
              .filter((e) => e.casoId === c.id)
              .map((e) => cats.find((x) => x.id === e.categoriaId)!.codigo),
          ),
        ],
        sesionesEnPeriodo: ctx.expediente.sesiones.filter(
          (s) => s.casoId === c.id && (!desde || s.fecha >= desde) && (!hasta || s.fecha <= hasta),
        ).length,
        tieneDiagnostico: ctx.expediente.diagnosticos.some((d) => d.casoId === c.id),
      }))
    return ctx.json(200, { casos })
  }

  const etiquetar = ctx.ruta.match(/^\/investigacion\/casos\/([^/]+)\/etiquetas$/)
  if (etiquetar && ctx.metodo === 'POST') {
    const caso = casoAccesible(ctx, etiquetar[1])
    if (!caso) return ctx.error(404, 'Caso no encontrado')
    const e = ctx.cuerpo as Partial<EtiquetaSim>
    if (e.fichaDiagnosticoId && e.fichaSeguimientoId) return ctx.error(400, 'Elige diagnóstico o seguimiento, solo uno')
    const categoria = cats.find((c) => c.id === e.categoriaId && c.activa)
    if (!categoria) return ctx.error(400, 'La categoría no existe o está inactiva')
    const nueva: EtiquetaSim = {
      id: crypto.randomUUID(),
      casoId: caso.id,
      categoriaId: categoria.id,
      fichaDiagnosticoId: e.fichaDiagnosticoId ?? null,
      fichaSeguimientoId: e.fichaSeguimientoId ?? null,
      fragmento: e.fragmento ?? null,
      nota: e.nota ?? null,
    }
    if (
      etiquetasSim(ctx).some(
        (x) =>
          x.casoId === nueva.casoId &&
          x.categoriaId === nueva.categoriaId &&
          x.fichaDiagnosticoId === nueva.fichaDiagnosticoId &&
          x.fichaSeguimientoId === nueva.fichaSeguimientoId,
      )
    ) {
      return ctx.error(409, 'La categoría ya está asignada')
    }
    etiquetasSim(ctx).push(nueva)
    return ctx.json(201, { ...nueva, etiquetadoPor: ctx.yo.id })
  }

  if (ctx.ruta === '/investigacion/exportaciones' && ctx.metodo === 'POST') {
    const d = ctx.cuerpo as {
      casosIds?: string[]
      secciones?: string[]
      formato?: string
      desde?: string
      hasta?: string
    }
    if (
      !Array.isArray(d.casosIds) ||
      !d.casosIds.length ||
      !Array.isArray(d.secciones) ||
      !d.secciones.length ||
      !['txt', 'docx'].includes(d.formato ?? '')
    ) {
      return ctx.error(400, ['casosIds should not be empty'])
    }
    if (d.casosIds.some((id) => !visibles.some((v) => v.id === id)))
      return ctx.error(403, 'No tienes permiso para exportar estos datos')
    const p: PaqueteSim = {
      id: crypto.randomUUID(),
      autorId: ctx.yo.id,
      casosIds: d.casosIds,
      secciones: d.secciones,
      formato: d.formato as 'txt',
      desde: d.desde ?? null,
      hasta: d.hasta ?? null,
      huellaRevisada: null,
      revisadoEn: null,
    }
    ;(ctx.estado.paquetes as PaqueteSim[]).push(p)
    return ctx.json(201, { exportacionId: p.id })
  }

  const m = ctx.ruta.match(
    /^\/investigacion\/exportaciones\/([^/]+)\/(manifiesto|revision|descarga|documentos\/[^/]+)$/,
  )
  if (!m) return null
  const p = (ctx.estado.paquetes as PaqueteSim[]).find(
    (x) => x.id === m[1] && x.casosIds.every((id) => visibles.some((v) => v.id === id)),
  )
  if (!p) return ctx.error(404, 'Exportación no encontrada')
  const contenido = contenidoPaquete(ctx, p)
  if (m[2] === 'manifiesto' && ctx.metodo === 'GET') return ctx.json(200, contenido.manifiesto)
  if (m[2] === 'revision' && ctx.metodo === 'GET') return ctx.json(200, contenido)
  if (m[2] === 'revision' && ctx.metodo === 'PATCH') {
    const huella = (ctx.cuerpo as { huella?: string }).huella
    if (typeof huella !== 'string' || !/^[0-9a-f]{64}$/.test(huella))
      return ctx.error(400, ['huella must match /^[0-9a-f]{64}$/ regular expression'])
    if (huella !== contenido.huella) return ctx.error(409, 'El contenido cambió. Revisa la vista actualizada.')
    if (p.revisadoEn) return ctx.error(409, 'No se puede registrar la revisión del paquete')
    p.huellaRevisada = huella
    p.revisadoEn = ahora()
    return ctx.json(200, { revisadoEn: p.revisadoEn })
  }
  if (m[2] === 'descarga' && ctx.metodo === 'GET') {
    if (!p.huellaRevisada) return ctx.error(409, 'Confirma la revisión antes de descargar')
    if (p.huellaRevisada !== contenido.huella)
      return ctx.error(409, 'El texto revisado cambió. Prepara y revisa un paquete nuevo.')
    const zip = new TextEncoder().encode(`PK\u0003\u0004${JSON.stringify(contenido.manifiesto)}`)
    return archivo(zip, 'application/zip', 'investigacion.zip')
  }
  if (m[2].startsWith('documentos/') && ctx.metodo === 'GET') {
    const doc = contenido.documentos.find((d) => d.idExportacion === m[2].slice('documentos/'.length))
    return doc ? ctx.json(200, doc) : ctx.error(404, 'Documento no encontrado')
  }
  return null
})
