/**
 * Ciudad de residencia del paciente (contrato FE-134, HU FE-111).
 * Es la ciudad donde vive la persona, no la sede ni la institución de procedencia: quien vive en
 * El Alto y se atiende en La Paz es «El Alto».
 */

/** Valores que se guardan. `null` (sin registrar) no es una ciudad: es la ausencia del dato. */
export type CiudadResidencia = 'la_paz' | 'el_alto' | 'otra'

export const NOMBRE_RESIDENCIA: Record<CiudadResidencia, string> = {
  la_paz: 'La Paz',
  el_alto: 'El Alto',
  otra: 'Otra localidad',
}

export const SIN_REGISTRAR = 'Sin registrar'

/** Valor de consulta de GET /api/carpetas?residencia=…: no se guarda como ciudad. */
export const FILTRO_SIN_REGISTRAR = 'sin_registrar'

/** `''` significa «Todas» y no se envía como parámetro. */
export type FiltroResidencia = CiudadResidencia | typeof FILTRO_SIN_REGISTRAR | ''

/** Campos `ciudadResidencia` y `otraLocalidad` que se agregan al paciente, al encabezado y al listado. */
export interface DatosResidencia {
  ciudadResidencia: CiudadResidencia | null
  otraLocalidad: string | null
}

/** Estado de un formulario: texto vacío = sin registrar. */
export interface ValorResidencia {
  ciudad: CiudadResidencia | ''
  localidad: string
}

export interface ErroresResidencia {
  ciudad?: string
  localidad?: string
}

export function esCiudadResidencia(valor: string): valor is CiudadResidencia {
  return valor in NOMBRE_RESIDENCIA
}

export function esFiltroResidencia(valor: string): valor is FiltroResidencia {
  return valor === '' || valor === FILTRO_SIN_REGISTRAR || esCiudadResidencia(valor)
}

/** Texto legible, también para quien no distingue colores. «Otra localidad» incluye el nombre. */
export function textoResidencia(datos: DatosResidencia): string {
  const { ciudadResidencia, otraLocalidad } = datos
  if (!ciudadResidencia) return SIN_REGISTRAR
  if (ciudadResidencia === 'otra') {
    const localidad = otraLocalidad?.trim()
    return localidad ? `${NOMBRE_RESIDENCIA.otra}: ${localidad}` : NOMBRE_RESIDENCIA.otra
  }
  return NOMBRE_RESIDENCIA[ciudadResidencia]
}

/** Reglas del contrato: ciudad del catálogo, y «Otra localidad» exige el nombre de la localidad. */
export function validarResidencia(valor: { ciudad: string; localidad: string }): ErroresResidencia {
  const errores: ErroresResidencia = {}
  if (valor.ciudad !== '' && !esCiudadResidencia(valor.ciudad)) {
    errores.ciudad = 'Elige una opción de la lista.'
  } else if (valor.ciudad === 'otra' && valor.localidad.trim() === '') {
    errores.localidad = 'Escribe el nombre de la localidad.'
  }
  return errores
}

/** Cuerpo a enviar: la localidad solo viaja con «otra»; sin ciudad se envían ambos en null. */
export function aDatosResidencia(valor: ValorResidencia): DatosResidencia {
  if (valor.ciudad === '') return { ciudadResidencia: null, otraLocalidad: null }
  return {
    ciudadResidencia: valor.ciudad,
    otraLocalidad: valor.ciudad === 'otra' ? valor.localidad.trim() : null,
  }
}

/** Valor inicial de un formulario a partir de lo que devuelve la API. */
export function aValorResidencia(datos: DatosResidencia): ValorResidencia {
  return { ciudad: datos.ciudadResidencia ?? '', localidad: datos.otraLocalidad ?? '' }
}
