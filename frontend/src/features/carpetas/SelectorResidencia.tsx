import { useId } from 'react'
import { claseCampo } from '../../componentes/estilos'
import { CampoTexto } from '../../componentes/ui'
import {
  FILTRO_SIN_REGISTRAR,
  NOMBRE_RESIDENCIA,
  SIN_REGISTRAR,
  esCiudadResidencia,
  esFiltroResidencia,
  type ErroresResidencia,
  type FiltroResidencia,
  type ValorResidencia,
} from './residencia'

interface PropsSelectorResidencia {
  valor: ValorResidencia
  alCambiar: (valor: ValorResidencia) => void
  errores?: ErroresResidencia
  deshabilitado?: boolean
}

/**
 * Campo de formulario para registrar o corregir la residencia del paciente.
 * Al elegir «Otra localidad» aparece el campo para el nombre, que es obligatorio.
 * Los errores llegan de `validarResidencia` (cliente) o de la API (400).
 */
export function SelectorResidencia({ valor, alCambiar, errores = {}, deshabilitado = false }: PropsSelectorResidencia) {
  const id = useId()
  const idAyuda = `${id}-ayuda`
  const idError = `${id}-error`
  const describe = [!errores.ciudad && idAyuda, errores.ciudad && idError].filter(Boolean).join(' ')

  return (
    <div className="grid gap-3">
      <div>
        <label htmlFor={id} className="block text-sm font-semibold text-texto">
          Ciudad de residencia
        </label>
        <select
          id={id}
          value={valor.ciudad}
          disabled={deshabilitado}
          aria-invalid={errores.ciudad ? true : undefined}
          aria-describedby={describe || undefined}
          onChange={(e) => {
            const elegida = esCiudadResidencia(e.target.value) ? e.target.value : ''
            // La localidad solo tiene sentido con «Otra localidad»: al cambiar de ciudad se descarta.
            alCambiar({ ciudad: elegida, localidad: elegida === 'otra' ? valor.localidad : '' })
          }}
          className={claseCampo(Boolean(errores.ciudad))}
        >
          <option value="">{SIN_REGISTRAR}</option>
          {Object.entries(NOMBRE_RESIDENCIA).map(([codigo, nombre]) => (
            <option key={codigo} value={codigo}>
              {nombre}
            </option>
          ))}
        </select>
        {errores.ciudad ? (
          <p id={idError} className="mt-1.5 text-sm text-error">
            {errores.ciudad}
          </p>
        ) : (
          <p id={idAyuda} className="mt-1.5 text-sm text-suave">
            Ciudad donde vive el paciente, no donde se atiende. Si no se conoce, déjalo en «{SIN_REGISTRAR}».
          </p>
        )}
      </div>
      {valor.ciudad === 'otra' && (
        <CampoTexto
          etiqueta="Localidad"
          value={valor.localidad}
          disabled={deshabilitado}
          error={errores.localidad}
          autoComplete="off"
          onChange={(e) => alCambiar({ ciudad: 'otra', localidad: e.target.value })}
        />
      )}
    </div>
  )
}

interface PropsFiltroResidencia {
  valor: FiltroResidencia
  alCambiar: (valor: FiltroResidencia) => void
}

/**
 * Filtro del listado (GET /api/carpetas?residencia=…). «Todas» no envía el parámetro y
 * «Sin registrar» envía `sin_registrar`, que es un valor de consulta y no una ciudad guardada.
 */
export function FiltroResidenciaCarpetas({ valor, alCambiar }: PropsFiltroResidencia) {
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-semibold text-texto">
        Residencia
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => alCambiar(esFiltroResidencia(e.target.value) ? e.target.value : '')}
        className={claseCampo(false)}
      >
        <option value="">Todas</option>
        {Object.entries(NOMBRE_RESIDENCIA).map(([codigo, nombre]) => (
          <option key={codigo} value={codigo}>
            {nombre}
          </option>
        ))}
        <option value={FILTRO_SIN_REGISTRAR}>{SIN_REGISTRAR}</option>
      </select>
    </div>
  )
}
