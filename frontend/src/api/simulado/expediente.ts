/**
 * API SIMULADA del expediente clínico (Sprint 2). Imita los endpoints reales de los PR #26–#33:
 * sesiones (FE-73), tareas (FE-78), diagnóstico (FE-68), constancia (FE-63), pagos (FE-88),
 * historial (FE-83) e indicadores (FE-93), con los mismos permisos, códigos y formas de respuesta.
 * Una cuenta sin acceso al caso recibe 404 "Caso no encontrado", igual que en el backend.
 */
import type { Rol } from '../../features/auth/tipos'
import type { EstadoCaso } from '../../features/carpetas/tipos'

export interface SesionSim {
  id: string
  casoId: string
  numero: number
  fecha: string
  evolucion: string
  responsableId: string
  creadoPor: string
  creadoEn: string
}

export interface TareaSim {
  id: string
  casoId: string
  sesionId: string
  descripcion: string
  completada: boolean
  fecha: string
  creadoPor: string
  creadoEn: string
  cumplimientoPor: string | null
  cumplimientoEn: string | null
}

export interface DiagnosticoSim {
  id: string
  casoId: string
  fecha: string
  diagnosticoIngreso: string
  hipotesisRelacional: string | null
  comentariosClinicos: string | null
  creadoPor: string
  creadoEn: string
  actualizadoPor: string
  actualizadoEn: string
}

export interface ConstanciaSim {
  id: string
  casoId: string
  procedencia: string | null
  origenJudicial: boolean
  estado: 'pendiente' | 'registrado' | 'no_aplica'
  fechaConsentimiento: string | null
  referenciaEvidencia: string | null
  explicacion: string | null
  contextoJudicial: {
    juzgado: string
    nroExpediente: string | null
    fechaDerivacion: string | null
    observaciones: string | null
  } | null
  creadoPor: string
  creadoEn: string
  actualizadoPor: string
  actualizadoEn: string
}

export interface PagoSim {
  id: string
  casoId: string
  sesionId: string
  monto: string
  fecha: string
  metodo: 'qr' | 'transferencia'
  referencia: string | null
  registradoPor: string
  creadoEn: string
}

export interface ExpedienteSim {
  sesiones: SesionSim[]
  tareas: TareaSim[]
  diagnosticos: DiagnosticoSim[]
  constancias: ConstanciaSim[]
  pagos: PagoSim[]
}

interface CasoVisible {
  id: string
  numero: number
  tipo: string
  estado: EstadoCaso
  clasificacion: string | null
  fechaIngreso: string
  paciente: { id: string; nombreCompleto: string }
  creadoPor: string | null
  creadoEn: string
  asignacion: { perfilId: string } | null
}

interface Contexto {
  yo: { id: string; rol: Rol }
  metodo: string
  ruta: string
  cuerpo: Record<string, unknown>
  params: URLSearchParams
  casos: CasoVisible[]
  perfiles: { id: string; nombreCompleto: string; rol: Rol; activo: boolean }[]
  expediente: ExpedienteSim
  json: (estado: number, cuerpo: unknown) => Response
  error: (estado: number, mensaje: string | string[]) => Response
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MONTO = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/

function fechaValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !FECHA.test(valor)) return false
  const [a, m, d] = valor.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d))
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
}
const conTexto = (valor: unknown): valor is string => typeof valor === 'string' && valor.trim().length > 0
const ahora = () => new Date().toISOString()
const hoy = () => {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}

/** Devuelve la respuesta, o null si la ruta no es del expediente. */
export function atenderExpediente(ctx: Contexto): Response | null {
  const { ruta, metodo, yo, error } = ctx

  if (ruta === '/indicadores' && metodo === 'GET') {
    return yo.rol === 'administrador' ? indicadores(ctx) : error(403, 'No tienes permiso para realizar esta acción')
  }

  const m = ruta.match(
    /^\/carpetas\/([^/]+)\/(sesiones|tareas|diagnostico|constancia|pagos|historial)(?:\/([^/]+))?(\/cumplimiento)?$/,
  )
  if (!m) return null
  const [, casoId, apartado, subId, cumplimiento] = m

  // RolesGuard: pagos solo administración; lo demás, administración y terapeuta.
  const soloAdministracion = apartado === 'pagos'
  if (yo.rol === 'marketing' || (soloAdministracion && yo.rol !== 'administrador')) {
    return error(403, 'No tienes permiso para realizar esta acción')
  }
  if (!UUID.test(casoId) || (subId && !UUID.test(subId))) {
    return error(400, 'Validation failed (uuid is expected)')
  }
  const caso = ctx.casos.find((c) => c.id === casoId)
  const accesible = caso && (yo.rol === 'administrador' || caso.asignacion?.perfilId === yo.id)
  if (!caso || !accesible) return error(404, 'Caso no encontrado')

  if (apartado === 'sesiones') {
    if (!subId && metodo === 'GET') return listarSesiones(ctx, caso)
    if (!subId && metodo === 'POST') return registrarSesion(ctx, caso)
    if (subId && !cumplimiento && metodo === 'GET') return verSesion(ctx, caso, subId)
  }
  if (apartado === 'tareas') {
    if (!subId && metodo === 'GET') return ctx.json(200, { tareas: tareasDe(ctx, caso.id).map((t) => tarea(ctx, t)) })
    if (!subId && metodo === 'POST') return crearTarea(ctx, caso)
    if (subId && cumplimiento && metodo === 'PATCH') return cambiarCumplimiento(ctx, caso, subId)
  }
  if (apartado === 'diagnostico' && !subId) {
    if (metodo === 'GET') return ctx.json(200, { diagnostico: diagnosticoDe(ctx, caso.id) ?? null })
    if (metodo === 'PUT') return guardarDiagnostico(ctx, caso)
  }
  if (apartado === 'constancia' && !subId) {
    if (metodo === 'GET') return ctx.json(200, { constancia: constanciaDe(ctx, caso.id) ?? null })
    if (metodo === 'PUT') return guardarConstancia(ctx, caso)
  }
  if (apartado === 'pagos' && !subId) {
    if (metodo === 'GET') return ctx.json(200, { pagos: pagosDe(ctx, caso.id) })
    if (metodo === 'POST') return registrarPago(ctx, caso)
  }
  if (apartado === 'historial' && !subId && metodo === 'GET') return historial(ctx, caso)
  return null
}

// ---- Sesiones (FE-73) --------------------------------------------------------

const ordenSesion = (a: SesionSim, b: SesionSim) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero

function sesion(ctx: Contexto, s: SesionSim) {
  const r = ctx.perfiles.find((p) => p.id === s.responsableId)
  return {
    id: s.id,
    casoId: s.casoId,
    numero: s.numero,
    fecha: s.fecha,
    evolucion: s.evolucion,
    responsable: { id: s.responsableId, nombreCompleto: r?.nombreCompleto ?? '' },
    creadoPor: s.creadoPor,
    creadoEn: s.creadoEn,
    actualizadoPor: s.creadoPor,
    actualizadoEn: s.creadoEn,
  }
}

function listarSesiones(ctx: Contexto, caso: CasoVisible) {
  const sesiones = ctx.expediente.sesiones
    .filter((s) => s.casoId === caso.id)
    .sort(ordenSesion)
    .map((s) => {
      const { evolucion: _omitida, ...resumen } = sesion(ctx, s)
      return resumen
    })
  return ctx.json(200, { sesiones })
}

function registrarSesion(ctx: Contexto, caso: CasoVisible) {
  const { fecha, evolucion } = ctx.cuerpo
  const errores: string[] = []
  if (!fechaValida(fecha)) errores.push('fecha must be a valid ISO 8601 date string')
  if (!conTexto(evolucion)) errores.push('La evolución de la sesión es obligatoria')
  else if (evolucion.length > 10000) errores.push('evolucion must be shorter than or equal to 10000 characters')
  if (errores.length) return ctx.error(400, errores)

  const responsable = ctx.perfiles.find((p) => p.id === caso.asignacion?.perfilId && p.rol === 'terapeuta' && p.activo)
  if (!responsable) {
    return ctx.error(400, 'El caso debe tener una terapeuta activa asignada para registrar sesiones')
  }
  const numero = Math.max(0, ...ctx.expediente.sesiones.filter((s) => s.casoId === caso.id).map((s) => s.numero)) + 1
  const nueva: SesionSim = {
    id: crypto.randomUUID(),
    casoId: caso.id,
    numero,
    fecha: fecha as string,
    evolucion: (evolucion as string).trim(),
    responsableId: responsable.id,
    creadoPor: ctx.yo.id,
    creadoEn: ahora(),
  }
  ctx.expediente.sesiones.push(nueva)
  return ctx.json(201, { sesion: sesion(ctx, nueva) })
}

function verSesion(ctx: Contexto, caso: CasoVisible, id: string) {
  const s = ctx.expediente.sesiones.find((x) => x.id === id && x.casoId === caso.id)
  return s ? ctx.json(200, { sesion: sesion(ctx, s) }) : ctx.error(404, 'Sesión no encontrada')
}

// ---- Tareas (FE-78) ----------------------------------------------------------

function tareasDe(ctx: Contexto, casoId: string) {
  const sesiones = new Map(ctx.expediente.sesiones.map((s) => [s.id, s]))
  return ctx.expediente.tareas
    .filter((t) => t.casoId === casoId)
    .sort(
      (a, b) =>
        ordenSesion(sesiones.get(a.sesionId)!, sesiones.get(b.sesionId)!) || a.creadoEn.localeCompare(b.creadoEn),
    )
}

function tarea(ctx: Contexto, t: TareaSim) {
  return {
    id: t.id,
    casoId: t.casoId,
    sesionId: t.sesionId,
    numeroSesion: ctx.expediente.sesiones.find((s) => s.id === t.sesionId)?.numero,
    descripcion: t.descripcion,
    estado: t.completada ? 'realizada' : 'pendiente',
    fecha: t.fecha,
    creadoPor: t.creadoPor,
    creadoEn: t.creadoEn,
    cumplimientoActualizadoPor: t.cumplimientoPor,
    cumplimientoActualizadoEn: t.cumplimientoEn,
  }
}

function crearTarea(ctx: Contexto, caso: CasoVisible) {
  const { sesionId, descripcion } = ctx.cuerpo
  const errores: string[] = []
  if (typeof sesionId !== 'string' || !UUID.test(sesionId)) errores.push('sesionId must be a UUID')
  if (!conTexto(descripcion)) errores.push('La descripción es obligatoria')
  if (errores.length) return ctx.error(400, errores)
  if (!ctx.expediente.sesiones.some((s) => s.id === sesionId && s.casoId === caso.id)) {
    return ctx.error(400, 'La sesión no existe o no pertenece al caso')
  }
  const nueva: TareaSim = {
    id: crypto.randomUUID(),
    casoId: caso.id,
    sesionId: sesionId as string,
    descripcion: (descripcion as string).trim(),
    completada: false,
    fecha: hoy(),
    creadoPor: ctx.yo.id,
    creadoEn: ahora(),
    cumplimientoPor: null,
    cumplimientoEn: null,
  }
  ctx.expediente.tareas.push(nueva)
  return ctx.json(201, { tarea: tarea(ctx, nueva) })
}

function cambiarCumplimiento(ctx: Contexto, caso: CasoVisible, id: string) {
  const { estado } = ctx.cuerpo
  if (estado !== 'pendiente' && estado !== 'realizada') {
    return ctx.error(400, ['estado must be one of the following values: pendiente, realizada'])
  }
  const t = ctx.expediente.tareas.find((x) => x.id === id && x.casoId === caso.id)
  if (!t) return ctx.error(404, 'Tarea no encontrada')
  // Igual que el backend: si el estado ya coincide, no se registra otro cambio.
  if (t.completada !== (estado === 'realizada')) {
    t.completada = estado === 'realizada'
    t.cumplimientoPor = ctx.yo.id
    t.cumplimientoEn = ahora()
  }
  return ctx.json(200, { tarea: tarea(ctx, t) })
}

// ---- Diagnóstico (FE-68) -----------------------------------------------------

const diagnosticoDe = (ctx: Contexto, casoId: string) => ctx.expediente.diagnosticos.find((d) => d.casoId === casoId)

function guardarDiagnostico(ctx: Contexto, caso: CasoVisible) {
  const { fecha, diagnosticoIngreso, hipotesisRelacional, comentariosClinicos } = ctx.cuerpo
  const errores: string[] = []
  if (!fechaValida(fecha)) errores.push('fecha must be a valid ISO 8601 date string')
  if (!conTexto(diagnosticoIngreso)) errores.push('El diagnóstico de ingreso es obligatorio')
  if (errores.length) return ctx.error(400, errores)
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const previo = diagnosticoDe(ctx, caso.id)
  const ficha: DiagnosticoSim = {
    id: previo?.id ?? crypto.randomUUID(),
    casoId: caso.id,
    fecha: fecha as string,
    diagnosticoIngreso: (diagnosticoIngreso as string).trim(),
    hipotesisRelacional: texto(hipotesisRelacional),
    comentariosClinicos: texto(comentariosClinicos),
    creadoPor: previo?.creadoPor ?? ctx.yo.id,
    creadoEn: previo?.creadoEn ?? ahora(),
    actualizadoPor: ctx.yo.id,
    actualizadoEn: ahora(),
  }
  ctx.expediente.diagnosticos = [...ctx.expediente.diagnosticos.filter((d) => d.casoId !== caso.id), ficha]
  return ctx.json(200, { diagnostico: ficha })
}

// ---- Constancia (FE-63) ------------------------------------------------------

const constanciaDe = (ctx: Contexto, casoId: string) => ctx.expediente.constancias.find((c) => c.casoId === casoId)

function guardarConstancia(ctx: Contexto, caso: CasoVisible) {
  const { procedencia, origenJudicial, estado } = ctx.cuerpo
  const fecha = ctx.cuerpo.fechaConsentimiento ?? null
  const evidencia =
    typeof ctx.cuerpo.referenciaEvidencia === 'string' ? ctx.cuerpo.referenciaEvidencia.trim() || null : null
  const explicacion = typeof ctx.cuerpo.explicacion === 'string' ? ctx.cuerpo.explicacion.trim() || null : null
  if (typeof origenJudicial !== 'boolean') return ctx.error(400, ['origenJudicial must be a boolean value'])
  if (estado !== 'pendiente' && estado !== 'registrado' && estado !== 'no_aplica') {
    return ctx.error(400, ['estado must be one of the following values: pendiente, registrado, no_aplica'])
  }
  if (fecha !== null && !fechaValida(fecha)) return ctx.error(400, ['La fecha de consentimiento no es válida'])
  if (estado === 'pendiente' && (fecha || evidencia || explicacion)) {
    return ctx.error(400, 'Pendiente no admite fecha, evidencia ni explicación')
  }
  if (estado === 'registrado' && (!fecha || !evidencia || explicacion)) {
    return ctx.error(400, 'Registrado exige fecha y evidencia, sin explicación de no aplica')
  }
  if (estado === 'no_aplica' && (!explicacion || fecha || evidencia)) {
    return ctx.error(400, 'No aplica exige explicación y no admite fecha ni evidencia')
  }
  // Contexto judicial (corrección de FE-63): obligatorio con juzgado si el origen es judicial.
  const contexto = ctx.cuerpo.contextoJudicial as Record<string, unknown> | null | undefined
  if (origenJudicial && (!contexto || typeof contexto !== 'object')) {
    return ctx.error(400, ['El contexto judicial es obligatorio para origen judicial'])
  }
  if (!origenJudicial && contexto != null) {
    return ctx.error(400, 'Un origen no judicial no admite contexto judicial')
  }
  const textoOpcional = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  if (contexto) {
    const errores: string[] = []
    if (!conTexto(contexto.juzgado)) errores.push('El juzgado es obligatorio')
    else if (contexto.juzgado.length > 200) errores.push('juzgado must be shorter than or equal to 200 characters')
    if (contexto.fechaDerivacion != null && !fechaValida(contexto.fechaDerivacion)) {
      errores.push('fechaDerivacion must match /^\\d{4}-\\d{2}-\\d{2}$/ regular expression')
    }
    if (errores.length) return ctx.error(400, errores)
  }
  const previa = constanciaDe(ctx, caso.id)
  const constancia: ConstanciaSim = {
    id: previa?.id ?? crypto.randomUUID(),
    casoId: caso.id,
    procedencia: typeof procedencia === 'string' && procedencia.trim() ? procedencia.trim() : null,
    origenJudicial,
    estado,
    fechaConsentimiento: fecha as string | null,
    referenciaEvidencia: evidencia,
    explicacion,
    contextoJudicial: contexto
      ? {
          juzgado: (contexto.juzgado as string).trim(),
          nroExpediente: textoOpcional(contexto.nroExpediente),
          fechaDerivacion: (contexto.fechaDerivacion as string | null | undefined) ?? null,
          observaciones: textoOpcional(contexto.observaciones),
        }
      : null,
    creadoPor: previa?.creadoPor ?? ctx.yo.id,
    creadoEn: previa?.creadoEn ?? ahora(),
    actualizadoPor: ctx.yo.id,
    actualizadoEn: ahora(),
  }
  ctx.expediente.constancias = [...ctx.expediente.constancias.filter((c) => c.casoId !== caso.id), constancia]
  return ctx.json(200, { constancia })
}

// ---- Pagos (FE-88) -----------------------------------------------------------

const pagosDe = (ctx: Contexto, casoId: string) =>
  ctx.expediente.pagos
    .filter((p) => p.casoId === casoId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn))
    .map((p) => ({ ...p, moneda: 'BOB' }))

function registrarPago(ctx: Contexto, caso: CasoVisible) {
  const { sesionId, monto, fecha, metodo } = ctx.cuerpo
  const referencia = typeof ctx.cuerpo.referencia === 'string' ? ctx.cuerpo.referencia.trim() || null : null
  const errores: string[] = []
  if (typeof sesionId !== 'string' || !UUID.test(sesionId)) errores.push('sesionId must be a UUID')
  if (typeof monto !== 'string' || !MONTO.test(monto)) {
    errores.push('El monto debe tener hasta 8 enteros y 2 decimales, usando punto')
  } else if (!/[1-9]/.test(monto)) errores.push('El monto debe ser mayor que cero')
  if (!fechaValida(fecha)) errores.push('La fecha de pago no es válida')
  if (metodo !== 'qr' && metodo !== 'transferencia') {
    errores.push('metodo must be one of the following values: qr, transferencia')
  }
  if (errores.length) return ctx.error(400, errores)
  if (!ctx.expediente.sesiones.some((s) => s.id === sesionId && s.casoId === caso.id)) {
    return ctx.error(400, 'La sesión no existe o no pertenece al caso')
  }
  // Un pago por sesión: repetir los mismos datos devuelve el existente; otros datos son un conflicto.
  const existente = ctx.expediente.pagos.find((p) => p.sesionId === sesionId)
  if (existente) {
    const igual =
      Number(existente.monto) === Number(monto) &&
      existente.fecha === fecha &&
      existente.metodo === metodo &&
      existente.referencia === referencia
    return igual
      ? ctx.json(200, { pago: { ...existente, moneda: 'BOB' }, reutilizado: true })
      : ctx.error(409, 'La sesión ya tiene un pago registrado con otros datos')
  }
  const pago: PagoSim = {
    id: crypto.randomUUID(),
    casoId: caso.id,
    sesionId: sesionId as string,
    monto: Number(monto).toFixed(2),
    fecha: fecha as string,
    metodo: metodo as PagoSim['metodo'],
    referencia,
    registradoPor: ctx.yo.id,
    creadoEn: ahora(),
  }
  ctx.expediente.pagos.push(pago)
  return ctx.json(200, { pago: { ...pago, moneda: 'BOB' }, reutilizado: false })
}

// ---- Historial (FE-83) e indicadores (FE-93) -----------------------------------

function historial(ctx: Contexto, caso: CasoVisible) {
  const terapeuta = ctx.perfiles.find((p) => p.id === caso.asignacion?.perfilId)
  const tareas = tareasDe(ctx, caso.id).map((t) => {
    const { numeroSesion: _sinNumero, ...resto } = tarea(ctx, t)
    return resto
  })
  const constancia = constanciaDe(ctx, caso.id)
  const diagnostico = diagnosticoDe(ctx, caso.id)
  return ctx.json(200, {
    carpeta: {
      id: caso.id,
      numero: caso.numero,
      tipo: caso.tipo,
      clasificacion: caso.clasificacion,
      estado: caso.estado,
      fechaIngreso: caso.fechaIngreso,
      paciente: caso.paciente,
      terapeuta: terapeuta ? { id: terapeuta.id, nombreCompleto: terapeuta.nombreCompleto } : null,
      creadoPor: caso.creadoPor,
      creadoEn: caso.creadoEn,
      actualizadoEn: caso.creadoEn,
    },
    contexto: constancia?.contextoJudicial ?? null,
    constancia: constancia ? (({ casoId: _c, contextoJudicial: _j, ...resto }) => resto)(constancia) : null,
    diagnostico: diagnostico ? (({ casoId: _c, ...resto }) => resto)(diagnostico) : null,
    sesiones: ctx.expediente.sesiones
      .filter((s) => s.casoId === caso.id)
      .sort(ordenSesion)
      .map((s) => ({ ...sesion(ctx, s), tareas: tareas.filter((t) => t.sesionId === s.id) })),
  })
}

function indicadores(ctx: Contexto) {
  const desde = ctx.params.get('desde')
  const hasta = ctx.params.get('hasta')
  if (!fechaValida(desde) || !fechaValida(hasta)) {
    return ctx.error(400, ['desde must be a valid ISO 8601 date string', 'hasta must be a valid ISO 8601 date string'])
  }
  if (desde > hasta) return ctx.error(400, 'La fecha desde no puede ser posterior a hasta')
  const enPeriodo = (fecha: string) => fecha >= desde && fecha <= hasta
  const porEstado = (e: EstadoCaso) => ctx.casos.filter((c) => c.estado === e).length
  const centavos = ctx.expediente.pagos
    .filter((p) => enPeriodo(p.fecha))
    .reduce((suma, p) => suma + Math.round(Number(p.monto) * 100), 0)
  return ctx.json(200, {
    periodo: { desde, hasta },
    casosActuales: ctx.casos.length,
    casosPorEstado: {
      iniciado: porEstado('iniciado'),
      en_proceso: porEstado('en_proceso'),
      concluido: porEstado('concluido'),
    },
    sesiones: ctx.expediente.sesiones.filter((s) => enPeriodo(s.fecha)).length,
    pagosRecibidos: { monto: (centavos / 100).toFixed(2), moneda: 'BOB' },
  })
}

// ---- Datos ficticios ---------------------------------------------------------

/**
 * Carpeta 1 (Mariana, asignada a Sofía): dos sesiones con tareas, diagnóstico, constancia registrada y un
 * pago. Las demás carpetas empiezan vacías para ver los estados «Sin registro».
 */
export function expedienteInicial(ids: { caso1: string; sofia: string; direccion: string }): ExpedienteSim {
  const s1 = '30000000-0000-4000-8000-000000000001'
  const s2 = '30000000-0000-4000-8000-000000000002'
  const creado = '2026-10-19T15:00:00.000Z'
  return {
    sesiones: [
      {
        id: s1,
        casoId: ids.caso1,
        numero: 1,
        fecha: '2026-10-12',
        evolucion: 'Primera entrevista. Se acuerda el encuadre y la frecuencia semanal.',
        responsableId: ids.sofia,
        creadoPor: ids.sofia,
        creadoEn: '2026-10-12T15:00:00.000Z',
      },
      {
        id: s2,
        casoId: ids.caso1,
        numero: 2,
        fecha: '2026-10-19',
        evolucion: 'Se trabaja la comunicación familiar. Buena disposición de la paciente.',
        responsableId: ids.sofia,
        creadoPor: ids.sofia,
        creadoEn: creado,
      },
    ],
    tareas: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        casoId: ids.caso1,
        sesionId: s1,
        descripcion: 'Registrar tres situaciones de la semana que generaron tensión.',
        completada: true,
        fecha: '2026-10-12',
        creadoPor: ids.sofia,
        creadoEn: '2026-10-12T15:30:00.000Z',
        cumplimientoPor: ids.sofia,
        cumplimientoEn: creado,
      },
      {
        id: '40000000-0000-4000-8000-000000000002',
        casoId: ids.caso1,
        sesionId: s2,
        descripcion: 'Conversar en familia durante la cena sin pantallas.',
        completada: false,
        fecha: '2026-10-19',
        creadoPor: ids.sofia,
        creadoEn: '2026-10-19T15:30:00.000Z',
        cumplimientoPor: null,
        cumplimientoEn: null,
      },
    ],
    diagnosticos: [
      {
        id: '50000000-0000-4000-8000-000000000001',
        casoId: ids.caso1,
        fecha: '2026-10-12',
        diagnosticoIngreso: 'Dificultades de comunicación en el sistema familiar.',
        hipotesisRelacional: null,
        comentariosClinicos: null,
        creadoPor: ids.sofia,
        creadoEn: '2026-10-12T16:00:00.000Z',
        actualizadoPor: ids.sofia,
        actualizadoEn: '2026-10-12T16:00:00.000Z',
      },
    ],
    constancias: [
      {
        id: '60000000-0000-4000-8000-000000000001',
        casoId: ids.caso1,
        procedencia: null,
        origenJudicial: false,
        estado: 'registrado',
        fechaConsentimiento: '2026-10-12',
        referenciaEvidencia: 'EVIDENCIA-DEMO',
        explicacion: null,
        contextoJudicial: null,
        creadoPor: ids.direccion,
        creadoEn: '2026-10-12T14:00:00.000Z',
        actualizadoPor: ids.direccion,
        actualizadoEn: '2026-10-12T14:00:00.000Z',
      },
    ],
    pagos: [
      {
        id: '70000000-0000-4000-8000-000000000001',
        casoId: ids.caso1,
        sesionId: s1,
        monto: '75.50',
        fecha: '2026-10-12',
        metodo: 'qr',
        referencia: null,
        registradoPor: ids.direccion,
        creadoEn: '2026-10-12T17:00:00.000Z',
      },
    ],
  }
}
