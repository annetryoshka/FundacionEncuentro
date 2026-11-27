/**
 * FE-187 · Artículos de investigación públicos, sin comentarios (alcance FE-182, API FE-184).
 * Gestión: administración y marketing. Portal: visitantes sin cuenta. Nada se lee de los expedientes.
 */
import { peticion } from '../../api/cliente'
import { esRutaRelativa, urlImagenDifusion } from '../difusion/difusion'
import type { InvestigacionPublica } from '../publico/investigaciones'

export type EstadoArticulo = 'borrador' | 'publicado' | 'retirado'

export const NOMBRE_ESTADO_ARTICULO: Record<EstadoArticulo, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  retirado: 'Retirado',
}

/** Mismo ciclo que difusión: borrador → publicado → retirado → borrador. Otro salto responde 409. */
export const SIGUIENTE_ESTADO_ARTICULO: Record<
  EstadoArticulo,
  { estado: EstadoArticulo; accion: string; ayuda: string }
> = {
  borrador: { estado: 'publicado', accion: 'Publicar', ayuda: 'Se verá en «Investigaciones» del portal público.' },
  publicado: { estado: 'retirado', accion: 'Retirar del portal', ayuda: 'Deja de verse en el portal público.' },
  retirado: { estado: 'borrador', accion: 'Volver a borrador', ayuda: 'Queda como borrador para corregirlo.' },
}

export interface ImagenArticulo {
  ruta: string
  textoAlternativo: string
  ancho?: number | null
  alto?: number | null
}

export interface Articulo {
  id: string
  titulo: string
  resumen: string | null
  contenido: string
  estado: EstadoArticulo
  autorVisible: string | null
  imagen: ImagenArticulo | null
  creadoPor: string | null
  creadoEn: string
  actualizadoPor: string | null
  actualizadoEn: string
  publicadoEn: string | null
  publicadoPor: string | null
  retiradoEn: string | null
  retiradoPor: string | null
}

export interface DatosArticulo {
  titulo: string
  resumen: string | null
  contenido: string
  autorVisible: string | null
  imagen: ImagenArticulo | null
}

export const TAMANO_PAGINA_ARTICULOS = 10
const base = '/investigaciones/articulos'
const uno = (id: string) => `${base}/${encodeURIComponent(id)}`

export const listarArticulos = (filtros: { estado: EstadoArticulo | ''; pagina: number }) =>
  peticion<{ articulos: Articulo[]; total: number; pagina: number; tamano: number }>(base, {
    consulta: { ...filtros, tamano: TAMANO_PAGINA_ARTICULOS },
  })
export const obtenerArticulo = (id: string) => peticion<Articulo>(uno(id))
export const crearArticulo = (datos: DatosArticulo) => peticion<Articulo>(base, { metodo: 'POST', cuerpo: datos })
/** Formulario completo. Un publicado que queda sin resumen → 422 `camposFaltantes`. */
export const editarArticulo = (id: string, datos: DatosArticulo) =>
  peticion<Articulo>(uno(id), { metodo: 'PUT', cuerpo: datos })
export const cambiarEstadoArticulo = (id: string, estado: EstadoArticulo) =>
  peticion<Articulo>(`${uno(id)}/estado`, { metodo: 'PATCH', cuerpo: { estado } })
/** Solo si nunca se publicó; uno ya publicado se retira (409). */
export const eliminarArticulo = (id: string) => peticion<void>(uno(id), { metodo: 'DELETE' })

// ---- Portal ---------------------------------------------------------------------------

interface InvestigacionApi extends Omit<InvestigacionPublica, 'imagen' | 'resumen'> {
  resumen: string | null
  imagen: ImagenArticulo | null
  contenido?: string
}

export interface InvestigacionDetalle extends InvestigacionPublica {
  contenido: string
}

/** La API entrega la ruta relativa; el portal la sirve desde la carpeta pública de difusión. */
function aPublica<T extends InvestigacionApi>(i: T) {
  return {
    ...i,
    resumen: i.resumen ?? '',
    imagen: i.imagen ? { url: urlImagenDifusion(i.imagen.ruta), textoAlternativo: i.imagen.textoAlternativo } : null,
  }
}

export async function listarInvestigacionesPublicas(pagina: number) {
  const r = await peticion<{ investigaciones: InvestigacionApi[]; total: number; pagina: number; tamano: number }>(
    '/publico/investigaciones',
    { consulta: { pagina, tamano: 9 }, publica: true },
  )
  return { ...r, investigaciones: r.investigaciones.map(aPublica) as InvestigacionPublica[] }
}

export const obtenerInvestigacionPublica = async (id: string) =>
  aPublica(
    await peticion<InvestigacionApi & { contenido: string }>(`/publico/investigaciones/${encodeURIComponent(id)}`, {
      publica: true,
    }),
  ) as InvestigacionDetalle

// ---- Formulario -------------------------------------------------------------------------

export interface FormularioArticulo {
  titulo: string
  resumen: string
  contenido: string
  autorVisible: string
  imagenRuta: string
  imagenAlternativo: string
}

export type ErroresArticulo = Partial<Record<keyof FormularioArticulo, string>>

export const LIMITES_ARTICULO = { titulo: 150, resumen: 500, contenido: 20_000, autor: 150, imagen: 300 }

export const formularioVacio = (): FormularioArticulo => ({
  titulo: '',
  resumen: '',
  contenido: '',
  autorVisible: '',
  imagenRuta: '',
  imagenAlternativo: '',
})

export const aFormulario = (a: Articulo): FormularioArticulo => ({
  titulo: a.titulo,
  resumen: a.resumen ?? '',
  contenido: a.contenido,
  autorVisible: a.autorVisible ?? '',
  imagenRuta: a.imagen?.ruta ?? '',
  imagenAlternativo: a.imagen?.textoAlternativo ?? '',
})

export function validarArticulo(f: FormularioArticulo): ErroresArticulo {
  const e: ErroresArticulo = {}
  if (!f.titulo.trim()) e.titulo = 'Escribe el título.'
  else if (f.titulo.trim().length > LIMITES_ARTICULO.titulo) e.titulo = `Máximo ${LIMITES_ARTICULO.titulo} caracteres.`
  if (f.resumen.trim().length > LIMITES_ARTICULO.resumen) e.resumen = `Máximo ${LIMITES_ARTICULO.resumen} caracteres.`
  if (!f.contenido.trim()) e.contenido = 'Escribe el contenido del artículo.'
  else if (f.contenido.length > LIMITES_ARTICULO.contenido)
    e.contenido = `Máximo ${LIMITES_ARTICULO.contenido} caracteres.`
  if (f.autorVisible.trim().length > LIMITES_ARTICULO.autor)
    e.autorVisible = `Máximo ${LIMITES_ARTICULO.autor} caracteres.`
  const ruta = f.imagenRuta.trim()
  if (ruta && !esRutaRelativa(ruta))
    e.imagenRuta = 'Escribe la ruta dentro de la carpeta pública, sin «..» ni barra inicial.'
  if (ruta && !f.imagenAlternativo.trim()) e.imagenAlternativo = 'Describe la imagen para quien no la ve.'
  if (!ruta && f.imagenAlternativo.trim()) e.imagenRuta = 'Indica la ruta de la imagen o borra el texto alternativo.'
  return e
}

export const aDatos = (f: FormularioArticulo): DatosArticulo => ({
  titulo: f.titulo.trim(),
  resumen: f.resumen.trim() || null,
  contenido: f.contenido.trim(),
  autorVisible: f.autorVisible.trim() || null,
  imagen: f.imagenRuta.trim() ? { ruta: f.imagenRuta.trim(), textoAlternativo: f.imagenAlternativo.trim() } : null,
})
