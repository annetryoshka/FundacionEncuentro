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
const nombre = `fe80_run_${randomUUID().replaceAll("-", "")}`;
const terapeutaA = "00000000-0000-4000-8000-000000000002";
const terapeutaB = "00000000-0000-4000-8000-000000000003";
const marketing = "00000000-0000-4000-8000-000000000004";
let admin,
  conexion,
  api,
  db,
  creada = false;
let casoA, casoB, sesionA1, sesionB1;

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
  sesionA1 = await crearSesion(casoA.id, "2026-11-10");
  sesionB1 = await crearSesion(casoB.id, "2026-11-10");
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
          assert.match(nombre, /^fe80_run_[a-f0-9]{32}$/);
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

async function crearSesion(casoId, fecha) {
  const res = await api.solicitar(`/carpetas/${casoId}/sesiones`, {
    metodo: "POST",
    cuerpo: { fecha, evolucion: "Evolución ficticia QA" },
  });
  assert.equal(res.status, 201);
  return (await res.json()).sesion;
}

const crearTarea = (casoId, cuerpo, token = "fixture") =>
  api.solicitar(`/carpetas/${casoId}/tareas`, {
    metodo: "POST",
    cuerpo,
    token,
  });
const listarTareas = (casoId, token = "fixture") =>
  api.solicitar(`/carpetas/${casoId}/tareas`, { token });
const cambiarCumplimiento = (casoId, tareaId, estado, token = "fixture") =>
  api.solicitar(`/carpetas/${casoId}/tareas/${tareaId}/cumplimiento`, {
    metodo: "PATCH",
    cuerpo: estado === undefined ? {} : { estado },
    token,
  });
const tareasEnBase = async (casoId) =>
  (
    await conexion.query(
      "select * from tareas_terapeuticas where caso_id = $1 order by creado_en, id",
      [casoId],
    )
  ).rows;
const tareaDeA = async (token = "terapeutaA") =>
  (
    await (
      await crearTarea(
        casoA.id,
        { sesionId: sesionA1.id, descripcion: "Actividad de prueba" },
        token,
      )
    ).json()
  ).tarea;

test(
  "FE-80: un caso sin tareas responde 200 con lista vacía",
  opciones,
  async () => {
    const res = await listarTareas(casoA.id, "terapeutaA");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { tareas: [] });
  },
);

test(
  "FE-80: T1 agrega una tarea a S-A1, queda Pendiente, recortada y visible con su sesión",
  opciones,
  async () => {
    const res = await crearTarea(
      casoA.id,
      { sesionId: sesionA1.id, descripcion: "  Actividad de prueba  " },
      "terapeutaA",
    );
    assert.equal(res.status, 201);
    const { tarea } = await res.json();
    assert.equal(tarea.casoId, casoA.id);
    assert.equal(tarea.sesionId, sesionA1.id);
    assert.equal(tarea.numeroSesion, 1);
    assert.equal(tarea.descripcion, "Actividad de prueba");
    assert.equal(tarea.estado, "pendiente");
    assert.equal(tarea.creadoPor, terapeutaA);
    assert.equal(tarea.cumplimientoActualizadoPor, null);
    assert.equal(tarea.cumplimientoActualizadoEn, null);

    const lista = await (await listarTareas(casoA.id, "terapeutaA")).json();
    assert.deepEqual(lista.tareas, [tarea]);
  },
);

test(
  "FE-80: cambiar a Realizada se mantiene al recargar y registra quién y cuándo cambió",
  opciones,
  async () => {
    const original = await tareaDeA();

    const res = await cambiarCumplimiento(
      casoA.id,
      original.id,
      "realizada",
      "terapeutaA",
    );
    assert.equal(res.status, 200);
    const { tarea: realizada } = await res.json();
    assert.equal(realizada.estado, "realizada");
    assert.equal(realizada.cumplimientoActualizadoPor, terapeutaA);
    assert.ok(realizada.cumplimientoActualizadoEn);
    assert.equal(realizada.creadoPor, terapeutaA);
    assert.equal(realizada.creadoEn, original.creadoEn);

    const recarga = await (await listarTareas(casoA.id, "terapeutaA")).json();
    assert.deepEqual(recarga.tareas, [realizada]);
  },
);

test(
  "FE-80: se puede volver a Pendiente, repetir el mismo estado no reescribe y todo queda auditado",
  opciones,
  async () => {
    const original = await tareaDeA();
    const { tarea: realizada } = await (
      await cambiarCumplimiento(casoA.id, original.id, "realizada", "terapeutaA")
    ).json();

    const repetida = await (
      await cambiarCumplimiento(casoA.id, original.id, "realizada", "fixture")
    ).json();
    assert.deepEqual(repetida.tarea, realizada);

    const { tarea: pendiente } = await (
      await cambiarCumplimiento(casoA.id, original.id, "pendiente", "fixture")
    ).json();
    assert.equal(pendiente.estado, "pendiente");
    assert.equal(pendiente.cumplimientoActualizadoPor, actor);
    assert.ok(
      new Date(pendiente.cumplimientoActualizadoEn) >
        new Date(realizada.cumplimientoActualizadoEn),
    );

    const auditoria = (
      await conexion.query(
        `select accion, usuario_id from auditoria
          where tabla = 'tareas_terapeuticas' and registro_id = $1
          order by id`,
        [original.id],
      )
    ).rows;
    assert.deepEqual(auditoria, [
      { accion: "INSERT", usuario_id: terapeutaA },
      { accion: "UPDATE", usuario_id: terapeutaA },
      { accion: "UPDATE", usuario_id: actor },
    ]);
  },
);

test(
  "FE-80: datos inválidos responden 400 y la tarea anterior se conserva",
  opciones,
  async () => {
    const tarea = await tareaDeA();
    const antes = await tareasEnBase(casoA.id);

    const crearInvalidos = [
      { sesionId: sesionA1.id, descripcion: "" },
      { sesionId: sesionA1.id, descripcion: "     " },
      { sesionId: sesionA1.id },
      { sesionId: sesionA1.id, descripcion: "x".repeat(10001) },
      { descripcion: "Sin sesión QA" },
      { sesionId: "no-es-uuid", descripcion: "QA" },
      { sesionId: sesionA1.id, descripcion: "QA", estado: "realizada" },
      { sesionId: sesionA1.id, descripcion: "QA", casoId: casoB.id },
    ];
    for (const cuerpo of crearInvalidos) {
      const res = await crearTarea(casoA.id, cuerpo, "terapeutaA");
      assert.equal(
        res.status,
        400,
        `debió rechazar ${JSON.stringify(cuerpo).slice(0, 80)}`,
      );
    }

    for (const estado of ["completada", "Realizada", "", true, undefined]) {
      const res = await cambiarCumplimiento(
        casoA.id,
        tarea.id,
        estado,
        "terapeutaA",
      );
      assert.equal(res.status, 400, `debió rechazar estado ${estado}`);
    }
    assert.equal(
      (await cambiarCumplimiento(casoA.id, "no-es-uuid", "realizada")).status,
      400,
    );

    assert.deepEqual(await tareasEnBase(casoA.id), antes);
  },
);

test(
  "FE-80: desde A no se puede asociar una sesión del caso B ni una sesión inexistente",
  opciones,
  async () => {
    for (const sesionId of [sesionB1.id, randomUUID()]) {
      for (const token of ["terapeutaA", "fixture"]) {
        const res = await crearTarea(
          casoA.id,
          { sesionId, descripcion: "Sesión cruzada QA" },
          token,
        );
        assert.equal(res.status, 400);
      }
    }
    assert.equal((await tareasEnBase(casoA.id)).length, 0);
    assert.equal((await tareasEnBase(casoB.id)).length, 0);
  },
);

test(
  "FE-80: una tarea del caso B no se puede cambiar usando la ruta del caso A",
  opciones,
  async () => {
    const { tarea } = await (
      await crearTarea(
        casoB.id,
        { sesionId: sesionB1.id, descripcion: "Tarea de B" },
        "terapeutaB",
      )
    ).json();

    assert.equal(
      (await cambiarCumplimiento(casoA.id, tarea.id, "realizada")).status,
      404,
    );
    assert.equal(
      (await cambiarCumplimiento(casoA.id, randomUUID(), "realizada")).status,
      404,
    );
    assert.equal((await tareasEnBase(casoB.id))[0].completada, false);
  },
);

test(
  "FE-80: una cuenta ajena no puede crear, listar ni cambiar tareas",
  opciones,
  async () => {
    const { tarea } = await (
      await crearTarea(
        casoB.id,
        { sesionId: sesionB1.id, descripcion: "Tarea de B" },
        "terapeutaB",
      )
    ).json();
    const antes = await tareasEnBase(casoB.id);
    const cuerpo = { sesionId: sesionB1.id, descripcion: "Intruso QA" };

    assert.equal((await crearTarea(casoB.id, cuerpo, "terapeutaA")).status, 404);
    assert.equal((await listarTareas(casoB.id, "terapeutaA")).status, 404);
    assert.equal(
      (await cambiarCumplimiento(casoB.id, tarea.id, "realizada", "terapeutaA"))
        .status,
      404,
    );
    assert.equal((await crearTarea(casoB.id, cuerpo, "marketing")).status, 403);
    assert.equal((await listarTareas(casoB.id, "marketing")).status, 403);
    assert.equal((await listarTareas(casoB.id, null)).status, 401);
    assert.equal(
      (await cambiarCumplimiento(casoB.id, tarea.id, "realizada", "token-falso"))
        .status,
      401,
    );

    assert.equal((await listarTareas(randomUUID())).status, 404);
    await conexion.query("update casos set deleted_at = now() where id = $1", [
      casoB.id,
    ]);
    assert.equal((await listarTareas(casoB.id)).status, 404);
    assert.equal((await crearTarea(casoB.id, cuerpo)).status, 404);

    assert.deepEqual(await tareasEnBase(casoB.id), antes);
  },
);

test(
  "FE-80: el listado ordena las tareas según la cronología de sus sesiones",
  opciones,
  async () => {
    const sesionA2 = await crearSesion(casoA.id, "2026-11-01");
    await crearTarea(casoA.id, {
      sesionId: sesionA1.id,
      descripcion: "Tarea de la sesión 1",
    });
    await crearTarea(casoA.id, {
      sesionId: sesionA2.id,
      descripcion: "Tarea de la sesión 2",
    });

    const { tareas } = await (await listarTareas(casoA.id)).json();
    assert.deepEqual(
      tareas.map((t) => [t.numeroSesion, t.descripcion]),
      [
        [2, "Tarea de la sesión 2"],
        [1, "Tarea de la sesión 1"],
      ],
    );
  },
);

test(
  "FE-80: si el guardado falla no queda la tarea creada ni el cumplimiento cambiado",
  opciones,
  async () => {
    const tarea = await tareaDeA();
    await conexion.query(`
      create function qa_fallar_tarea() returns trigger language plpgsql as
      $$ begin raise exception 'fallo simulado QA'; end; $$;
      create trigger qa_fallo after insert or update on tareas_terapeuticas
        for each row execute function qa_fallar_tarea();
    `);
    try {
      const creacion = await crearTarea(casoA.id, {
        sesionId: sesionA1.id,
        descripcion: "No debe quedar",
      });
      assert.equal(creacion.status, 500);
      const cambio = await cambiarCumplimiento(casoA.id, tarea.id, "realizada");
      assert.equal(cambio.status, 500);
    } finally {
      await conexion.query(`
        drop trigger qa_fallo on tareas_terapeuticas;
        drop function qa_fallar_tarea();
      `);
    }
    const filas = await tareasEnBase(casoA.id);
    assert.equal(filas.length, 1);
    assert.equal(filas[0].completada, false);
    assert.equal(filas[0].cumplimiento_actualizado_por, null);
  },
);

test(
  "FE-80: tras reasignar el caso, la terapeuta anterior pierde acceso y se conserva quién creó la tarea",
  opciones,
  async () => {
    const tarea = await tareaDeA();
    await conexion.query(
      "update asignaciones_caso set perfil_id = $1 where caso_id = $2",
      [terapeutaB, casoA.id],
    );

    assert.equal((await listarTareas(casoA.id, "terapeutaA")).status, 404);
    assert.equal(
      (await cambiarCumplimiento(casoA.id, tarea.id, "realizada", "terapeutaA"))
        .status,
      404,
    );

    const res = await cambiarCumplimiento(
      casoA.id,
      tarea.id,
      "realizada",
      "terapeutaB",
    );
    assert.equal(res.status, 200);
    const { tarea: cambiada } = await res.json();
    assert.equal(cambiada.creadoPor, terapeutaA);
    assert.equal(cambiada.cumplimientoActualizadoPor, terapeutaB);
  },
);
