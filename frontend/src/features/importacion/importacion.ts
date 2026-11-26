/**
 * FE-165 · Asistente de importación histórica (análisis FE-162, lotes FE-163, API FE-164). Solo administración.
 * Cada cambio usa la `version` del lote: una vista previa vieja responde 409 y no se escribe nada.
 */
import { peticion } from '../../api/cliente'
import { LIMITE_5_MIB, validarArchivo } from '../../utilidades/archivos'

/** Columnas de la plantilla, en orden (db/importacion/plantilla-importacion-historica.csv, migración 017). */
export const COLUMNAS = [
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
] as const

export type Columna = (typeof COLUMNAS)[number]

export const NOMBRE_COLUMNA: Record<Columna, string> = {
  referenciaOrigen: 'Referencia de origen',
  nombreCompleto: 'Nombre completo',
  fechaNacimiento: 'Fecha de nacimiento',
  edadAlIngreso: 'Edad al ingreso',
  telefono: 'Teléfono',
  tipo: 'Tipo (voluntario/derivado)',
  numeroCorrelativo: 'Número de carpeta',
  fechaIngreso: 'Fecha de ingreso',
  clasificacion: 'Clasificación (social/privado)',
  ciudadResidencia: 'Residencia (la_paz/el_alto/otra)',
  otraLocalidad: 'Otra localidad',
  diagnosticoIngreso: 'Diagnóstico de ingreso',
  hipotesisRelacional: 'Hipótesis relacional',
  comentariosClinicos: 'Comentarios clínicos',
  estado: 'Estado (iniciado/en_proceso/concluido)',
  juzgado: 'Juzgado',
  nroExpediente: 'Nº de expediente',
  fechaDerivacion: 'Fecha de derivación',
}

export type EstadoFila = 'valida_nueva' | 'error' | 'posible_duplicado' | 'duplicado_en_lote'
export type Decision = 'crear' | 'vincular' | 'excluir'

export const NOMBRE_ESTADO_FILA: Record<EstadoFila, string> = {
  valida_nueva: 'Válida',
  error: 'Con errores',
  posible_duplicado: 'Posible duplicado',
  duplicado_en_lote: 'Repetida en el archivo',
}

export type Coincidencia =
  | {
      tipo: 'carpeta'
      casoId: string
      pacienteId: string
      nombreCompleto: string
      tipoCaso: string
      numero: number
      eliminado: boolean
    }
  | {
      tipo: 'ya_importada' | 'referencia'
      importacionId: string
      numeroFila: number
      pacienteId: string | null
      casoId: string | null
    }
  | { tipo: 'nombre'; pacienteId: string; nombreCompleto: string; similitud: number; mismaFechaNacimiento: boolean }
  | { tipo: 'fila'; numeroFila: number; mismoNumero: boolean }

export interface FilaImportacion {
  numeroFila: number
  referenciaOrigen: string | null
  datos: Partial<Record<Columna, string | null>>
  estado: EstadoFila
  errores: { campo: string; mensaje: string }[]
  advertencias: { tipo: string; mensaje: string }[]
  coincidencias: Coincidencia[]
  decision: Decision | null
  resultado: 'creada' | 'vinculada' | 'excluida' | null
}

export interface LoteImportacion {
  loteId: string
  version: number
  estado: 'en_revision' | 'confirmada' | 'descartada'
  archivoNombre: string
  origen: string | null
  resumen: { total: number; validas: number; advertencias: number; errores: number }
  filas: FilaImportacion[]
}

export interface ResultadoImportacion {
  importacionId: string
  estado: 'confirmada'
  version: number
  confirmadaEn: string
  confirmadaPor: string
  creadas: number
  vinculadas: number
  excluidas: number
  filas: {
    numeroFila: number
    referenciaOrigen: string | null
    resultado: 'creada' | 'vinculada' | 'excluida'
    pacienteId: string | null
    casoId: string | null
    tipo: string | null
    numeroCorrelativo: number | null
  }[]
}

/** Respuesta de confirmar cuando, al volver a clasificar, alguna fila cambió: no se importó nada. */
export interface RevisarDeNuevo {
  importacionId: string
  estado: 'revisar'
  filas: number[]
  version: number
}

const lote = (id: string) => `/importaciones/${encodeURIComponent(id)}`

export function cargarImportacion(archivo: File, origen: string) {
  const formulario = new FormData()
  formulario.append('archivo', archivo, archivo.name)
  if (origen.trim()) formulario.append('origen', origen.trim())
  return peticion<LoteImportacion>('/importaciones', { metodo: 'POST', cuerpo: formulario })
}

export const obtenerLote = (id: string) => peticion<LoteImportacion>(lote(id))

export const decidirFila = (
  id: string,
  numeroFila: number,
  cuerpo: {
    version: number
    decision: Decision
    pacienteDestinoId?: string
    casoDestinoId?: string
    filaDestino?: number
  },
) => peticion<LoteImportacion>(`${lote(id)}/filas/${numeroFila}`, { metodo: 'PATCH', cuerpo })

export const corregirFila = (
  id: string,
  numeroFila: number,
  version: number,
  datos: Partial<Record<Columna, string | null>>,
) => peticion<LoteImportacion>(`${lote(id)}/filas/${numeroFila}/datos`, { metodo: 'PATCH', cuerpo: { version, datos } })

/** 422 `filas` (sin resolver) o `saltos` (el contador avanzaría); 409 versión vieja. Es idempotente. */
export const confirmarImportacion = (id: string, version: number, aceptaAvanceContador: boolean) =>
  peticion<ResultadoImportacion | RevisarDeNuevo>(`${lote(id)}/confirmar`, {
    metodo: 'POST',
    cuerpo: { version, aceptaAvanceContador },
  })

export const validarArchivoImportacion = (archivo: File | null | undefined) =>
  validarArchivo(archivo, {
    extensiones: ['csv', 'xlsx'],
    limite: LIMITE_5_MIB,
    formatos: 'CSV (UTF-8) o XLSX con la hoja «Importacion»',
  })

/** Plantilla vacía con los encabezados exactos, para llenar en Excel o LibreOffice. */
export const plantillaCsv = () => new Blob([`﻿${COLUMNAS.join(',')}\n`], { type: 'text/csv;charset=utf-8' })

/** Una fila está resuelta si tiene decisión y, si tiene errores, se excluye. */
export const filaPendiente = (f: FilaImportacion) => !f.decision || (f.estado === 'error' && f.decision !== 'excluir')
