import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DatabaseService } from '../dist/database/database.service.js';
import { DifusionModule } from '../dist/modules/difusion/difusion.module.js';
import { IndicadoresModule } from '../dist/modules/indicadores/indicadores.module.js';
import { servidor } from './helpers/casos.mjs';
import { PERFILES, crearBase, crearCaso, opciones } from './helpers/pg-qa.mjs';

const CAMPOS_PUBLICOS = ['contactoUrl', 'contenido', 'fechaFin', 'fechaInicio', 'id', 'imagen', 'lugar', 'modalidad', 'publicadoEn', 'resumen', 'tipo', 'titulo'];
const ACTIVIDAD = {
  tipo: 'actividad',
  titulo: 'Actividad ficticia QA FE-145',
  resumen: 'Resumen ficticio para revisar el portal.',
  contenido: 'Contenido de prueba sin datos de pacientes.',
  fechaInicio: '2026-12-01',
  fechaFin: '2026-12-01',
  modalidad: 'presencial',
  lugar: 'Lugar ficticio QA',
  contactoUrl: 'https://ejemplo.test/contacto',
};

let base, api, caso;

before(async () => {
  if (opciones.skip) return;
  base = await crearBase('fe145');
  caso = await crearCaso(base.cliente, { nombre: 'Paciente QA difusión', terapeuta: PERFILES.t1 });
  const url = new URL(process.env.FE_PG_ADMIN_URL);
  url.pathname = `/${(await base.cliente.query('select current_database() as n')).rows[0].n}`;
  const db = new DatabaseService({ getOrThrow: () => url.toString() });
  api = await servidor(db, { admin: PERFILES.admin, t1: PERFILES.t1, mkt: PERFILES.marketing }, { modulos: [DifusionModule, IndicadoresModule] });
});

after(async () => {
  await api?.close();
  await base?.cerrar();
});

async function pedir(ruta, { token = 'mkt', metodo = 'GET', cuerpo } = {}) {
  const r = await api.solicitar(ruta, { token, metodo, cuerpo });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = texto; }
  return { status: r.status, cuerpo: json };
}
const crear = (cuerpo = ACTIVIDAD, token = 'mkt') => pedir('/difusion/publicaciones', { token, metodo: 'POST', cuerpo });
const estado = (id, nuevo, token = 'mkt') => pedir(`/difusion/publicaciones/${id}/estado`, { token, metodo: 'PATCH', cuerpo: { estado: nuevo } });
const publico = (id) => pedir(`/publico/publicaciones${id ? `/${id}` : ''}`, { token: null });
const idsPublicos = async (consulta = '') => (await pedir(`/publico/publicaciones${consulta}`, { token: null })).cuerpo.publicaciones.map((p) => p.id);

test('P1 · un borrador creado por marketing no aparece en el portal', opciones, async () => {
  const r = await crear();
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.estado, 'borrador');
  assert.equal(r.cuerpo.creadoPor, PERFILES.marketing);
  assert.equal((await publico(r.cuerpo.id)).status, 404);
  assert.ok(!(await idsPublicos()).includes(r.cuerpo.id));
  const admin = await pedir(`/difusion/publicaciones/${r.cuerpo.id}`, { token: 'admin' });
  assert.equal(admin.status, 200, 'Administración también gestiona la difusión');
});

test('P2 · publicar sin resumen da 422 con el campo faltante y conserva el borrador', opciones, async () => {
  const { cuerpo: borrador } = await crear({ ...ACTIVIDAD, titulo: 'Sin resumen QA', resumen: '   ' });
  const r = await estado(borrador.id, 'publicado');
  assert.equal(r.status, 422);
  assert.deepEqual(r.cuerpo.camposFaltantes, ['resumen']);
  assert.equal((await pedir(`/difusion/publicaciones/${borrador.id}`)).cuerpo.estado, 'borrador');
  assert.equal((await publico(borrador.id)).status, 404);
});

test('P3 · publicar muestra exactamente el contenido y solo los campos públicos', opciones, async () => {
  const { cuerpo: p } = await crear({ ...ACTIVIDAD, titulo: 'Publicable QA' });
  assert.equal((await estado(p.id, 'publicado')).status, 200);
  const detalle = await publico(p.id);
  assert.equal(detalle.status, 200);
  assert.deepEqual(Object.keys(detalle.cuerpo).sort(), CAMPOS_PUBLICOS);
  for (const campo of ['tipo', 'resumen', 'contenido', 'fechaInicio', 'fechaFin', 'modalidad', 'lugar', 'contactoUrl']) {
    assert.equal(detalle.cuerpo[campo], ACTIVIDAD[campo], campo);
  }
  assert.equal(detalle.cuerpo.titulo, 'Publicable QA');
  assert.ok(!/creadoPor|actualizadoPor|estado|retiradoEn/.test(JSON.stringify(Object.keys(detalle.cuerpo))));
  assert.ok((await idsPublicos()).includes(p.id));
});

test('P4 · ciclo borrador → publicado → retirado → borrador → publicado; transiciones no permitidas dan 409', opciones, async () => {
  const { cuerpo: p } = await crear({ ...ACTIVIDAD, titulo: 'Ciclo QA' });
  assert.equal((await estado(p.id, 'retirado')).status, 409, 'borrador → retirado');
  assert.equal((await estado(p.id, 'borrador')).status, 409, 'borrador → borrador');
  assert.equal((await estado(p.id, 'publicado')).status, 200);
  assert.equal((await estado(p.id, 'publicado')).status, 409, 'publicado → publicado');
  assert.equal((await estado(p.id, 'borrador')).status, 409, 'publicado → borrador');
  assert.equal((await estado(p.id, 'retirado')).status, 200);
  assert.equal((await publico(p.id)).status, 404, 'Retirada: la URL pública responde no encontrado');
  assert.ok(!(await idsPublicos()).includes(p.id));
  assert.equal((await estado(p.id, 'publicado')).status, 409, 'retirado → publicado directo');
  assert.equal((await estado(p.id, 'borrador')).status, 200);
  assert.equal((await publico(p.id)).status, 404);
  assert.equal((await estado(p.id, 'publicado')).status, 200);
  assert.equal((await publico(p.id)).status, 200, 'Se puede volver a publicar explícitamente');
  assert.equal((await estado(p.id, 'archivado')).status, 400, 'Estado fuera del catálogo');
});

test('P5 · editar una publicada conserva la autoría y valida los datos', opciones, async () => {
  const { cuerpo: p } = await crear({ ...ACTIVIDAD, titulo: 'Editable QA' });
  await estado(p.id, 'publicado');
  const r = await pedir(`/difusion/publicaciones/${p.id}`, { token: 'admin', metodo: 'PUT', cuerpo: { ...ACTIVIDAD, titulo: 'Editada QA' } });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.creadoPor, PERFILES.marketing);
  assert.equal(r.cuerpo.actualizadoPor, PERFILES.admin);
  assert.equal(r.cuerpo.estado, 'publicado');
  assert.equal((await publico(p.id)).cuerpo.titulo, 'Editada QA');

  const invalidos = [
    ['fin antes de inicio', { fechaInicio: '2026-12-05', fechaFin: '2026-12-01' }],
    ['fecha imposible', { fechaInicio: '2026-02-30' }],
    ['URL javascript:', { contactoUrl: 'javascript:alert(1)' }],
    ['URL sin protocolo', { contactoUrl: 'ejemplo.test' }],
    ['tipo fuera del catálogo', { tipo: 'taller' }],
    ['título vacío', { titulo: '   ' }],
    ['título de 151 caracteres', { titulo: 'x'.repeat(151) }],
    ['resumen de 501 caracteres', { resumen: 'x'.repeat(501) }],
    ['modalidad desconocida', { modalidad: 'hibrida' }],
    ['campo de autoría enviado por el cliente', { creadoPor: PERFILES.t1 }],
    ['estado enviado en el PUT', { estado: 'borrador' }],
  ];
  for (const [nombre, cambio] of invalidos) {
    const x = await pedir(`/difusion/publicaciones/${p.id}`, { metodo: 'PUT', cuerpo: { ...ACTIVIDAD, ...cambio } });
    assert.equal(x.status, 400, nombre);
  }
  assert.equal((await publico(p.id)).cuerpo.titulo, 'Editada QA', 'Los rechazos no cambian lo publicado');
});

test('P6 · una publicada no puede quedar sin resumen al editarla', opciones, async () => {
  const { cuerpo: p } = await crear({ ...ACTIVIDAD, titulo: 'Sin resumen tras editar QA' });
  await estado(p.id, 'publicado');
  const r = await pedir(`/difusion/publicaciones/${p.id}`, { metodo: 'PUT', cuerpo: { ...ACTIVIDAD, resumen: null } });
  const visible = await publico(p.id);
  assert.ok(
    r.status >= 400 || visible.status !== 200 || Boolean(visible.cuerpo.resumen),
    `Quedó publicada sin resumen (PUT ${r.status}); publicar exige resumen, editar debería respetarlo`,
  );
});

test('P7 · HTML o script en el contenido se guarda como texto, sin alterar, para que la interfaz lo muestre como texto', opciones, async () => {
  const contenido = '<script>alert("x")</script><img src=x onerror=alert(1)> Texto';
  const { cuerpo: p } = await crear({ ...ACTIVIDAD, titulo: 'Contenido con HTML QA', contenido });
  await estado(p.id, 'publicado');
  assert.equal((await publico(p.id)).cuerpo.contenido, contenido);
});

test('P8 · el portal no admite filtros internos ni escrituras', opciones, async () => {
  assert.equal((await pedir('/publico/publicaciones?estado=borrador', { token: null })).status, 400);
  assert.equal((await pedir('/publico/publicaciones?tipo=interno', { token: null })).status, 400);
  assert.equal((await pedir('/publico/publicaciones?tamano=101', { token: null })).status, 400);
  const { cuerpo: p } = await crear({ ...ACTIVIDAD, titulo: 'Sin escritura pública QA' });
  for (const [metodo, ruta, cuerpo] of [
    ['POST', '/publico/publicaciones', ACTIVIDAD],
    ['PUT', `/publico/publicaciones/${p.id}`, ACTIVIDAD],
    ['PATCH', `/publico/publicaciones/${p.id}/estado`, { estado: 'publicado' }],
    ['POST', `/publico/publicaciones/${p.id}/recursos`, { ruta: 'x.png' }],
    ['DELETE', `/publico/publicaciones/${p.id}`, undefined],
  ]) {
    const r = await pedir(ruta, { token: null, metodo, cuerpo });
    assert.ok([401, 404, 405].includes(r.status), `${metodo} ${ruta} respondió ${r.status}`);
  }
  assert.equal((await pedir(`/difusion/publicaciones/${p.id}`)).cuerpo.estado, 'borrador');
});

test('P9 · el portal no expone carpetas ni datos clínicos por ID', opciones, async () => {
  assert.equal((await publico(caso.id)).status, 404, 'El ID de una carpeta no sirve en el portal');
  assert.equal((await publico(caso.pacienteId)).status, 404);
  const texto = JSON.stringify((await pedir('/publico/publicaciones?tamano=100', { token: null })).cuerpo);
  assert.ok(!texto.includes('Paciente QA difusión'));
});

test('P10 · marketing no accede a nada clínico ni financiero', opciones, async () => {
  const rutas = [
    '/carpetas', `/carpetas/${caso.id}`, '/casos', `/casos/${caso.id}`,
    `/carpetas/${caso.id}/familia`, `/carpetas/${caso.id}/genograma`, `/carpetas/${caso.id}/genograma/archivo`,
    `/carpetas/${caso.id}/diagnostico`, `/carpetas/${caso.id}/historial`, `/carpetas/${caso.id}/sesiones`,
    `/carpetas/${caso.id}/pagos`, `/carpetas/${caso.id}/constancia`,
    '/indicadores?desde=2026-11-01&hasta=2026-11-30', '/indicadores/por-residencia?desde=2026-11-01&hasta=2026-11-30',
  ];
  for (const ruta of rutas) {
    assert.equal((await pedir(ruta, { token: 'mkt' })).status, 403, ruta);
  }
});

test('P11 · la terapeuta no gestiona difusión; sin sesión tampoco', opciones, async () => {
  const { cuerpo: p } = await crear({ ...ACTIVIDAD, titulo: 'Permisos QA' });
  for (const [token, esperado] of [['t1', 403], [null, 401]]) {
    assert.equal((await pedir('/difusion/publicaciones', { token })).status, esperado);
    assert.equal((await pedir('/difusion/publicaciones', { token, metodo: 'POST', cuerpo: ACTIVIDAD })).status, esperado);
    assert.equal((await estado(p.id, 'publicado', token)).status, esperado);
  }
  assert.equal((await pedir(`/difusion/publicaciones/${p.id}`)).cuerpo.estado, 'borrador');
});

test('P12 · recursos de imagen: rutas peligrosas y tipos no admitidos se rechazan', opciones, async () => {
  const { cuerpo: p } = await crear({ ...ACTIVIDAD, titulo: 'Imagen QA' });
  const recurso = { ruta: 'campanas/afiche-qa.png', tipoMime: 'image/png', tamanoBytes: 2048, textoAlternativo: 'Afiche ficticio', principal: true };
  const ok = await pedir(`/difusion/publicaciones/${p.id}/recursos`, { metodo: 'POST', cuerpo: recurso });
  assert.equal(ok.status, 201, JSON.stringify(ok.cuerpo));
  for (const [nombre, cambio] of [
    ['ruta con ..', { ruta: '../clinico/genograma.png' }],
    ['ruta absoluta', { ruta: '/etc/passwd' }],
    ['ruta con protocolo', { ruta: 'https://otro.test/x.png' }],
    ['SVG', { ruta: 'x.svg', tipoMime: 'image/svg+xml' }],
    ['más de 5 MB', { ruta: 'grande.png', tamanoBytes: 5 * 1024 * 1024 + 1 }],
    ['sin texto alternativo', { ruta: 'sin-alt.png', textoAlternativo: '  ' }],
  ]) {
    assert.equal((await pedir(`/difusion/publicaciones/${p.id}/recursos`, { metodo: 'POST', cuerpo: { ...recurso, principal: false, ...cambio } })).status, 400, nombre);
  }
  assert.equal((await pedir(`/difusion/publicaciones/${p.id}/recursos`, { metodo: 'POST', cuerpo: { ...recurso, ruta: 'otra.png' } })).status, 409, 'Una sola imagen principal');
  await estado(p.id, 'publicado');
  const imagen = (await publico(p.id)).cuerpo.imagen;
  assert.deepEqual({ ruta: imagen.ruta, textoAlternativo: imagen.textoAlternativo }, { ruta: recurso.ruta, textoAlternativo: recurso.textoAlternativo });
});

test('P13 · listado público: filtro por tipo, paginación y lista vacía sin error', opciones, async () => {
  const todas = await pedir('/publico/publicaciones?tamano=100', { token: null });
  assert.equal(todas.status, 200);
  assert.ok(todas.cuerpo.publicaciones.every((p) => Object.keys(p).sort().join() === CAMPOS_PUBLICOS.join()));
  const cursos = await pedir('/publico/publicaciones?tipo=curso', { token: null });
  assert.equal(cursos.status, 200);
  assert.deepEqual(cursos.cuerpo.publicaciones, []);
  assert.equal(cursos.cuerpo.total, 0);
  const pagina = await pedir('/publico/publicaciones?tamano=1&pagina=1', { token: null });
  assert.equal(pagina.cuerpo.publicaciones.length, 1);
  assert.equal(pagina.cuerpo.total, todas.cuerpo.total);
});
