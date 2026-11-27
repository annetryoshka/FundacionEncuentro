import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { ExportacionesModule } from '../dist/modules/exportaciones/exportaciones.module.js';
import { servidor } from './helpers/casos.mjs';
import { comoUsuario, crearBase, crearCaso, opciones, PERFILES } from './helpers/pg-qa.mjs';

const configuracion = {};
let base, api, carpeta, casoA, casoB;

before(async () => {
  if (opciones.skip) return;

  carpeta = await mkdtemp(join(tmpdir(), 'fe159-'));
  configuracion.EXPORTACIONES_DIR = carpeta;
  base = await crearBase('fe159');

  casoA = await crearCaso(base.cliente, {
    nombre: 'Paciente ficticio A',
    terapeuta: PERFILES.t1,
  });
  casoB = await crearCaso(base.cliente, {
    nombre: 'Paciente ficticio B',
    terapeuta: PERFILES.t2,
  });

  const db = {
    query: base.cliente.query.bind(base.cliente),
    transaction: (usuarioId, ejecutar) =>
      comoUsuario(base.cliente, usuarioId, () => ejecutar(base.cliente)),
  };

  api = await servidor(db, PERFILES, {
    modulos: [ExportacionesModule],
    configuracion,
  });
});

after(async () => {
  try {
    await api?.close();
  } finally {
    try {
      await base?.cerrar();
    } finally {
      if (carpeta) await rm(carpeta, { recursive: true, force: true });
    }
  }
});

const ruta = (caso) => `/carpetas/${caso.id}/exportaciones`;

function solicitarExportacion(caso, token, cuerpo) {
  return api.solicitar(ruta(caso), { token, metodo: 'POST', cuerpo });
}

test('FE-159: genera PDF y DOCX, registra la autoría y permite la descarga', opciones, async () => {
  const formatos = [
    ['pdf', 'application/pdf', Buffer.from('%PDF-')],
    [
      'docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    ],
  ];

  for (const [formato, tipo, firma] of formatos) {
    const creada = await solicitarExportacion(casoA, 't1', {
      documento: 'ficha',
      formato,
    });
    assert.equal(creada.status, 201, await creada.clone().text());
    const { exportacionId } = await creada.json();
    const archivo = `${ruta(casoA)}/${exportacionId}/archivo`;

    assert.equal((await api.solicitar(archivo, { token: 't2' })).status, 404);
    assert.equal((await api.solicitar(archivo, { token: 'marketing' })).status, 403);
    assert.equal((await api.solicitar(archivo, { token: null })).status, 401);
    assert.equal(
      (await api.solicitar(`${ruta(casoB)}/${exportacionId}/archivo`, { token: 'admin' })).status,
      404,
    );

    const descarga = await api.solicitar(archivo, { token: 't1' });
    assert.equal(descarga.status, 200);
    assert.equal(descarga.headers.get('content-type'), tipo);
    assert.equal(descarga.headers.get('cache-control'), 'private, no-store');
    assert.equal(
      descarga.headers.get('content-disposition'),
      `attachment; filename="exportacion-${exportacionId}.${formato}"`,
    );

    const contenido = Buffer.from(await descarga.arrayBuffer());
    assert.deepEqual(contenido.subarray(0, firma.length), firma);

    const { rows: [registro] } = await base.cliente.query(
      `select estado, perfil_id, archivo_bytes
         from exportaciones where id = $1`,
      [exportacionId],
    );
    assert.equal(registro.estado, 'generada');
    assert.equal(registro.perfil_id, PERFILES.t1);
    assert.equal(Number(registro.archivo_bytes), contenido.length);

    // Conserva la longitud para comprobar específicamente la verificación SHA-256.
    contenido[0] ^= 0xff;
    await writeFile(join(carpeta, casoA.id, `${exportacionId}.${formato}`), contenido);
    assert.equal((await api.solicitar(archivo, { token: 't1' })).status, 500);
  }
});

test('FE-159: rechaza pagos solicitados por una terapeuta y casos ajenos', opciones, async () => {
  const pagos = await solicitarExportacion(casoA, 't1', {
    documento: 'historial',
    formato: 'pdf',
    incluirPagos: true,
  });
  assert.equal(pagos.status, 403);

  const casoAjeno = await solicitarExportacion(casoB, 't1', {
    documento: 'ficha',
    formato: 'pdf',
  });
  assert.equal(casoAjeno.status, 404);
});

test('FE-159: un fallo de escritura registra la exportación como fallida', opciones, async () => {
  const bloqueo = join(carpeta, 'archivo-en-lugar-de-carpeta');
  await writeFile(bloqueo, 'bloqueo ficticio');
  configuracion.EXPORTACIONES_DIR = bloqueo;

  try {
    const respuesta = await solicitarExportacion(casoA, 't1', {
      documento: 'ficha',
      formato: 'pdf',
    });
    assert.equal(respuesta.status, 500);

    const { rows } = await base.cliente.query(
      `select archivo_path, archivo_bytes
         from exportaciones
        where caso_id = $1 and estado = 'fallida'`,
      [casoA.id],
    );
    assert.deepEqual(rows, [{ archivo_path: null, archivo_bytes: null }]);
  } finally {
    configuracion.EXPORTACIONES_DIR = carpeta;
  }
});