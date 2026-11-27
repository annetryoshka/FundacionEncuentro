/**
 * Recorridos guiados del botón «?» (inventario en docs/manuales/recorridos-pantallas.md).
 * Cada paso señala un elemento marcado con data-recorrido="…". Si ese elemento no está en pantalla
 * (otro rol, lista vacía, todavía cargando), el paso se omite. Un paso sin elemento va centrado.
 * El botón «?» solo aparece en pantallas con recorrido (valor distinto de null en RECORRIDOS).
 *
 * MANTENIMIENTO: si cambias una pantalla que tiene recorrido (textos, botones, campos, orden, marcas
 * data-recorrido), revisa y actualiza sus pasos aquí en el mismo cambio. Ver AGENTS.md en la raíz.
 */
import { matchRoutes } from 'react-router'
import type { Rol } from '../auth/tipos'

export interface PasoRecorrido {
  /** Valor de data-recorrido. Si varios elementos lo llevan, se resaltan juntos. */
  elemento?: string
  titulo: string
  texto: string
  /** Solo para estos roles. Sin indicar: para todos. */
  roles?: Rol[]
}

const MENU: PasoRecorrido = {
  elemento: 'menu',
  titulo: 'Menú',
  texto: 'Estas pestañas te llevan a cada sección. Siempre están arriba, en todas las pantallas.',
}

const PAGINACION: PasoRecorrido = {
  elemento: 'paginacion',
  titulo: 'Más resultados',
  texto: 'Si la lista es larga, usa «Anterior» y «Siguiente» para ver las demás páginas.',
}

const AYUDA: PasoRecorrido = {
  elemento: 'boton-ayuda',
  titulo: 'Ayuda',
  texto: 'Cuando veas este botón «?», púlsalo y te explicará cómo se usa esa pantalla.',
}

const INICIO: PasoRecorrido[] = [
  {
    titulo: 'Bienvenida',
    texto: 'Esta es la primera pantalla después de entrar. Desde aquí llegas a todo lo que puedes hacer con tu cuenta.',
  },
  MENU,
  {
    elemento: 'buscar-carpeta',
    titulo: 'Buscar una carpeta',
    texto: 'Escribe el apellido del paciente o el número de su carpeta y pulsa «Buscar».',
  },
  {
    elemento: 'registrar-paciente',
    titulo: 'Paciente nuevo',
    texto: 'Cuando llega un paciente nuevo, pulsa aquí para registrarlo y abrir su carpeta.',
  },
  {
    elemento: 'administracion',
    titulo: 'Administración',
    texto: 'Indicadores, difusión, registros antiguos y cuentas del personal. Pulsa la que necesites.',
  },
  {
    elemento: 'inicio-difusion',
    titulo: 'Difusión',
    texto: 'Tu trabajo está aquí: las publicaciones de la Fundación y el portal público que ven los visitantes.',
  },
  {
    elemento: 'cerrar-sesion',
    titulo: 'Salir',
    texto: 'Al terminar, pulsa «Cerrar sesión». Es importante si la computadora es compartida.',
  },
  AYUDA,
]

const CARPETAS: PasoRecorrido[] = [
  {
    titulo: 'Carpetas',
    texto: 'Aquí están las carpetas de todos los pacientes del centro.',
    roles: ['administrador'],
  },
  {
    titulo: 'Mis carpetas',
    texto: 'Aquí están las carpetas de tus pacientes. Solo ves las que la dirección te asignó.',
    roles: ['terapeuta'],
  },
  {
    elemento: 'buscar-carpetas',
    titulo: 'Buscar',
    texto: 'Escribe el nombre del paciente o el número de carpeta y pulsa «Buscar».',
  },
  {
    elemento: 'filtros-carpetas',
    titulo: 'Filtrar',
    texto:
      'Con estas listas ves solo algunas carpetas: por clasificación, por estado o por ciudad. «Limpiar» las quita.',
  },
  {
    elemento: 'lista-carpetas',
    titulo: 'Abrir una carpeta',
    texto: 'Pulsa sobre un paciente para abrir su carpeta. El número naranja es el número de carpeta.',
  },
  PAGINACION,
  {
    elemento: 'registrar-paciente',
    titulo: 'Paciente nuevo',
    texto: 'Para registrar a un paciente nuevo y abrir su carpeta, pulsa aquí.',
  },
]

const CARPETA: PasoRecorrido[] = [
  {
    titulo: 'La carpeta del paciente',
    texto: 'Aquí está todo sobre un paciente: sus datos, su contexto y su expediente clínico.',
  },
  {
    elemento: 'encabezado-carpeta',
    titulo: 'Datos principales',
    texto: 'Número de carpeta, nombre del paciente, clasificación y estado del caso.',
  },
  {
    elemento: 'editar-datos',
    titulo: 'Corregir datos',
    texto: 'Si un dato del paciente está mal, pulsa «Editar datos». El número de carpeta nunca cambia.',
  },
  {
    elemento: 'contexto-paciente',
    titulo: 'Contexto del paciente',
    texto: 'Familia, genograma y diagnóstico. Pulsa en cada uno para verlo o completarlo.',
  },
  {
    elemento: 'expediente',
    titulo: 'Expediente clínico',
    texto: 'Cada botón abre una parte del expediente: sesiones, historial, constancia y las demás.',
  },
  {
    elemento: 'clasificacion-estado',
    titulo: 'Clasificación y estado',
    texto: 'Indica si el caso es social o privado y en qué etapa está: iniciado, en proceso o en conclusión.',
  },
  {
    elemento: 'terapeuta',
    titulo: 'Terapeuta responsable',
    texto: 'Elige qué terapeuta atiende el caso. Ella verá esta carpeta en su lista.',
    roles: ['administrador'],
  },
  {
    elemento: 'terapeuta',
    titulo: 'Terapeuta responsable',
    texto: 'Aquí ves quién atiende el caso.',
    roles: ['terapeuta'],
  },
  {
    elemento: 'exportar',
    titulo: 'Descargar',
    texto: 'Descarga la ficha o el historial en PDF, para imprimir, o en Word, para seguir editando.',
  },
]

const APARTADOS: PasoRecorrido = {
  elemento: 'apartados',
  titulo: 'Partes de la carpeta',
  texto: 'Con estas pestañas pasas a otra parte de la carpeta sin volver atrás.',
}

const NUEVA_SESION: PasoRecorrido[] = [
  {
    titulo: 'Registrar una sesión',
    texto: 'Aquí anotas una sesión con el paciente. Solo hacen falta la fecha y la evolución.',
  },
  APARTADOS,
  {
    elemento: 'fecha-sesion',
    titulo: 'Fecha',
    texto: 'Ya viene puesta la fecha de hoy. Cámbiala si la sesión fue otro día.',
  },
  {
    elemento: 'evolucion',
    titulo: 'Evolución',
    texto: 'Escribe qué se trabajó en la sesión y cómo va el caso.',
  },
  {
    elemento: 'guardar-sesion',
    titulo: 'Guardar',
    texto: 'Pulsa «Guardar sesión». El sistema le pone el número. Si algo falla, lo que escribiste no se pierde.',
  },
]

const PAGOS: PasoRecorrido[] = [
  {
    titulo: 'Pagos',
    texto: 'Aquí registras lo que pagó el paciente. Cada pago corresponde a una sesión.',
  },
  {
    elemento: 'pagos-registrados',
    titulo: 'Pagos registrados',
    texto: 'La lista de pagos de esta carpeta y, al final, el total pagado.',
  },
  {
    elemento: 'pago-sesion',
    titulo: 'Sesión',
    texto: 'Elige la sesión que se está pagando. Solo aparecen las sesiones que todavía no tienen pago.',
  },
  {
    elemento: 'pago-monto',
    titulo: 'Monto',
    texto: 'Escribe el monto en bolivianos, por ejemplo 75,50.',
  },
  {
    elemento: 'pago-metodo',
    titulo: 'Método',
    texto: 'Marca si pagó por QR o por transferencia. En «Referencia» puedes anotar el número de comprobante.',
  },
  {
    elemento: 'registrar-pago',
    titulo: 'Registrar',
    texto: 'Pulsa «Registrar pago». Si lo pulsas dos veces con los mismos datos, no se duplica.',
  },
]

const DIFUSION: PasoRecorrido[] = [
  {
    titulo: 'Difusión',
    texto: 'Aquí preparas campañas, actividades y cursos. Los visitantes del portal solo ven lo publicado.',
  },
  {
    elemento: 'nueva-publicacion',
    titulo: 'Nueva publicación',
    texto: 'Pulsa aquí para crear una. Empieza como borrador: nadie la ve hasta que la publiques.',
  },
  {
    elemento: 'filtros-difusion',
    titulo: 'Filtrar',
    texto: 'Elige un estado o un tipo para ver solo esas publicaciones.',
  },
  {
    elemento: 'lista-publicaciones',
    titulo: 'Publicaciones',
    texto: 'Pulsa una para editarla, publicarla o retirarla. La etiqueta de la derecha dice su estado.',
  },
  PAGINACION,
]

/**
 * Todas las pantallas internas de App.tsx. Están todas (también las que aún no tienen recorrido) para que
 * una ruta fija como /carpetas/nueva no se confunda con /carpetas/:id.
 */
export const RECORRIDOS: Record<string, PasoRecorrido[] | null> = {
  '/inicio': INICIO,
  '/carpetas': CARPETAS,
  '/carpetas/nueva': null,
  '/carpetas/:id': CARPETA,
  '/carpetas/:id/familia': null,
  '/carpetas/:id/genograma': null,
  '/carpetas/:id/informes': null,
  '/carpetas/:id/informes/:versionId': null,
  '/carpetas/:id/historial': null,
  '/carpetas/:id/constancia': null,
  '/carpetas/:id/diagnostico': null,
  '/carpetas/:id/sesiones': null,
  '/carpetas/:id/sesiones/nueva': NUEVA_SESION,
  '/carpetas/:id/sesiones/:sesionId': null,
  '/carpetas/:id/pagos': PAGOS,
  '/carpetas/:id/investigacion': null,
  '/difusion': DIFUSION,
  '/difusion/nueva': null,
  '/difusion/:id': null,
  '/importaciones': null,
  '/importaciones/:id': null,
  '/investigacion': null,
  '/investigacion/exportaciones/:id': null,
  '/indicadores': null,
  '/usuarios': null,
}

const RUTAS = Object.keys(RECORRIDOS).map((path) => ({ path }))

/** Pasos de la pantalla en `ruta` para `rol`, o null si esa pantalla aún no tiene recorrido. */
export function recorridoDe(ruta: string, rol: Rol): PasoRecorrido[] | null {
  const patron = matchRoutes(RUTAS, ruta)?.[0]?.route.path
  const pasos = patron ? RECORRIDOS[patron] : null
  return pasos ? pasos.filter((p) => !p.roles || p.roles.includes(rol)) : null
}

/** Elementos visibles marcados para un paso. */
export function elementosDe(paso: PasoRecorrido): HTMLElement[] {
  if (!paso.elemento) return []
  return [...document.querySelectorAll<HTMLElement>(`[data-recorrido="${paso.elemento}"]`)].filter(
    (el) => typeof el.checkVisibility !== 'function' || el.checkVisibility(),
  )
}

/** Quita los pasos cuyo elemento no está en pantalla ahora. */
export function pasosEnPantalla(pasos: PasoRecorrido[]): PasoRecorrido[] {
  return pasos.filter((p) => !p.elemento || elementosDe(p).length > 0)
}
