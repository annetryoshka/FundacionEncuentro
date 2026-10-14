/**
 * API SIMULADA para desarrollo y demostración (npm run dev:simulado) y para las pruebas.
 * - /auth/* imita EXACTAMENTE el backend real (backend/src/modules/auth): mismos campos,
 *   mismos códigos y mensajes de error.
 * - /usuarios y /carpetas imitan docs/api/contrato-frontend-backend.md (endpoints que el
 *   backend todavía no tiene), con las reglas de permisos por rol y por caso.
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
  numero: number
  tipo: TipoCaso
  estado: EstadoCaso
  fechaIngreso: string
  paciente: { id: string; nombreCompleto: string }
  creadoPor: string | null
  creadoEn: string
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

const CLAVE_ALMACEN = 'fundacion-encuentro:api-simulada:v2'
const DURACION_TOKEN_S = 3600 // lo mismo que Supabase por defecto
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

    // Guard global: todo lo demás exige sesión
    const token = cabeceras.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1]
    if (!token) return error(401, 'Falta iniciar sesión')
    const perfil = datos.perfiles.find((p) => p.id === datos.accesos[token])
    if (!perfil) return error(401, 'Sesión inválida o expirada')
    if (!perfil.activo) return error(403, 'Tu usuario no tiene acceso al sistema')
    const yo = perfil

    if (metodo === 'POST' && ruta === '/auth/logout') {
      delete datos.accesos[token]
      for (const [r, id] of Object.entries(datos.refrescos)) if (id === yo.id) delete datos.refrescos[r]
      return new Response(null, { status: 204 })
    }
    if (metodo === 'GET' && ruta === '/auth/me') return json(200, usuarioSesion(yo))

    if (ruta === '/usuarios') {
      if (yo.rol !== 'administrador') return error(403, 'Solo administración')
      if (metodo === 'GET') return listarUsuarios(searchParams)
      if (metodo === 'POST') return crearUsuario(cuerpo)
    }

    if (ruta === '/carpetas') {
      if (metodo === 'GET') return listarCarpetas(yo, searchParams)
      if (metodo === 'POST')
        return yo.rol === 'administrador' ? crearCarpeta(yo, cuerpo) : error(403, 'Solo administración')
    }

    const detalle = ruta.match(/^\/carpetas\/([^/]+)$/)
    if (detalle && metodo === 'GET') return verCarpeta(yo, detalle[1])

    const asignar = ruta.match(/^\/carpetas\/([^/]+)\/terapeuta$/)
    if (asignar && metodo === 'PUT') {
      return yo.rol === 'administrador' ? asignarTerapeuta(yo, asignar[1], cuerpo) : error(403, 'Solo administración')
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? ''))) {
    return error(400, ['El correo no tiene un formato válido'])
  }
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

// ---- Usuarios -------------------------------------------------------------

const publico = ({ password: _omitida, ...resto }: PerfilSim) => resto

function listarUsuarios(params: URLSearchParams) {
  let lista = [...datos.perfiles]
  const rol = params.get('rol')
  if (rol) lista = lista.filter((p) => p.rol === rol)
  if (params.get('activo') === 'true') lista = lista.filter((p) => p.activo)
  lista.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'))
  return json(200, { usuarios: lista.map(publico) })
}

function crearUsuario(cuerpo: Record<string, unknown>) {
  const nombreCompleto = String(cuerpo.nombreCompleto ?? '').trim()
  const email = String(cuerpo.email ?? '')
    .trim()
    .toLowerCase()
  const rol = cuerpo.rol as Rol
  const password = String(cuerpo.password ?? '')

  const errores: string[] = []
  if (!nombreCompleto) errores.push('nombreCompleto es obligatorio')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push('El correo no tiene un formato válido')
  if (!['administrador', 'terapeuta', 'marketing'].includes(rol)) errores.push('rol no es válido')
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errores.push('password no cumple la política')
  }
  if (errores.length) return error(400, errores)
  if (datos.perfiles.some((p) => p.email === email)) return error(409, 'Ya existe una cuenta con ese correo')

  const perfil: PerfilSim = {
    id: crypto.randomUUID(),
    nombreCompleto,
    email,
    rol,
    activo: true,
    password,
    creadoEn: new Date().toISOString(),
  }
  datos.perfiles.push(perfil)
  return json(201, publico(perfil))
}

// ---- Carpetas -------------------------------------------------------------

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

function puedeVer(yo: PerfilSim, caso: CasoSim) {
  if (yo.rol === 'administrador') return true
  if (yo.rol === 'terapeuta') return caso.asignacion?.perfilId === yo.id
  return false
}

function persona(id: string | null | undefined) {
  const p = datos.perfiles.find((x) => x.id === id)
  return p ? { id: p.id, nombreCompleto: p.nombreCompleto } : null
}

function resumen(caso: CasoSim) {
  return {
    id: caso.id,
    numero: caso.numero,
    tipo: caso.tipo,
    estado: caso.estado,
    fechaIngreso: caso.fechaIngreso,
    paciente: caso.paciente,
    terapeuta: persona(caso.asignacion?.perfilId),
  }
}

function detalle(caso: CasoSim) {
  return {
    ...resumen(caso),
    creadoPor: persona(caso.creadoPor),
    creadoEn: caso.creadoEn,
    asignadoPor: persona(caso.asignacion?.asignadoPor),
    asignadoEn: caso.asignacion?.asignadoEn ?? null,
  }
}

function listarCarpetas(yo: PerfilSim, params: URLSearchParams) {
  if (yo.rol === 'marketing') return error(403, 'Sin acceso a información clínica')

  const busqueda = normalizar(params.get('busqueda') ?? '')
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)
  const tamano = Math.min(50, Math.max(1, Number(params.get('tamano')) || 10))

  let lista = datos.casos.filter((c) => puedeVer(yo, c))
  if (/^\d+$/.test(busqueda)) {
    lista = lista.filter((c) => c.numero === Number(busqueda))
  } else if (busqueda) {
    const palabras = busqueda.split(' ')
    lista = lista.filter((c) => palabras.every((p) => normalizar(c.paciente.nombreCompleto).includes(p)))
  }
  lista.sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso) || b.numero - a.numero)

  return json(200, {
    carpetas: lista.slice((pagina - 1) * tamano, pagina * tamano).map(resumen),
    total: lista.length,
    pagina,
    tamano,
  })
}

function verCarpeta(yo: PerfilSim, id: string) {
  if (yo.rol === 'marketing') return error(403, 'Sin acceso a información clínica')
  const caso = datos.casos.find((c) => c.id === id)
  // Un caso ajeno responde igual que uno inexistente: no se revela que existe.
  if (!caso || !puedeVer(yo, caso)) return error(404, 'Carpeta no encontrada')
  return json(200, detalle(caso))
}

function crearCarpeta(yo: PerfilSim, cuerpo: Record<string, unknown>) {
  const nombreCompleto = String(cuerpo.nombreCompleto ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  const fechaIngreso = String(cuerpo.fechaIngreso ?? '')
  const tipo = cuerpo.tipo as TipoCaso

  const errores: string[] = []
  if (nombreCompleto.length < 3) errores.push('nombreCompleto es obligatorio')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso) || fechaIngreso > hoyIso()) errores.push('fechaIngreso no es válida')
  if (!['voluntario', 'derivado'].includes(tipo)) errores.push('tipo no es válido')
  if (errores.length) return error(400, errores)

  const duplicados = datos.casos.filter((c) => normalizar(c.paciente.nombreCompleto) === normalizar(nombreCompleto))
  if (duplicados.length) {
    return error(409, 'Posible paciente duplicado', {
      posiblesDuplicados: duplicados.map((c) => ({
        id: c.id,
        numero: c.numero,
        tipo: c.tipo,
        nombreCompleto: c.paciente.nombreCompleto,
      })),
    })
  }

  datos.contadores[tipo] += 1
  const caso: CasoSim = {
    id: crypto.randomUUID(),
    numero: datos.contadores[tipo],
    tipo,
    estado: 'iniciado',
    fechaIngreso,
    paciente: { id: crypto.randomUUID(), nombreCompleto },
    creadoPor: yo.id,
    creadoEn: new Date().toISOString(),
    asignacion: null,
  }
  datos.casos.push(caso)
  return json(201, detalle(caso))
}

function asignarTerapeuta(yo: PerfilSim, id: string, cuerpo: Record<string, unknown>) {
  const caso = datos.casos.find((c) => c.id === id)
  if (!caso) return error(404, 'Carpeta no encontrada')
  const terapeuta = datos.perfiles.find((p) => p.id === cuerpo.perfilId)
  if (!terapeuta || terapeuta.rol !== 'terapeuta' || !terapeuta.activo) {
    return error(400, 'La persona elegida no es una terapeuta activa')
  }
  caso.asignacion = { perfilId: terapeuta.id, asignadoPor: yo.id, asignadoEn: new Date().toISOString() }
  return json(200, detalle(caso))
}

// ---- Utilidades ------------------------------------------------------------

function json(estado: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } })
}

function error(estado: number, mensaje: string | string[], extra: Record<string, unknown> = {}) {
  return json(estado, { statusCode: estado, message: mensaje, ...extra })
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
    numero: (contadores[tipo] += 1),
    tipo,
    estado,
    fechaIngreso,
    paciente: { id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, nombreCompleto: nombre },
    creadoPor: ID.direccion,
    creadoEn: `${fechaIngreso}T14:00:00.000Z`,
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
