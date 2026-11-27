import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useCarga } from '../../api/useCarga'
import { Boton, Indicador, Tarjeta } from '../../componentes/ui'
import { Icono, type NombreIcono } from '../../componentes/iconos'
import { fechaLarga } from '../../utilidades/fechas'
import type { CarpetaDetalle } from '../carpetas/tipos'
import { obtenerDiagnosticoVigente } from './diagnosticoVigente'
import { obtenerFamilia } from './familia/familia'
import { ResumenFamilia } from './familia/ResumenFamilia'
import { nombreFormato, obtenerGenograma } from './genograma/genograma'

/**
 * FE-127 · Resumen inicial de la ficha (FE-123 §1): composición familiar, genograma y diagnóstico, antes del
 * historial. Cada bloque carga por separado: si uno falla, los demás siguen visibles.
 */
export function ResumenFicha({ carpeta }: { carpeta: CarpetaDetalle }) {
  const base = `/carpetas/${carpeta.id}`
  return (
    <Tarjeta>
      <h2 className="text-lg font-semibold text-verde-oscuro">Contexto del paciente</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <BloqueFamilia carpetaId={carpeta.id} enlace={`${base}/familia`} />
        <BloqueGenograma carpetaId={carpeta.id} enlace={`${base}/genograma`} />
        <BloqueDiagnostico carpetaId={carpeta.id} enlace={`${base}/diagnostico`} />
      </div>
    </Tarjeta>
  )
}

function Bloque({
  titulo,
  icono,
  enlace,
  textoEnlace,
  children,
}: {
  titulo: string
  icono: NombreIcono
  enlace: string
  textoEnlace: string
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-linea p-4">
      <h3 className="flex items-center gap-2 font-semibold text-verde-oscuro">
        <Icono nombre={icono} className="size-5 text-verde" />
        {titulo}
      </h3>
      <div className="mt-2 flex-1 text-sm text-texto">{children}</div>
      <Link
        to={enlace}
        className="mt-3 inline-flex items-center gap-1 self-start text-sm font-semibold text-naranja-texto underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
      >
        {textoEnlace}
        <Icono nombre="siguiente" className="size-4" />
      </Link>
    </section>
  )
}

function EstadoBloque({ error, alReintentar, texto }: { error: unknown; alReintentar: () => void; texto: string }) {
  if (error !== undefined) {
    return (
      <div role="alert" className="text-error">
        <p>{texto}</p>
        <Boton variante="texto" className="-ml-2" onClick={alReintentar}>
          Reintentar
        </Boton>
      </div>
    )
  }
  return (
    <p role="status" className="flex items-center gap-2 text-suave">
      <Indicador /> Cargando…
    </p>
  )
}

function BloqueFamilia({ carpetaId, enlace }: { carpetaId: string; enlace: string }) {
  const { datos, error, recargar } = useCarga(() => obtenerFamilia(carpetaId), [carpetaId])
  return (
    <Bloque titulo="Familia" icono="personas" enlace={enlace} textoEnlace="Ver composición familiar">
      {!datos || error !== undefined ? (
        <EstadoBloque error={error} alReintentar={recargar} texto="No se pudo cargar la composición familiar." />
      ) : !datos.registrada ? (
        <p className="text-suave">Sin composición familiar registrada.</p>
      ) : (
        <ResumenFamilia key={datos.casoId} familiares={datos.familiares} />
      )}
    </Bloque>
  )
}

function BloqueGenograma({ carpetaId, enlace }: { carpetaId: string; enlace: string }) {
  const { datos, error, recargar } = useCarga(() => obtenerGenograma(carpetaId), [carpetaId])
  return (
    <Bloque titulo="Genograma" icono="genograma" enlace={enlace} textoEnlace="Ver genograma">
      {datos === undefined || error !== undefined ? (
        <EstadoBloque error={error} alReintentar={recargar} texto="No se pudo consultar el genograma." />
      ) : datos === null ? (
        <p className="text-suave">Sin genograma.</p>
      ) : (
        <p className="break-words">
          {datos.nombre}
          <span className="block text-suave">
            {nombreFormato(datos.tipo)} · actualizado el {fechaLarga(datos.actualizadoEn)}
          </span>
        </p>
      )}
    </Bloque>
  )
}

function BloqueDiagnostico({ carpetaId, enlace }: { carpetaId: string; enlace: string }) {
  const { datos, error, recargar } = useCarga(() => obtenerDiagnosticoVigente(carpetaId), [carpetaId])
  return (
    <Bloque titulo="Diagnóstico" icono="ficha" enlace={enlace} textoEnlace="Ver diagnóstico">
      {!datos || error !== undefined ? (
        <EstadoBloque error={error} alReintentar={recargar} texto="No se pudo cargar el diagnóstico." />
      ) : datos.origen === 'sin_datos' ? (
        <p className="text-suave">Sin diagnóstico registrado.</p>
      ) : datos.origen === 'alta' ? (
        <>
          <p className="text-suave">Antecedente registrado al abrir la carpeta (todavía no hay ficha):</p>
          <p className="mt-1 line-clamp-4 whitespace-pre-line">
            {datos.alta.diagnosticoIngreso ?? datos.alta.comentariosClinicos ?? 'Sin texto.'}
          </p>
        </>
      ) : (
        <>
          {datos.fichaFecha && <p className="text-suave">Evaluación del {fechaLarga(datos.fichaFecha)}</p>}
          <p className="mt-1 line-clamp-4 whitespace-pre-line">{datos.evaluacionInicial ?? 'Sin evaluación inicial registrada.'}</p>
          <p className="mt-2 text-suave">Diagnóstico de ingreso: {datos.diagnosticoIngreso ?? 'Sin registro'}</p>
        </>
      )}
    </Bloque>
  )
}
