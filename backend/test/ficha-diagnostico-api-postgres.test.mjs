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
const nombre = `fe70_run_${randomUUID().replaceAll("-", "")}`;
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
  await conexion.query("truncate auditoria restart identity");
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
          assert.match(nombre, /^fe70_run_[a-f0-9]{32}$/);
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

const verFicha = (id, token = "fixture") =>
  api.solicitar(`/carpetas/${id}/diagnostico`, { token });
const guardarFicha = (id, cuerpo, token = "fixture") =>
  api.solicitar(`/carpetas/${id}/diagnostico`, {
    metodo: "PUT",
    cuerpo,
    token,
  });
const fichaValida = {
  fecha: "2026-10-12",
  diagnosticoIngreso: "Evaluación inicial ficticia QA",
};
const fichasEnBase = async (id) =>
  (
    await conexion.query(
      "select * from fichas_diagnostico where caso_id = $1",
      [id],
    )
  ).rows;

test(
  "FE-70: una carpeta sin ficha responde 200 con diagnostico null (ausente, no error)",
  opciones,
  async () => {
    const res = await verFicha(casoA.id, "terapeutaA");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { diagnostico: null });
  },
);

test(
  "FE-70: la terapeuta asignada crea la ficha con opcionales vacíos y al recargar obtiene la misma",
  opciones,
  async () => {
    const res = await guardarFicha(casoA.id, fichaValida, "terapeutaA");
    assert.equal(res.status, 200);
    const { diagnostico: creadaFicha } = await res.json();
    assert.equal(creadaFicha.casoId, casoA.id);
    assert.equal(creadaFicha.fecha, "2026-10-12");
    assert.equal(
      creadaFicha.diagnosticoIngreso,
      "Evaluación inicial ficticia QA",
    );
    assert.equal(creadaFicha.hipotesisRelacional, null);
    assert.equal(creadaFicha.comentariosClinicos, null);
    assert.equal(creadaFicha.creadoPor, terapeutaA);
    assert.equal(creadaFicha.actualizadoPor, terapeutaA);

    const recarga = await verFicha(casoA.id, "terapeutaA");
    assert.equal(recarga.status, 200);
    assert.deepEqual((await recarga.json()).diagnostico, creadaFicha);
  },
);

test(
  "FE-70: editar conserva id y autoría de creación, registra quién actualizó y no duplica la ficha",
  opciones,
  async () => {
    const { diagnostico: original } = await (
      await guardarFicha(casoA.id, fichaValida, "terapeutaA")
    ).json();

    const res = await guardarFicha(casoA.id, {
      ...fichaValida,
      fecha: "2026-10-20",
      hipotesisRelacional: "Hipótesis ficticia QA",
    });
    assert.equal(res.status, 200);
    const { diagnostico: editada } = await res.json();

    assert.equal(editada.id, original.id);
    assert.equal(editada.creadoPor, terapeutaA);
    assert.equal(editada.creadoEn, original.creadoEn);
    assert.equal(editada.actualizadoPor, actor);
    assert.ok(
      new Date(editada.actualizadoEn) > new Date(original.actualizadoEn),
    );
    assert.equal(editada.fecha, "2026-10-20");
    assert.equal(editada.hipotesisRelacional, "Hipótesis ficticia QA");
    assert.equal((await fichasEnBase(casoA.id)).length, 1);

    const auditoria = (
      await conexion.query(
        `select usuario_id, datos_anteriores ->> 'fecha' as fecha_antes
       from auditoria where tabla = 'fichas_diagnostico' and accion = 'UPDATE' and registro_id = $1`,
        [original.id],
      )
    ).rows;
    assert.deepEqual(auditoria, [
      { usuario_id: actor, fecha_antes: "2026-10-12" },
    ]);
  },
);

test(
  "FE-70: los textos se guardan sin espacios sobrantes y un opcional de solo espacios queda vacío",
  opciones,
  async () => {
    const res = await guardarFicha(casoA.id, {
      fecha: "2026-10-12",
      diagnosticoIngreso: "  Evaluación QA  ",
      hipotesisRelacional: "   ",
    });
    assert.equal(res.status, 200);
    const { diagnostico } = await res.json();
    assert.equal(diagnostico.diagnosticoIngreso, "Evaluación QA");
    assert.equal(diagnostico.hipotesisRelacional, null);
  },
);

test(
  "FE-70: datos inválidos responden 400 y la ficha anterior queda igual",
  opciones,
  async () => {
    await guardarFicha(casoA.id, fichaValida, "terapeutaA");
    const antes = await fichasEnBase(casoA.id);

    const invalidos = [
      { ...fichaValida, fecha: "2026-02-30" },
      { ...fichaValida, fecha: "12/10/2026" },
      { ...fichaValida, fecha: "" },
      { diagnosticoIngreso: "Sin fecha QA" },
      { ...fichaValida, diagnosticoIngreso: "     " },
      { ...fichaValida, diagnosticoIngreso: "" },
      { fecha: "2026-10-12" },
      { ...fichaValida, diagnosticoIngreso: "x".repeat(10001) },
      { ...fichaValida, creadoPor: terapeutaB },
    ];
    for (const cuerpo of invalidos) {
      const res = await guardarFicha(casoA.id, cuerpo, "terapeutaA");
      assert.equal(
        res.status,
        400,
        `debió rechazar ${JSON.stringify(cuerpo).slice(0, 80)}`,
      );
    }
    assert.equal((await guardarFicha("no-es-uuid", fichaValida)).status, 400);
    assert.equal((await verFicha("no-es-uuid")).status, 400);

    assert.deepEqual(await fichasEnBase(casoA.id), antes);
  },
);

test(
  "FE-70: una cuenta ajena no puede leer ni escribir la ficha",
  opciones,
  async () => {
    await guardarFicha(casoB.id, fichaValida, "terapeutaB");
    const antes = await fichasEnBase(casoB.id);

    assert.equal((await verFicha(casoB.id, "terapeutaA")).status, 404);
    assert.equal(
      (await guardarFicha(casoB.id, fichaValida, "terapeutaA")).status,
      404,
    );
    assert.equal((await verFicha(casoB.id, "marketing")).status, 403);
    assert.equal(
      (await guardarFicha(casoB.id, fichaValida, "marketing")).status,
      403,
    );
    assert.equal((await verFicha(casoB.id, null)).status, 401);
    assert.equal(
      (await guardarFicha(casoB.id, fichaValida, "token-falso")).status,
      401,
    );

    assert.deepEqual(await fichasEnBase(casoB.id), antes);
    assert.equal((await fichasEnBase(casoA.id)).length, 0);
  },
);

test(
  "FE-70: carpetas inexistentes o eliminadas responden 404",
  opciones,
  async () => {
    const inexistente = randomUUID();
    assert.equal((await verFicha(inexistente)).status, 404);
    assert.equal((await guardarFicha(inexistente, fichaValida)).status, 404);

    await conexion.query("update casos set deleted_at = now() where id = $1", [
      casoA.id,
    ]);
    assert.equal((await verFicha(casoA.id)).status, 404);
    assert.equal((await guardarFicha(casoA.id, fichaValida)).status, 404);
  },
);

test(
  "FE-70: al reasignar el caso, la terapeuta anterior pierde el acceso a la ficha",
  opciones,
  async () => {
    await guardarFicha(casoA.id, fichaValida, "terapeutaA");
    await conexion.query(
      "update asignaciones_caso set perfil_id = $1 where caso_id = $2",
      [terapeutaB, casoA.id],
    );

    assert.equal((await verFicha(casoA.id, "terapeutaA")).status, 404);
    assert.equal((await verFicha(casoA.id, "terapeutaB")).status, 200);
  },
);
