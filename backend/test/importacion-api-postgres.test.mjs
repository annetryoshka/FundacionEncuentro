import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { ImportacionModule } from '../dist/modules/importacion/importacion.module.js';
import { servidor } from './helpers/casos.mjs';
import { crearBase, opciones, PERFILES } from './helpers/pg-qa.mjs';
import ExcelJS from 'exceljs';

test('FE-164: cargar el CSV devuelve una vista previa sin importar pacientes', opciones, async (t) => {
  const base = await crearBase('fe164');
  let db;
  let api;

  t.after(async () => {
    try {
      if (api) await api.close();
      else await db?.onModuleDestroy();
    } finally {
      await base.cerrar();
    }
  });

  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${base.cliente.database}`;
  db = new DatabaseService({ getOrThrow: () => url.toString() });

  api = await servidor(db, {
    fixture: PERFILES.admin,
    terapeuta: PERFILES.t1,
  }, [ImportacionModule]);

  const csv = await readFile(
    new URL('../../db/importacion/muestras/02-lote-errores.csv', import.meta.url),
  );

  const cargar = (contenido, token = 'fixture', nombre = 'lote-qa.csv') => {
    const body = new FormData();
    const tipo = nombre.endsWith('.xlsx')
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';
    body.set('archivo', new Blob([contenido], { type: tipo }), nombre);
    body.set('origen', 'Muestra ficticia FE-163');

    return fetch(`${api.base}/api/importaciones`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
  };

  const denegada = await cargar(csv, 'terapeuta');
  assert.equal(denegada.status, 403, await denegada.text());

  const invalida = await cargar('columnaIncorrecta\nvalor');
  assert.equal(invalida.status, 400, await invalida.text());

  const respuesta = await cargar(csv);
  const vista = await respuesta.json();
  assert.equal(respuesta.status, 201, JSON.stringify(vista));
  assert.equal(vista.estado, 'en_revision');
  assert.equal(vista.version, 1);
  assert.ok(vista.resumen.errores > 0);
  assert.ok(vista.filas.some((fila) =>
    fila.estado === 'error' && fila.errores.length > 0,
  ));

  const consulta = await api.solicitar(`/importaciones/${vista.loteId}`);
  assert.equal(consulta.status, 200);
  assert.deepEqual(await consulta.json(), vista);

  const { rows: [conteos] } = await base.cliente.query(`
    select (select count(*)::int from pacientes) as pacientes,
           (select count(*)::int from casos) as casos,
           (select count(*)::int from importaciones) as lotes
  `);
  assert.deepEqual(conteos, { pacientes: 0, casos: 0, lotes: 1 });

    const confirmar = (lote, version = lote.version) =>
    api.solicitar(`/importaciones/${lote.loteId}/confirmar`, {
      metodo: 'POST',
      cuerpo: { version, aceptaAvanceContador: true },
    });

  const pendiente = await confirmar(vista);
  const errorPendiente = await pendiente.json();
  assert.equal(pendiente.status, 422, JSON.stringify(errorPendiente));
  assert.ok(errorPendiente.filas.length > 0);

  const filaConError = vista.filas.find(({ estado }) => estado === 'error');
  const rutaFila = `/importaciones/${vista.loteId}/filas/${filaConError.numeroFila}`;

  const excluir = await api.solicitar(rutaFila, {
    metodo: 'PATCH',
    cuerpo: { version: vista.version, decision: 'excluir' },
  });
  const actualizada = await excluir.json();
  assert.equal(excluir.status, 200, JSON.stringify(actualizada));
  assert.ok(actualizada.version > vista.version);
  assert.equal(
    actualizada.filas.find(({ numeroFila }) => numeroFila === filaConError.numeroFila).decision,
    'excluir',
  );

  const antigua = await confirmar(vista);
  assert.equal(antigua.status, 409, await antigua.text());
    const filaFecha = actualizada.filas.find(
    ({ referenciaOrigen }) => referenciaOrigen === 'E-03',
  );
  assert.equal(filaFecha.estado, 'error');

  const correccion = await api.solicitar(
    `/importaciones/${vista.loteId}/filas/${filaFecha.numeroFila}/datos`,
    {
      metodo: 'PATCH',
      cuerpo: {
        version: actualizada.version,
        datos: { fechaIngreso: '2018-01-10' },
      },
    },
  );

  const loteCorregido = await correccion.json();
  assert.equal(correccion.status, 200, JSON.stringify(loteCorregido));
  assert.ok(loteCorregido.version > actualizada.version);

  const filaCorregida = loteCorregido.filas.find(
    ({ numeroFila }) => numeroFila === filaFecha.numeroFila,
  );
  assert.equal(filaCorregida.estado, 'valida_nueva');
  assert.deepEqual(filaCorregida.errores, []);
  assert.equal(filaCorregida.datos.fechaIngreso, '2018-01-10');
  assert.equal(filaCorregida.datos.nombreCompleto, filaFecha.datos.nombreCompleto);
  const csvValido = await readFile(
    new URL('../../db/importacion/muestras/01-lote-valido.csv', import.meta.url),
  );
  const subidaValida = await cargar(csvValido);
  const loteValido = await subidaValida.json();
  assert.equal(subidaValida.status, 201, JSON.stringify(loteValido));
  assert.equal(loteValido.resumen.errores, 0);

  const primeraConfirmacion = await confirmar(loteValido);
  const resultado = await primeraConfirmacion.json();
  assert.equal(primeraConfirmacion.status, 200, JSON.stringify(resultado));
  assert.equal(resultado.estado, 'confirmada');
  assert.equal(resultado.creadas, loteValido.resumen.total);

  const reintento = await confirmar(loteValido);
  assert.equal(reintento.status, 200);
  assert.deepEqual(await reintento.json(), resultado);

  const { rows: [cantidad] } = await base.cliente.query(`
    select (select count(*)::int from pacientes) as pacientes,
           (select count(*)::int from casos) as casos
  `);
  assert.deepEqual(cantidad, {
    pacientes: resultado.creadas,
    casos: resultado.creadas,
  });

  const archivoRepetido = await cargar(csvValido);
  assert.equal(archivoRepetido.status, 409, await archivoRepetido.text());

    const encabezado = await readFile(
    new URL('../../db/importacion/plantilla-importacion-historica.csv', import.meta.url),
    'utf8',
  );
  const columnas = encabezado.trim().split(',');
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Importacion');

  hoja.addRow(columnas);
  const datosXlsx = {
    referenciaOrigen: 'XLSX-QA-01',
    nombreCompleto: 'Paciente Excel Ficticia',
    telefono: '071234567',
    tipo: 'voluntario',
    fechaIngreso: new Date('2018-03-12T00:00:00.000Z'),
  };
  const filaExcel = hoja.addRow(
    columnas.map((columna) => datosXlsx[columna] ?? ''),
  );

  const subidaXlsx = await cargar(
    await libro.xlsx.writeBuffer(),
    'fixture',
    'lote-qa.xlsx',
  );
  const loteXlsx = await subidaXlsx.json();
  assert.equal(subidaXlsx.status, 201, JSON.stringify(loteXlsx));
  assert.equal(loteXlsx.resumen.errores, 0);
  assert.equal(loteXlsx.filas[0].datos.fechaIngreso, '2018-03-12');
  assert.equal(loteXlsx.filas[0].datos.telefono, '071234567');

  const confirmacionXlsx = await confirmar(loteXlsx);
  const resultadoXlsx = await confirmacionXlsx.json();
  assert.equal(confirmacionXlsx.status, 200, JSON.stringify(resultadoXlsx));
  assert.equal(resultadoXlsx.estado, 'confirmada');
  assert.equal(resultadoXlsx.creadas, 1);

  filaExcel.getCell(columnas.indexOf('nombreCompleto') + 1).value = {
    formula: '1+1',
    result: 2,
  };
  const conFormula = await cargar(
    await libro.xlsx.writeBuffer(),
    'fixture',
    'formula-qa.xlsx',
  );
  assert.equal(conFormula.status, 400, await conFormula.text());
});