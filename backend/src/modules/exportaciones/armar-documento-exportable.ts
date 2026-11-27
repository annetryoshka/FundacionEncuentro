import type { DocumentoExportable } from './generar-docx.js';
import type { ParametrosExportacion } from './exportaciones-registro.service.js';

type Datos = Record<string, unknown>;
type Campo = readonly [clave: string, etiqueta: string];

function objeto(valor: unknown): Datos {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return valor as Datos;
  }
  return {};
}

function lista(valor: unknown): Datos[] {
  return Array.isArray(valor) ? valor.map(objeto) : [];
}

export function armarDocumentoExportable(
  documento: ParametrosExportacion['documento'],
  datos: Datos,
): DocumentoExportable {
  const filas: { campo: string; valor: string }[] = [];

  function agregar(campo: string, valor: unknown) {
    if (typeof valor === 'string' && valor.trim()) {
      filas.push({ campo, valor });
    } else if (typeof valor === 'number') {
      filas.push({ campo, valor: String(valor) });
    } else if (typeof valor === 'boolean') {
      filas.push({ campo, valor: valor ? 'Sí' : 'No' });
    }
  }

  function agregarCampos(prefijo: string, fuente: unknown, campos: readonly Campo[]) {
    const valores = objeto(fuente);
    for (const [clave, etiqueta] of campos) {
      agregar(`${prefijo}${etiqueta}`, valores[clave]);
    }
  }

  if (documento === 'informe') {
    agregar('Versión revisada', objeto(datos.informe).nroVersion);

    const parrafos = lista(datos.secciones).flatMap(({ titulo, contenido }) =>
      [titulo, contenido].filter((texto): texto is string => typeof texto === 'string'),
    );

    return { titulo: 'Informe revisado', parrafos, filas };
  }

  agregarCampos('', datos.caso, [
    ['numeroCorrelativo', 'Número de caso'],
    ['tipo', 'Tipo de caso'],
    ['estado', 'Estado'],
    ['clasificacion', 'Clasificación'],
    ['fechaIngreso', 'Fecha de ingreso'],
  ]);
  agregarCampos('', datos.paciente, [
    ['nombreCompleto', 'Paciente'],
    ['fechaNacimiento', 'Fecha de nacimiento'],
    ['edadAlIngreso', 'Edad al ingreso'],
  ]);
  agregarCampos('', datos.responsable, [['nombreCompleto', 'Terapeuta responsable']]);
  agregarCampos('', datos.judicial, [
    ['juzgado', 'Juzgado'],
    ['nroExpediente', 'Número de expediente'],
    ['fechaDerivacion', 'Fecha de derivación'],
    ['observaciones', 'Observaciones judiciales'],
  ]);
  agregarCampos('', datos.diagnostico, [
    ['evaluacionInicial', 'Evaluación inicial'],
    ['diagnosticoIngreso', 'Diagnóstico de ingreso'],
    ['hipotesisRelacional', 'Hipótesis relacional'],
    ['comentariosClinicos', 'Comentarios clínicos'],
  ]);

  lista(objeto(datos.familia).integrantes).forEach((integrante, indice) => {
    agregarCampos(`Familiar ${indice + 1} · `, integrante, [
      ['nombreCompleto', 'Nombre'],
      ['parentesco', 'Parentesco'],
      ['parentescoDetalle', 'Detalle del parentesco'],
      ['fechaNacimiento', 'Fecha de nacimiento'],
      ['edadReferida', 'Edad referida'],
      ['fechaReferencia', 'Fecha de referencia'],
      ['ocupacion', 'Ocupación'],
      ['lugarTrabajoEstudio', 'Lugar de trabajo o estudio'],
      ['conviveConPaciente', 'Convive con el paciente'],
      ['observaciones', 'Observaciones'],
    ]);
  });

  for (const sesion of lista(datos.sesiones)) {
    const prefijo = `Sesión ${sesion.nroSesion} · `;
    agregarCampos(prefijo, sesion, [
      ['fecha', 'Fecha'],
      ['evolucion', 'Evolución'],
    ]);
    lista(sesion.tareas).forEach((tarea, indice) => {
      agregarCampos(`${prefijo}Tarea ${indice + 1} · `, tarea, [
        ['descripcion', 'Descripción'],
        ['fechaAsignada', 'Fecha asignada'],
        ['fechaLimite', 'Fecha límite'],
        ['completada', 'Completada'],
      ]);
    });
  }

  lista(datos.pagos).forEach((pago, indice) => {
    agregarCampos(`Pago ${indice + 1} · `, pago, [
      ['nroSesion', 'Número de sesión'],
      ['fecha', 'Fecha'],
      ['monto', 'Monto'],
      ['moneda', 'Moneda'],
      ['metodo', 'Método'],
      ['referencia', 'Referencia'],
    ]);
  });

  agregarCampos('Genograma · ', datos.genograma, [
    ['vigente', 'Vigente'],
    ['nombre', 'Archivo'],
  ]);

  return {
    titulo: documento === 'ficha' ? 'Ficha del caso' : 'Historial del caso',
    parrafos: [],
    filas,
  };
}