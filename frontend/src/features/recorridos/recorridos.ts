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
    texto: 'Indicadores, gastos del mes, difusión, registros antiguos y cuentas del personal. Pulsa la que necesites.',
  },
  {
    elemento: 'inicio-difusion',
    titulo: 'Difusión',
    texto:
      'Tu trabajo está aquí: las publicaciones, los artículos de investigación y el portal público que ven los visitantes.',
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
    elemento: 'expediente',
    titulo: 'Expediente clínico',
    texto: 'Cada botón abre una parte del expediente: sesiones, historial, constancia y las demás.',
  },
  {
    elemento: 'contexto-paciente',
    titulo: 'Contexto del paciente',
    texto: 'Familia, genograma y diagnóstico. Pulsa en cada uno para verlo o completarlo.',
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

const NUEVA_CARPETA: PasoRecorrido[] = [
  {
    titulo: 'Registrar un paciente',
    texto:
      'Aquí registras a un paciente nuevo. Al guardar se abre su carpeta. Los datos clínicos se completan después.',
  },
  {
    elemento: 'nombre-paciente',
    titulo: 'Nombre',
    texto: 'Escribe el nombre completo. Si es una familia, puedes poner, por ejemplo, «Familia Quispe Mamani».',
  },
  {
    elemento: 'fecha-ingreso',
    titulo: 'Fecha de ingreso',
    texto: 'Ya viene puesta la fecha de hoy. Cámbiala si el paciente llegó otro día.',
  },
  {
    elemento: 'tipo-ingreso',
    titulo: '¿Cómo llegó?',
    texto: 'Marca «Voluntario» si vino por su cuenta, o «Derivado» si lo envió una institución, como un juzgado.',
  },
  {
    elemento: 'residencia',
    titulo: 'Ciudad',
    texto: 'Dónde vive el paciente. Si no lo sabes, déjalo vacío y se completa después.',
  },
  {
    elemento: 'registrar-carpeta',
    titulo: 'Guardar',
    texto: 'Pulsa «Registrar y abrir carpeta». El número de carpeta lo pone el sistema y no se puede cambiar.',
  },
]

const SESIONES: PasoRecorrido[] = [
  {
    titulo: 'Sesiones y tareas',
    texto: 'Aquí están todas las sesiones de este paciente, de la más antigua a la más reciente.',
  },
  {
    elemento: 'registrar-sesion',
    titulo: 'Sesión nueva',
    texto: 'Después de atender al paciente, pulsa «Registrar sesión» para anotarla.',
  },
  {
    elemento: 'lista-sesiones',
    titulo: 'Abrir una sesión',
    texto: 'Pulsa una sesión para leerla y ver sus tareas. La etiqueta de la derecha dice cuántas tareas faltan.',
  },
  APARTADOS,
]

const SESION: PasoRecorrido[] = [
  {
    titulo: 'Una sesión',
    texto: 'Aquí ves lo que se anotó en esta sesión y las tareas que se dejaron al paciente o a la familia.',
  },
  {
    elemento: 'detalle-sesion',
    titulo: 'Evolución',
    texto: 'Número y fecha de la sesión, quién la atendió y lo que se trabajó.',
  },
  {
    elemento: 'lista-tareas',
    titulo: 'Tareas',
    texto:
      'Cuando el paciente cumpla una tarea, pulsa «Marcar como realizada». Si te equivocas, puedes volverla a pendiente.',
  },
  {
    elemento: 'nueva-tarea',
    titulo: 'Tarea nueva',
    texto: 'Escribe la actividad para antes de la próxima sesión y pulsa «Agregar tarea».',
  },
  {
    elemento: 'ver-sesiones',
    titulo: 'Volver',
    texto: 'Con «Ver todas las sesiones» vuelves a la lista.',
  },
]

const DIAGNOSTICO: PasoRecorrido[] = [
  {
    titulo: 'Ficha de diagnóstico',
    texto:
      'Aquí se anota la evaluación del caso. Cada carpeta tiene una sola ficha, que se puede corregir cuando haga falta.',
  },
  {
    elemento: 'crear-ficha',
    titulo: 'Crear la ficha',
    texto: 'Esta carpeta todavía no tiene ficha. Pulsa «Crear ficha» para empezar.',
  },
  {
    elemento: 'ficha-diagnostico',
    titulo: 'La ficha',
    texto: 'Fecha de la evaluación, quién la escribió y lo registrado en cada apartado.',
  },
  {
    elemento: 'editar-ficha',
    titulo: 'Corregir o completar',
    texto: 'Pulsa «Editar ficha» para cambiar o completar lo escrito.',
  },
  {
    elemento: 'evaluacion-inicial',
    titulo: 'Evaluación inicial',
    texto: 'Es lo único obligatorio. El diagnóstico, la hipótesis y los comentarios se pueden completar después.',
  },
  {
    elemento: 'guardar-ficha',
    titulo: 'Guardar',
    texto: 'Pulsa «Guardar ficha». Si algo falla, lo que escribiste no se pierde.',
  },
  APARTADOS,
]

const FAMILIA: PasoRecorrido[] = [
  {
    titulo: 'Composición familiar',
    texto:
      'Aquí se anota quiénes forman la familia del paciente. Cada persona se describe por su relación con él o ella.',
  },
  {
    elemento: 'registrar-familia',
    titulo: 'Empezar',
    texto: 'Todavía no hay nadie anotado. Pulsa «Registrar composición familiar» para empezar.',
  },
  {
    elemento: 'lista-familia',
    titulo: 'Integrantes',
    texto: 'Cada tarjeta es una persona: parentesco, nombre, edad, ocupación y si vive con el paciente.',
  },
  {
    elemento: 'editar-familia',
    titulo: 'Cambiar',
    texto: 'Pulsa «Editar composición» para agregar, corregir o quitar integrantes.',
  },
  {
    elemento: 'agregar-integrante',
    titulo: 'Agregar a alguien',
    texto:
      'Pulsa «Agregar integrante» por cada persona. Si no conoces un dato, déjalo vacío. Para sacar a alguien, usa «Quitar integrante» en su tarjeta.',
  },
  {
    elemento: 'guardar-familia',
    titulo: 'Guardar',
    texto: 'Al terminar, pulsa «Guardar composición». Nada cambia hasta que guardes.',
  },
  APARTADOS,
]

const GENOGRAMA: PasoRecorrido[] = [
  {
    titulo: 'Genograma',
    texto:
      'El genograma se dibuja en el programa GenoPro. Aquí se guarda el archivo exportado para verlo junto a la carpeta.',
  },
  {
    elemento: 'genograma-actual',
    titulo: 'El genograma actual',
    texto: 'Aquí lo ves, junto con quién lo subió y cuándo.',
  },
  {
    elemento: 'genograma-acciones',
    titulo: 'Verlo mejor',
    texto: 'Con estos botones lo ves más grande, lo abres en otra pestaña o lo descargas.',
  },
  {
    elemento: 'subir-genograma',
    titulo: 'Subir o reemplazar',
    texto:
      'Elige el archivo exportado de GenoPro (PDF, PNG o JPEG, hasta 5 MB) y pulsa el botón verde. Si ya había uno, el nuevo lo reemplaza.',
  },
  APARTADOS,
]

const HISTORIAL: PasoRecorrido[] = [
  {
    titulo: 'Historial clínico',
    texto: 'Todo el caso en una sola página, para leerlo de corrido. Aquí no se cambia nada.',
  },
  {
    elemento: 'historial-identificacion',
    titulo: 'Identificación',
    texto: 'Los datos básicos del paciente y de su carpeta.',
  },
  {
    elemento: 'historial-constancia',
    titulo: 'Partes numeradas',
    texto: 'Debajo siguen constancia, diagnóstico y sesiones. Para corregir algo, pulsa «Abrir» en esa parte.',
  },
  {
    elemento: 'historial-sesiones',
    titulo: 'Sesiones y tareas',
    texto: 'Todas las sesiones en orden, cada una con sus tareas.',
  },
  {
    titulo: 'Descargar',
    texto: 'Para tenerlo en PDF o Word, vuelve a la carpeta del paciente y usa «Exportar a PDF o Word».',
  },
]

const ARTICULOS: PasoRecorrido[] = [
  {
    titulo: 'Artículos de investigación',
    texto:
      'Aquí se preparan los artículos que la Fundación comparte en «Investigaciones» del portal público. No llevan datos de pacientes ni comentarios.',
  },
  {
    elemento: 'nuevo-articulo',
    titulo: 'Escribir uno nuevo',
    texto: 'Pulsa «Nuevo artículo». Se guarda como borrador: nadie de afuera lo ve hasta que lo publiques.',
  },
  {
    elemento: 'filtro-articulos',
    titulo: 'Filtrar',
    texto: 'Elige un estado para ver solo los borradores, los publicados o los retirados.',
  },
  {
    elemento: 'lista-articulos',
    titulo: 'Abrir un artículo',
    texto: 'Pulsa un artículo para corregirlo, publicarlo o retirarlo del portal.',
  },
  PAGINACION,
  MENU,
]

const GASTOS: PasoRecorrido[] = [
  {
    titulo: 'Gastos del mes',
    texto: 'Aquí se anotan los gastos de funcionamiento de la Fundación: internet, electricidad, alquiler y otros.',
  },
  {
    elemento: 'gastos-mes',
    titulo: 'Elegir el mes',
    texto: 'Con las flechas o el calendario pasas de un mes a otro. Todo lo de abajo es del mes elegido.',
  },
  {
    elemento: 'gastos-totales',
    titulo: 'Totales',
    texto: 'Lo gastado en el mes y cuánto fue en cada tipo de gasto. Los gastos anulados no suman.',
  },
  {
    elemento: 'gastos-registrar',
    titulo: 'Registrar un gasto',
    texto:
      'Elige el tipo, la fecha y el monto en bolivianos, y pulsa «Guardar gasto». En «Otros gastos» escribe también qué fue.',
  },
  {
    elemento: 'gastos-lista',
    titulo: 'Gastos del mes',
    texto: 'Cada gasto anotado, con su fecha y monto.',
  },
  {
    elemento: 'gastos-acciones',
    titulo: 'Corregir o anular',
    texto:
      'Si un gasto se anotó mal, pulsa «Corregir». Si no debía estar, pulsa «Anular»: queda a la vista como anulado y deja de sumar.',
  },
  MENU,
]

/**
 * Todas las pantallas internas de App.tsx. Están todas (también las que aún no tienen recorrido) para que
 * una ruta fija como /carpetas/nueva no se confunda con /carpetas/:id.
 */
export const RECORRIDOS: Record<string, PasoRecorrido[] | null> = {
  '/inicio': INICIO,
  '/carpetas': CARPETAS,
  '/carpetas/nueva': NUEVA_CARPETA,
  '/carpetas/:id': CARPETA,
  '/carpetas/:id/familia': FAMILIA,
  '/carpetas/:id/genograma': GENOGRAMA,
  '/carpetas/:id/informes': null,
  '/carpetas/:id/informes/:versionId': null,
  '/carpetas/:id/historial': HISTORIAL,
  '/carpetas/:id/constancia': null,
  '/carpetas/:id/diagnostico': DIAGNOSTICO,
  '/carpetas/:id/sesiones': SESIONES,
  '/carpetas/:id/sesiones/nueva': NUEVA_SESION,
  '/carpetas/:id/sesiones/:sesionId': SESION,
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
  '/gastos': GASTOS,
  '/articulos': ARTICULOS,
  '/articulos/nuevo': null,
  '/articulos/:id': null,
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
