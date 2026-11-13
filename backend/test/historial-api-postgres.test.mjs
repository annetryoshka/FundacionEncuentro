import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { before, beforeEach, after, test } from "node:test";
import pg from "pg";
import { DatabaseService } from "../dist/database/database.service.js";
import { actor, datos, servidor } from "./helpers/casos.mjs";

const habilitada =
  process.env.FE40_PG_QA === "1" && Boolean(process.env.FE40_PG_ADMIN_URL);
const opciones = {
  skip: habilitada
    ? false
    : "Requiere PostgreSQL QA local opt-in FE40_PG_QA y FE40_PG_ADMIN_URL",
  timeout: 25000,
};
const nombre = `fe85_run_${randomUUID().replaceAll("-", "")}`;
const terapeutaA = "00000000-0000-4000-8000-000000000002";
const terapeutaB = "00000000-0000-4000-8000-000000000003";
const marketing = "00000000-0000-4000-8000-000000000004";
let admin,
  conexion,
  api,
  db,
  creada = false;
let casoA, casoB;

before(async () => {
  if (!habilitada) return;
  const url = new URL(process.env.FE40_PG_ADMIN_URL);
  assert.ok(
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.pathname === "/fe40_qa" &&
      ["postgres:", "postgresql:"].includes(url.protocol),
    "Se exige PostgreSQL QA local en base fe40_qa",
  );
  admin = new pg.Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 3000,
    statement_timeout: 10000,
  });
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${nombre}"`);
    creada = true;
    url.pathname = `/${nombre}`;
    conexion = new pg.Client({
      connectionString: url.toString(),
      connectionTimeoutMillis: 3000,
      statement_timeout: 10000,
    });
    await conexion.connect();
    await conexion.query(
      "create schema auth; create table auth.users (id uuid primary key); create schema extensions",
    );
    const directorio = new URL("../../db/migrations/", import.meta.url);
    const archivos = (await readdir(directorio))
      .filter((archivo) => /^\d+.*\.sql$/.test(archivo))
      .sort();
    await conexion.query("BEGIN");
    try {
      for (const archivo of archivos)
        await conexion.query(
          await readFile(new URL(archivo, directorio), "utf8"),
        );
      await conexion.query("COMMIT");
    } catch (error) {
      await conexion.query("ROLLBACK");
      throw error;
    }
    for (const [id, rol, nombrePerfil] of [
      [actor, "administrador", "Admin QA"],
      [terapeutaA, "terapeuta", "T1 QA"],
      [terapeutaB, "terapeuta", "T2 QA"],
      [marketing, "marketing", "Marketing QA"],
    ]) {
      await conexion.query("insert into auth.users (id) values ($1)", [id]);
      await conexion.query(
        "insert into perfiles (id, nombre_completo, rol) values ($1, $2, $3)",
        [id, nombrePerfil, rol],
      );
    }
    db = new DatabaseService({ getOrThrow: () => url.toString() });
    api = await servidor(db, {
      fixture: actor,
      terapeutaA,
      terapeutaB,
      marketing,
    });
  } catch {
    assert.fail(
      "No se pudo preparar PostgreSQL QA: revisar servicio, migraciones y permisos; secretos omitidos",
    );
  }
});

beforeEach(async () => {
  if (!habilitada) return;
  await conexion.query(
    "truncate pacientes, casos, auditoria restart identity cascade",
  );
  await conexion.query("update contadores_caso set ultimo_numero = 0");
  casoA = await crearCaso("Ana Ficticia QA", terapeutaA);
  casoB = await crearCaso("Beto Ficticio QA", terapeutaB);
});

after(async () => {
  if (!habilitada) return;
  try {
    if (api) await api.close();
    else if (db) await db.onModuleDestroy();
  } finally {
    try {
      await conexion?.end();
    } finally {
      try {
        if (creada) {
          assert.match(nombre, /^fe85_run_[a-f0-9]{32}$/);
          await admin.query(`DROP DATABASE "${nombre}" WITH (FORCE)`);
        }
      } finally {
        await admin?.end();
      }
    }
  }
});

async function crearCaso(paciente, terapeuta) {
  const res = await api.post(datos(paciente));
  assert.equal(res.status, 201);
  const caso = await res.json();
  await conexion.query(
    "insert into asignaciones_caso (caso_id, perfil_id, asignado_por) values ($1, $2, $3)",
    [caso.id, terapeuta, actor],
  );
  return caso;
}

async function enviar(ruta, metodo, cuerpo, esperado) {
  const res = await api.solicitar(ruta, { metodo, cuerpo });
  assert.equal(res.status, esperado, `${metodo} ${ruta}`);
  return res.json();
}

async function crearSesion(casoId, fecha, evolucion) {
  const { sesion } = await enviar(
    `/carpetas/${casoId}/sesiones`,
    "POST",
    { fecha, evolucion },
    201,
  );
  return sesion;
}

async function crearTarea(casoId, sesionId, descripcion) {
  const { tarea } = await enviar(
    `/carpetas/${casoId}/tareas`,
    "POST",
    { sesionId, descripcion },
    201,
  );
  return tarea;
}

async function completarCaso(caso, prefijo) {
  await conexion.query(
    `insert into contexto_judicial (caso_id, juzgado, nro_expediente, fecha_derivacion)
     values ($1, $2, $3, '2026-10-01')`,
    [caso.id, `Juzgado ${prefijo}`, `EXP-${prefijo}`],
  );
  await conexion.query(
    `insert into constancias_atencion (
       caso_id, procedencia, origen_judicial, estado,
       fecha_consentimiento, referencia_evidencia, creado_por, actualizado_por
     ) values ($1, $2, true, 'registrado', '2026-10-02', $3, $4, $4)`,
    [caso.id, `Procedencia ${prefijo}`, `REF-${prefijo}`, actor],
  );
  await enviar(
    `/carpetas/${caso.id}/diagnostico`,
    "PUT",
    { fecha: "2026-10-05", diagnosticoIngreso: `Diagnóstico ${prefijo}` },
    200,
  );
  const s1 = await crearSesion(caso.id, "2026-11-10", `Evolución ${prefijo} 1`);
  const s2 = await crearSesion(caso.id, "2026-11-01", `Evolución ${prefijo} 2`);
  await crearTarea(caso.id, s1.id, `Tarea ${prefijo} en sesión 1`);
  await crearTarea(caso.id, s2.id, `Tarea ${prefijo} en sesión 2`);
  return { s1, s2 };
}

const verHistorial = (casoId, token = "fixture") =>
  api.solicitar(`/carpetas/${casoId}/historial`, { token });

test(
  "FE-85: un caso sin registros devuelve el encabezado y las secciones vacías («Sin registro»)",
  opciones,
  async () => {
    const res = await verHistorial(casoA.id, "terapeutaA");
    assert.equal(res.status, 200);
    const historial = await res.json();
    assert.equal(historial.carpeta.id, casoA.id);
    assert.equal(historial.carpeta.paciente.nombreCompleto, "Ana Ficticia QA");
    assert.deepEqual(historial.carpeta.terapeuta, {
      id: terapeutaA,
      nombreCompleto: "T1 QA",
    });
    assert.equal(historial.contexto, null);
    assert.equal(historial.constancia, null);
    assert.equal(historial.diagnostico, null);
    assert.deepEqual(historial.sesiones, []);
  },
);

test(
  "FE-85: T1 ve el historial completo de A en orden y cada tarea dentro de su sesión",
  opciones,
  async () => {
    const { s1, s2 } = await completarCaso(casoA, "A");
    await completarCaso(casoB, "B");

    const res = await verHistorial(casoA.id, "terapeutaA");
    assert.equal(res.status, 200);
    const historial = await res.json();

    assert.deepEqual(Object.keys(historial).sort(), [
      "carpeta",
      "constancia",
      "contexto",
      "diagnostico",
      "sesiones",
    ]);
    assert.equal(historial.contexto.juzgado, "Juzgado A");
    assert.equal(historial.constancia.estado, "registrado");
    assert.equal(historial.constancia.fechaConsentimiento, "2026-10-02");
    assert.equal(historial.diagnostico.diagnosticoIngreso, "Diagnóstico A");
    assert.equal(historial.diagnostico.creadoPor, actor);

    assert.deepEqual(
      historial.sesiones.map((s) => [s.id, s.numero, s.fecha]),
      [
        [s2.id, 2, "2026-11-01"],
        [s1.id, 1, "2026-11-10"],
      ],
    );
    assert.equal(historial.sesiones[0].evolucion, "Evolución A 2");
    for (const sesion of historial.sesiones) {
      assert.equal(sesion.tareas.length, 1);
      assert.equal(sesion.tareas[0].sesionId, sesion.id);
      assert.equal(sesion.tareas[0].descripcion, `Tarea A en sesión ${sesion.numero}`);
    }
    const texto = JSON.stringify(historial);
    for (const dato of ["Beto Ficticio", "Juzgado B", "Evolución B", "Tarea B"]) {
      assert.ok(!texto.includes(dato), `el historial de A trae «${dato}»`);
    }
  },
);

test(
  "FE-85: con un pago registrado, la respuesta clínica no incluye montos ni datos financieros",
  opciones,
  async () => {
    const { s1 } = await completarCaso(casoA, "A");
    await conexion.query(
      `insert into pagos (caso_id, sesion_id, fecha, monto, metodo, registrado_por)
       values ($1, $2, '2026-11-10', 987.65, 'qr', $3)`,
      [casoA.id, s1.id, actor],
    );

    for (const token of ["terapeutaA", "fixture"]) {
      const res = await verHistorial(casoA.id, token);
      assert.equal(res.status, 200);
      const texto = await res.text();
      assert.ok(!texto.includes("987.65"), `${token} no debe ver el monto`);
      for (const clave of ["pagos", "monto", "metodo", "moneda"]) {
        assert.ok(!texto.includes(`"${clave}"`), `${token} no debe ver ${clave}`);
      }
    }
  },
);

test(
  "FE-85: A sin ficha muestra diagnóstico vacío y conserva las demás secciones",
  opciones,
  async () => {
    await completarCaso(casoA, "A");
    await conexion.query("delete from fichas_diagnostico where caso_id = $1", [
      casoA.id,
    ]);

    const historial = await (await verHistorial(casoA.id, "terapeutaA")).json();
    assert.equal(historial.diagnostico, null);
    assert.equal(historial.contexto.juzgado, "Juzgado A");
    assert.equal(historial.constancia.estado, "registrado");
    assert.equal(historial.sesiones.length, 2);
  },
);

test(
  "FE-85: T2, marketing o un pedido sin sesión no obtienen datos de A",
  opciones,
  async () => {
    await completarCaso(casoA, "A");

    const t2 = await verHistorial(casoA.id, "terapeutaB");
    assert.equal(t2.status, 404);
    const cuerpoT2 = await t2.text();
    for (const dato of ["Ana Ficticia", "Juzgado A", "Diagnóstico A", "Evolución A"]) {
      assert.ok(!cuerpoT2.includes(dato), `la respuesta a T2 filtró «${dato}»`);
    }

    assert.equal((await verHistorial(casoA.id, "marketing")).status, 403);
    assert.equal((await verHistorial(casoA.id, null)).status, 401);
    assert.equal((await verHistorial(casoA.id, "token-falso")).status, 401);
    assert.equal((await verHistorial("no-es-uuid")).status, 400);
    assert.equal((await verHistorial(randomUUID())).status, 404);
  },
);

test(
  "FE-85: administración ve únicamente los datos del caso que consulta",
  opciones,
  async () => {
    await completarCaso(casoA, "A");
    await completarCaso(casoB, "B");

    const historial = await (await verHistorial(casoB.id, "fixture")).json();
    assert.equal(historial.carpeta.id, casoB.id);
    assert.equal(historial.contexto.juzgado, "Juzgado B");
    assert.ok(historial.sesiones.every((s) => s.casoId === casoB.id));
    assert.ok(
      historial.sesiones.flatMap((s) => s.tareas).every((t) => t.casoId === casoB.id),
    );
    assert.ok(!JSON.stringify(historial).includes("Ana Ficticia"));
  },
);

test(
  "FE-85: un caso eliminado o con paciente eliminado responde 404",
  opciones,
  async () => {
    await conexion.query("update casos set deleted_at = now() where id = $1", [
      casoA.id,
    ]);
    assert.equal((await verHistorial(casoA.id)).status, 404);
    assert.equal((await verHistorial(casoA.id, "terapeutaA")).status, 404);

    await conexion.query(
      "update pacientes set deleted_at = now() where id = (select paciente_id from casos where id = $1)",
      [casoB.id],
    );
    assert.equal((await verHistorial(casoB.id)).status, 404);
  },
);

test(
  "FE-85: al reasignar, la consulta nueva se autoriza con la asignación vigente",
  opciones,
  async () => {
    await completarCaso(casoA, "A");
    assert.equal((await verHistorial(casoA.id, "terapeutaA")).status, 200);

    await conexion.query(
      "update asignaciones_caso set perfil_id = $1 where caso_id = $2",
      [terapeutaB, casoA.id],
    );

    assert.equal((await verHistorial(casoA.id, "terapeutaA")).status, 404);
    const res = await verHistorial(casoA.id, "terapeutaB");
    assert.equal(res.status, 200);
    const historial = await res.json();
    assert.equal(historial.carpeta.terapeuta.id, terapeutaB);
    assert.ok(historial.sesiones.every((s) => s.responsable.id === terapeutaA));
  },
);
