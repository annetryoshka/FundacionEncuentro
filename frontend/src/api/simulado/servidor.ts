/**
 * API SIMULADA para desarrollo y demostración (npm run dev:simulado) y para las pruebas.
 * Imita EXACTAMENTE el backend real (mismos campos, permisos, códigos y mensajes):
 * - /auth/*      backend/src/modules/auth      (FE-22, FE-26)
 * - /usuarios    backend/src/modules/usuarios  (FE-29)
 * - /casos       backend/src/modules/casos     (FE-32)
 * Lo único que el backend todavía no tiene es PUT /casos/:id/terapeuta (FE-37): aquí se simula
 * según docs/api/contrato-frontend-backend.md.
 * Nunca entra al build de producción.
 */
import type { Rol } from '../../features/auth/tipos'
import type { EstadoCaso, TipoCaso } from '../../features/carpetas/tipos'

export const CONTRASENA_DEMO = 'Encuentro2026'

interface PerfilSim {
  id: string
  nombreCompleto: string
  email: string
  rol: Rol
  activo: boolean
  password: string
  creadoEn: string
}

interface CasoSim {
  id: string
  numeroCorrelativo: number
  tipo: TipoCaso
  estado: EstadoCaso
  fechaIngreso: string
  diagnosticoIngreso: string | null
  creadoEn: string
  paciente: {
    id: string
    nombreCompleto: string
    fechaNacimiento: string | null
    edadAlIngreso: number | null
    telefono: string | null
  }
  contextoJudicial: {
    juzgado: string | null
    nroExpediente: string | null
    fechaDerivacion: string | null
    observaciones: string | null
  } | null
  asignacion: { perfilId: string; asignadoPor: string; asignadoEn: string } | null
}

interface DatosSim {
  perfiles: PerfilSim[]
  casos: CasoSim[]
  contadores: Record<TipoCaso, number>
  /** accessToken → id de perfil */
  accesos: Record<string, string>
  /** refreshToken → id de perfil */
  refrescos: Record<string, string>
}

const CLAVE_ALMACEN = 'fundacion-encuentro:api-simulada:v3'
const DURACION_TOKEN_S = 3600 // lo mismo que Supabase por defecto
const SIN_PERMISO = 'No tienes permiso para realizar esta acción'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
let retardoMs = 350
// Se inicializa al final del módulo, cuando ya existen los datos ficticios.
let datos: DatosSim

/** Solo para pruebas: sin espera y con datos limpios. */
export function reiniciarSimulacion(opciones: { retardoMs?: number } = {}) {
  retardoMs = opciones.retardoMs ?? 350
  datos = datosIniciales()
  guardar()
}

/** Solo para pruebas: vence todos los tokens de acceso (los refresh tokens siguen valiendo). */
export function vencerTokensDeAcceso() {
  datos.accesos = {}
  guardar()
}

/** Solo para pruebas: invalida todas las sesiones, como si Supabase las hubiera revocado. */
export function revocarSesiones() {
  datos.accesos = {}
  datos.refrescos = {}
  guardar()
}

// ---------------------------------------------------------------------------

export async function atenderSimulado(url: string, init: RequestInit = {}): Promise<Response> {
  if (retardoMs) await new Promise((r) => setTimeout(r, retardoMs))

  const { pathname, searchParams } = new URL(url, 'http://simulado')
  const ruta = pathname.replace(/^\/api/, '')
  const metodo = (init.method ?? 'GET').toUpperCase()
  const cuerpo = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
  const cabeceras = new Headers(init.headers)

  try {
    // Rutas públicas (@Public en el backend)
    if (metodo === 'POST' && ruta === '/auth/login') return login(cuerpo)
    if (metodo === 'POST' && ruta === '/auth/refresh') return refrescar(cuerpo)

    // AuthGuard global: todo lo demás exige sesión
    const token = cabeceras.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1]
    if (!token) return error(401, 'Falta iniciar sesión')
    const perfil = datos.perfiles.find((p) => p.id === datos.accesos[token])
    if (!perfil) return error(401, 'Sesión inválida o expirada')
    if (!perfil.activo) return error(403, 'Tu usuario no tiene acceso al sistema')
    const yo = perfil
    const esAdmin = yo.rol === 'administrador'

    if (metodo === 'POST' && ruta === '/auth/logout') {
      delete datos.accesos[token]
      for (const [r, id] of Object.entries(datos.refrescos)) if (id === yo.id) delete datos.refrescos[r]
      return new Response(null, { status: 204 })
    }
    if (metodo === 'GET' && ruta === '/auth/me') return json(200, usuarioSesion(yo))

    // @Roles('administrador') en UsuariosController
    if (ruta === '/usuarios') {
      if (metodo === 'GET') return esAdmin ? json(200, listaUsuarios()) : error(403, SIN_PERMISO)
      if (metodo === 'POST') return esAdmin ? crearUsuario(cuerpo) : error(403, SIN_PERMISO)
    }
    const usuario = ruta.match(/^\/usuarios\/([^/]+)$/)
    if (usuario && (metodo === 'GET' || metodo === 'PATCH')) {
      if (!esAdmin) return error(403, SIN_PERMISO)
      if (!UUID.test(usuario[1])) return error(400, 'Validation failed (uuid is expected)')
      return metodo === 'GET' ? verUsuario(usuario[1]) : actualizarUsuario(yo, usuario[1], cuerpo)
    }

    // @Roles('administrador') en CasosController (el acceso de terapeutas llega con FE-37)
    if (ruta === '/casos') {
      if (metodo === 'GET') return esAdmin ? listarCasos(searchParams) : error(403, SIN_PERMISO)
      if (metodo === 'POST') return esAdmin ? registrarCaso(cuerpo) : error(403, SIN_PERMISO)
    }
    const caso = ruta.match(/^\/casos\/([^/]+)$/)
    if (caso && metodo === 'GET') {
      if (!esAdmin) return error(403, SIN_PERMISO)
      if (!UUID.test(caso[1])) return error(400, 'Validation failed (uuid is expected)')
      return verCaso(caso[1])
    }

    // PENDIENTE en el backend (FE-37): simulado según el contrato propuesto.
    const asignar = ruta.match(/^\/casos\/([^/]+)\/terapeuta$/)
    if (asignar && metodo === 'PUT') {
      return esAdmin ? asignarTerapeuta(yo, asignar[1], cuerpo) : error(403, SIN_PERMISO)
    }

    // Igual que NestJS cuando la ruta no existe
    return error(404, `Cannot ${metodo} ${pathname}`)
  } finally {
    guardar()
  }
}

// ---- Auth (igual que backend/src/modules/auth) ------------------------------

const usuarioSesion = (p: PerfilSim) => ({ id: p.id, nombreCompleto: p.nombreCompleto, rol: p.rol })

function abrirSesion(perfil: PerfilSim) {
  const accessToken = `sim-acceso-${crypto.randomUUID()}`
  const refreshToken = `sim-refresco-${crypto.randomUUID()}`
  datos.accesos[accessToken] = perfil.id
  datos.refrescos[refreshToken] = perfil.id
  return json(200, { accessToken, refreshToken, expiresIn: DURACION_TOKEN_S, usuario: usuarioSesion(perfil) })
}

function login({ email, password }: Record<string, unknown>) {
  if (email === 'caido@fundacion.test') throw new TypeError('Failed to fetch')
  if (!esCorreo(String(email ?? ''))) return error(400, ['El correo no tiene un formato válido'])
  const perfil = datos.perfiles.find((p) => p.email === String(email).toLowerCase())
  if (!perfil || perfil.password !== password) return error(401, 'Correo o contraseña incorrectos')
  if (!perfil.activo) return error(403, 'Tu usuario no tiene acceso al sistema')
  return abrirSesion(perfil)
}

function refrescar({ refreshToken }: Record<string, unknown>) {
  const id = datos.refrescos[String(refreshToken)]
  const perfil = datos.perfiles.find((p) => p.id === id)
  if (!perfil) return error(401, 'La sesión expiró, inicia sesión de nuevo')
  if (!perfil.activo) return error(403, 'Tu usuario no tiene acceso al sistema')
  delete datos.refrescos[String(refreshToken)] // Supabase rota el refresh token
  return abrirSesion(perfil)
}

// ---- Usuarios (igual que backend/src/modules/usuarios) ------------------------

const ROLES_VALIDOS: Rol[] = ['administrador', 'terapeuta', 'marketing']
const MSG_ROL = 'El rol debe ser administrador, terapeuta o marketing'
const publico = ({ password: _omitida, ...resto }: PerfilSim) => resto

/** Mismo orden que el backend: por fecha de creación. */
const listaUsuarios = () => [...datos.perfiles].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn)).map(publico)

function verUsuario(id: string) {
  const perfil = datos.perfiles.find((p) => p.id === id)
  return perfil ? json(200, publico(perfil)) : error(404, 'Usuario no encontrado')
}

function crearUsuario(cuerpo: Record<string, unknown>) {
  const sobrantes = sobrantesDe(cuerpo, ['email', 'password', 'nombreCompleto', 'rol'])
  const email = String(cuerpo.email ?? '')
  const password = cuerpo.password
  const nombreCompleto = cuerpo.nombreCompleto
  const rol = cuerpo.rol as Rol

  const errores = [...sobrantes]
  if (!esCorreo(email)) errores.push('El correo no tiene un formato válido')
  if (typeof password !== 'string' || password.length < 10)
    errores.push('La contraseña debe tener al menos 10 caracteres')
  else if (password.length > 72) errores.push('La contraseña no puede pasar de 72 caracteres')
  if (typeof nombreCompleto !== 'string' || !nombreCompleto) errores.push('El nombre es obligatorio')
  if (!ROLES_VALIDOS.includes(rol)) errores.push(MSG_ROL)
  if (errores.length) return error(400, errores)

  // Supabase Auth guarda el correo en minúsculas y responde email_exists → 409.
  if (datos.perfiles.some((p) => p.email === email.toLowerCase()))
    return error(409, 'Ya existe un usuario con ese correo')

  const perfil: PerfilSim = {
    id: crypto.randomUUID(),
    nombreCompleto: String(nombreCompleto).trim(),
    email: email.toLowerCase(),
    rol,
    activo: true,
    password: String(password),
    creadoEn: new Date().toISOString(),
  }
  datos.perfiles.push(perfil)
  return json(201, publico(perfil))
}

function actualizarUsuario(yo: PerfilSim, id: string, cuerpo: Record<string, unknown>) {
  const errores = sobrantesDe(cuerpo, ['nombreCompleto', 'rol', 'activo'])
  if ('nombreCompleto' in cuerpo && (typeof cuerpo.nombreCompleto !== 'string' || !cuerpo.nombreCompleto))
    errores.push('El nombre no puede quedar vacío')
  if ('rol' in cuerpo && !ROLES_VALIDOS.includes(cuerpo.rol as Rol)) errores.push(MSG_ROL)
  if ('activo' in cuerpo && typeof cuerpo.activo !== 'boolean') errores.push('activo debe ser true o false')
  if (errores.length) return error(400, errores)
  if (!Object.keys(cuerpo).length) return error(400, 'No hay nada que actualizar')
  if (id === yo.id && (cuerpo.activo === false || (cuerpo.rol && cuerpo.rol !== 'administrador')))
    return error(400, 'No puedes desactivarte ni quitarte tu propio rol de administrador')

  const perfil = datos.perfiles.find((p) => p.id === id)
  if (!perfil) return error(404, 'Usuario no encontrado')
  if (typeof cuerpo.nombreCompleto === 'string') perfil.nombreCompleto = cuerpo.nombreCompleto.trim()
  if (cuerpo.rol) perfil.rol = cuerpo.rol as Rol
  if (typeof cuerpo.activo === 'boolean') perfil.activo = cuerpo.activo
  return json(200, publico(perfil))
}

// ---- Casos (igual que backend/src/modules/casos) ------------------------------

const TIPOS: TipoCaso[] = ['derivado', 'voluntario']
const ESTADOS: EstadoCaso[] = ['iniciado', 'en_proceso', 'concluido']
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const MSG_FECHA = 'La fecha debe tener formato AAAA-MM-DD y ser una fecha real'

function persona(id: string | null | undefined) {
  const p = datos.perfiles.find((x) => x.id === id)
  return p ? { id: p.id, nombreCompleto: p.nombreCompleto } : null
}

/** Lo que devuelve GET /casos/:id. terapeuta/asignadoPor/asignadoEn son la propuesta de FE-37. */
function detalle(caso: CasoSim) {
  const { asignacion, ...resto } = caso
  return {
    ...resto,
    hipotesisRelacional: null,
    comentariosClinicos: null,
    terapeuta: persona(asignacion?.perfilId),
    asignadoPor: persona(asignacion?.asignadoPor),
    asignadoEn: asignacion?.asignadoEn ?? null,
  }
}

function listarCasos(params: URLSearchParams) {
  const tipo = params.get('tipo')
  const estado = params.get('estado')
  const q = params.get('q')?.trim() ?? ''
  const limite = params.has('limite') ? Number(params.get('limite')) : 20
  const desplazamiento = params.has('desplazamiento') ? Number(params.get('desplazamiento')) : 0

  const errores: string[] = []
  if (tipo && !TIPOS.includes(tipo as TipoCaso))
    errores.push(`tipo must be one of the following values: ${TIPOS.join(', ')}`)
  if (estado && !ESTADOS.includes(estado as EstadoCaso))
    errores.push(`estado must be one of the following values: ${ESTADOS.join(', ')}`)
  if (q.length > 100) errores.push('q must be shorter than or equal to 100 characters')
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) errores.push('limite must not be greater than 100')
  if (!Number.isInteger(desplazamiento) || desplazamiento < 0) errores.push('desplazamiento must not be less than 0')
  if (errores.length) return error(400, errores)

  // Igual que el backend: position(lower(q) in lower(nombre)) — distingue tildes.
  const lista = datos.casos
    .filter((c) => (!tipo || c.tipo === tipo) && (!estado || c.estado === estado))
    .filter((c) => !q || c.paciente.nombreCompleto.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso) || b.numeroCorrelativo - a.numeroCorrelativo)

  return json(200, {
    datos: lista.slice(desplazamiento, desplazamiento + limite).map((c) => ({
      id: c.id,
      tipo: c.tipo,
      numeroCorrelativo: c.numeroCorrelativo,
      estado: c.estado,
      fechaIngreso: c.fechaIngreso,
      paciente: { id: c.paciente.id, nombreCompleto: c.paciente.nombreCompleto },
    })),
    total: lista.length,
    limite,
    desplazamiento,
  })
}

function verCaso(id: string) {
  const caso = datos.casos.find((c) => c.id === id)
  return caso ? json(200, detalle(caso)) : error(404, 'Caso no encontrado')
}

const limpiar = (valor: unknown) => (typeof valor === 'string' && valor.trim() ? valor.trim() : null)

function registrarCaso(cuerpo: Record<string, unknown>) {
  const paciente = (cuerpo.paciente ?? undefined) as Record<string, unknown> | undefined
  const caso = (cuerpo.caso ?? undefined) as Record<string, unknown> | undefined
  const judicial = (cuerpo.contextoJudicial ?? undefined) as Record<string, unknown> | undefined

  const errores = sobrantesDe(cuerpo, ['paciente', 'caso', 'contextoJudicial'])
  if (!paciente) errores.push('Faltan los datos del paciente')
  if (!caso) errores.push('Faltan los datos del caso')
  if (paciente) {
    errores.push(
      ...sobrantesDe(paciente, ['nombreCompleto', 'fechaNacimiento', 'edadAlIngreso', 'telefono'], 'paciente.'),
    )
    if (typeof paciente.nombreCompleto !== 'string' || !paciente.nombreCompleto)
      errores.push('paciente.El nombre del paciente es obligatorio')
    if (paciente.fechaNacimiento !== undefined && !esFecha(paciente.fechaNacimiento))
      errores.push(`paciente.${MSG_FECHA}`)
  }
  if (caso) {
    errores.push(
      ...sobrantesDe(
        caso,
        ['tipo', 'estado', 'fechaIngreso', 'diagnosticoIngreso', 'hipotesisRelacional', 'comentariosClinicos'],
        'caso.',
      ),
    )
    if (!TIPOS.includes(caso.tipo as TipoCaso)) errores.push('caso.El tipo de caso debe ser derivado o voluntario')
    if (caso.estado !== undefined && !ESTADOS.includes(caso.estado as EstadoCaso))
      errores.push('caso.El estado debe ser iniciado, en_proceso o concluido')
    if (caso.fechaIngreso !== undefined && !esFecha(caso.fechaIngreso)) errores.push(`caso.${MSG_FECHA}`)
  }
  if (judicial) {
    errores.push(
      ...sobrantesDe(judicial, ['juzgado', 'nroExpediente', 'fechaDerivacion', 'observaciones'], 'contextoJudicial.'),
    )
    if (judicial.fechaDerivacion !== undefined && !esFecha(judicial.fechaDerivacion))
      errores.push(`contextoJudicial.${MSG_FECHA}`)
  }
  if (errores.length || !paciente || !caso) return error(400, errores)

  const tipo = caso.tipo as TipoCaso
  if (tipo === 'voluntario' && judicial) return error(400, 'Un caso voluntario no lleva contexto judicial')
  const nombre = String(paciente.nombreCompleto).trim()
  if (!nombre) return error(400, 'El nombre del paciente es obligatorio')

  const hoy = hoyIso()
  const fechaIngreso = (caso.fechaIngreso as string | undefined) ?? hoy
  if (fechaIngreso > hoy) return error(400, 'La fecha de ingreso no puede ser futura')
  const fechaNacimiento = (paciente.fechaNacimiento as string | undefined) ?? null
  if (fechaNacimiento && fechaNacimiento > fechaIngreso)
    return error(400, 'La fecha de nacimiento no puede ser posterior al ingreso')

  const similares = datos.casos
    .map((c) => c.paciente)
    .filter((p, i, todos) => todos.findIndex((x) => x.id === p.id) === i)
    .map((p) => ({
      pacienteId: p.id,
      nombreCompleto: p.nombreCompleto,
      similitud: similitud(p.nombreCompleto, nombre),
    }))
    .filter((p) => p.similitud > 0.6)
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, 5)
    .map((p) => ({ ...p, similitud: Number(p.similitud.toFixed(2)) }))

  datos.contadores[tipo] += 1
  const nuevo: CasoSim = {
    id: crypto.randomUUID(),
    numeroCorrelativo: datos.contadores[tipo],
    tipo,
    estado: (caso.estado as EstadoCaso | undefined) ?? 'iniciado',
    fechaIngreso,
    diagnosticoIngreso: limpiar(caso.diagnosticoIngreso),
    creadoEn: new Date().toISOString(),
    paciente: {
      id: crypto.randomUUID(),
      nombreCompleto: nombre,
      fechaNacimiento,
      edadAlIngreso:
        typeof paciente.edadAlIngreso === 'number'
          ? paciente.edadAlIngreso
          : fechaNacimiento
            ? edad(fechaNacimiento, fechaIngreso)
            : null,
      telefono: limpiar(paciente.telefono),
    },
    contextoJudicial: judicial
      ? {
          juzgado: limpiar(judicial.juzgado),
          nroExpediente: limpiar(judicial.nroExpediente),
          fechaDerivacion: (judicial.fechaDerivacion as string | undefined) ?? null,
          observaciones: limpiar(judicial.observaciones),
        }
      : null,
    asignacion: null,
  }
  datos.casos.push(nuevo)
  return json(201, { ...detalle(nuevo), posiblesDuplicados: similares })
}

function asignarTerapeuta(yo: PerfilSim, id: string, cuerpo: Record<string, unknown>) {
  const caso = datos.casos.find((c) => c.id === id)
  if (!caso) return error(404, 'Caso no encontrado')
  const terapeuta = datos.perfiles.find((p) => p.id === cuerpo.perfilId)
  if (!terapeuta || terapeuta.rol !== 'terapeuta' || !terapeuta.activo) {
    return error(400, 'La persona elegida no es una terapeuta activa')
  }
  caso.asignacion = { perfilId: terapeuta.id, asignadoPor: yo.id, asignadoEn: new Date().toISOString() }
  return json(200, detalle(caso))
}

/** Similitud de trigramas, como extensions.similarity() de pg_trgm. */
function similitud(a: string, b: string) {
  const trigramas = (texto: string) => {
    const conjunto = new Set<string>()
    for (const palabra of texto
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)) {
      const p = `  ${palabra} `
      for (let i = 0; i < p.length - 2; i++) conjunto.add(p.slice(i, i + 3))
    }
    return conjunto
  }
  const ta = trigramas(a)
  const tb = trigramas(b)
  const comunes = [...ta].filter((t) => tb.has(t)).length
  const union = ta.size + tb.size - comunes
  return union ? comunes / union : 0
}

function edad(nacimiento: string, referencia: string) {
  const [an, mn, dn] = nacimiento.split('-').map(Number)
  const [ar, mr, dr] = referencia.split('-').map(Number)
  return ar - an - (mr < mn || (mr === mn && dr < dn) ? 1 : 0)
}

// ---- Utilidades ------------------------------------------------------------

function json(estado: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } })
}

function error(estado: number, mensaje: string | string[], extra: Record<string, unknown> = {}) {
  return json(estado, { statusCode: estado, message: mensaje, ...extra })
}

const esCorreo = (texto: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)

/** AAAA-MM-DD y fecha real (como @Matches + @IsISO8601({ strict: true })). */
function esFecha(valor: unknown) {
  if (typeof valor !== 'string' || !FECHA.test(valor)) return false
  const [a, m, d] = valor.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d))
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
}

/** ValidationPipe con forbidNonWhitelisted: rechaza propiedades que el DTO no declara. */
function sobrantesDe(objeto: Record<string, unknown>, permitidas: string[], prefijo = '') {
  return Object.keys(objeto)
    .filter((k) => !permitidas.includes(k))
    .map((k) => `${prefijo}property ${k} should not exist`)
}

function hoyIso() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

function cargar(): DatosSim {
  try {
    const guardado = localStorage.getItem(CLAVE_ALMACEN)
    if (guardado) return JSON.parse(guardado) as DatosSim
  } catch {
    // Sin almacenamiento disponible: se usan los datos iniciales.
  }
  return datosIniciales()
}

function guardar() {
  try {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(datos))
  } catch {
    // Modo privado o almacenamiento bloqueado: los datos viven solo en memoria.
  }
}

// ---- Datos ficticios ------------------------------------------------------

const ID = {
  direccion: '00000000-0000-4000-8000-000000000001',
  sofia: '00000000-0000-4000-8000-000000000002',
  carla: '00000000-0000-4000-8000-000000000003',
  elena: '00000000-0000-4000-8000-000000000004',
  diego: '00000000-0000-4000-8000-000000000005',
}

function datosIniciales(): DatosSim {
  const creado = '2026-10-06T14:00:00.000Z'
  const perfil = (id: string, nombreCompleto: string, email: string, rol: Rol, activo = true): PerfilSim => ({
    id,
    nombreCompleto,
    email,
    rol,
    activo,
    password: CONTRASENA_DEMO,
    creadoEn: creado,
  })

  const pacientes: [string, TipoCaso, EstadoCaso, string, string | null][] = [
    ['Mariana Gutiérrez Paz', 'voluntario', 'en_proceso', '2026-03-12', ID.sofia],
    ['Familia Condori Apaza', 'derivado', 'en_proceso', '2026-04-02', ID.sofia],
    ['Javier Tórrez Villca', 'voluntario', 'concluido', '2026-04-20', ID.carla],
    ['Lucía Fernández Roca', 'voluntario', 'iniciado', '2026-05-08', null],
    ['Andrés Mamani Quispe', 'derivado', 'en_proceso', '2026-05-15', ID.carla],
    ['Valeria Ríos Céspedes', 'voluntario', 'en_proceso', '2026-06-01', ID.sofia],
    ['Familia Huanca Limachi', 'derivado', 'iniciado', '2026-06-19', ID.carla],
    ['Gabriel Ortiz Salazar', 'voluntario', 'concluido', '2026-07-03', ID.sofia],
    ['Camila Vargas Aliaga', 'voluntario', 'en_proceso', '2026-07-22', null],
    ['Mateo Chávez Ticona', 'derivado', 'iniciado', '2026-08-10', ID.sofia],
    ['Daniela Rojas Paredes', 'voluntario', 'iniciado', '2026-08-28', ID.carla],
    ['Familia Nina Calle', 'voluntario', 'en_proceso', '2026-09-09', null],
    ['Sebastián López Arce', 'derivado', 'iniciado', '2026-09-25', null],
    ['Paola Gutiérrez Mendoza', 'voluntario', 'iniciado', '2026-10-05', ID.carla],
  ]

  const contadores: Record<TipoCaso, number> = { voluntario: 0, derivado: 0 }
  const casos: CasoSim[] = pacientes.map(([nombre, tipo, estado, fechaIngreso, terapeuta], i) => ({
    id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    numeroCorrelativo: (contadores[tipo] += 1),
    tipo,
    estado,
    fechaIngreso,
    diagnosticoIngreso: null,
    creadoEn: `${fechaIngreso}T14:00:00.000Z`,
    paciente: {
      id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      nombreCompleto: nombre,
      fechaNacimiento: null,
      edadAlIngreso: null,
      telefono: null,
    },
    contextoJudicial:
      tipo === 'derivado'
        ? {
            juzgado: 'Juzgado Público de Familia 3.º',
            nroExpediente: null,
            fechaDerivacion: fechaIngreso,
            observaciones: null,
          }
        : null,
    asignacion: terapeuta
      ? { perfilId: terapeuta, asignadoPor: ID.direccion, asignadoEn: `${fechaIngreso}T15:00:00.000Z` }
      : null,
  }))

  return {
    perfiles: [
      perfil(ID.direccion, 'Laura Quiroga', 'direccion@fundacion.test', 'administrador'),
      perfil(ID.sofia, 'Sofía Mamani', 'terapeuta1@fundacion.test', 'terapeuta'),
      perfil(ID.carla, 'Carla Rojas', 'terapeuta2@fundacion.test', 'terapeuta'),
      perfil(ID.elena, 'Elena Choque', 'inactiva@fundacion.test', 'terapeuta', false),
      perfil(ID.diego, 'Diego Flores', 'apoyo@fundacion.test', 'marketing'),
    ],
    casos,
    contadores,
    accesos: {},
    refrescos: {},
  }
}

datos = cargar()
