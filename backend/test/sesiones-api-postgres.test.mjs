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
const nombre = `fe75_run_${randomUUID().replaceAll("-", "")}`;
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
          assert.match(nombre, /^fe75_run_[a-f0-9]{32}$/);
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
  if (terapeuta) {
    await conexion.query(
      "insert into asignaciones_caso (caso_id, perfil_id, asignado_por) values ($1, $2, $3)",
      [caso.id, terapeuta, actor],
    );
  }
  return caso;
}

const registrar = (casoId, cuerpo, token = "fixture") =>
  api.solicitar(`/carpetas/${casoId}/sesiones`, {
    metodo: "POST",
    cuerpo,
    token,
  });
const listar = (casoId, token = "fixture") =>
  api.solicitar(`/carpetas/${casoId}/sesiones`, { token });
const detalle = (casoId, sesionId, token = "fixture") =>
  api.solicitar(`/carpetas/${casoId}/sesiones/${sesionId}`, { token });
const sesionValida = {
  fecha: "2026-11-10",
  evolucion: "Evolución ficticia QA",
};
const sesionesEnBase = async (casoId) =>
  (
    await conexion.query(
      "select * from fichas_seguimiento where caso_id = $1 order by nro_sesion",
      [casoId],
    )
  ).rows;

test(
  "FE-75: un caso sin sesiones responde 200 con lista vacía (no es un error)",
  opciones,
  async () => {
    const res = await listar(casoA.id, "terapeutaA");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { sesiones: [] });
  },
);

test(
  "FE-75: la terapeuta registra una sesión, se guarda recortada y al recargar el detalle es el mismo",
  opciones,
  async () => {
    const res = await registrar(
      casoA.id,
      { fecha: "2026-11-10", evolucion: "  Evolución QA  " },
      "terapeutaA",
    );
    assert.equal(res.status, 201);
    const { sesion } = await res.json();
    assert.equal(sesion.casoId, casoA.id);
    assert.equal(sesion.numero, 1);
    assert.equal(sesion.fecha, "2026-11-10");
    assert.equal(sesion.evolucion, "Evolución QA");
    assert.deepEqual(sesion.responsable, {
      id: terapeutaA,
      nombreCompleto: "T1 QA",
    });
    assert.equal(sesion.creadoPor, terapeutaA);

    const recarga = await detalle(casoA.id, sesion.id, "terapeutaA");
    assert.equal(recarga.status, 200);
    assert.deepEqual((await recarga.json()).sesion, sesion);
  },
);

test(
  "FE-75: el listado ordena por fecha y número ascendentes y cada detalle muestra su propia evolución",
  opciones,
  async () => {
    const s1 = (
      await (
        await registrar(casoA.id, {
          fecha: "2026-11-10",
          evolucion: "Evolución uno",
        })
      ).json()
    ).sesion;
    const s2 = (
      await (
        await registrar(casoA.id, {
          fecha: "2026-11-10",
          evolucion: "Evolución dos",
        })
      ).json()
    ).sesion;
    const s3 = (
      await (
        await registrar(casoA.id, {
          fecha: "2026-11-01",
          evolucion: "Evolución tres",
        })
      ).json()
    ).sesion;

    const res = await listar(casoA.id, "terapeutaA");
    assert.equal(res.status, 200);
    const { sesiones } = await res.json();
    assert.deepEqual(
      sesiones.map((s) => [s.fecha, s.numero]),
      [
        ["2026-11-01", 3],
        ["2026-11-10", 1],
        ["2026-11-10", 2],
      ],
    );
    assert.ok(sesiones.every((s) => !("evolucion" in s)));

    const abierta = await (await detalle(casoA.id, s2.id)).json();
    assert.equal(abierta.sesion.numero, 2);
    assert.equal(abierta.sesion.evolucion, "Evolución dos");
    assert.notEqual(s1.id, s3.id);
  },
);

test(
  "FE-75: datos inválidos responden 400 y no se crea ningún registro parcial",
  opciones,
  async () => {
    const invalidos = [
      { ...sesionValida, fecha: "2026-02-30" },
      { ...sesionValida, fecha: "10/11/2026" },
      { ...sesionValida, fecha: "" },
      { evolucion: "Sin fecha QA" },
      { ...sesionValida, evolucion: "     " },
      { ...sesionValida, evolucion: "" },
      { fecha: "2026-11-10" },
      { ...sesionValida, evolucion: "x".repeat(10001) },
      { ...sesionValida, numero: 99 },
      { ...sesionValida, responsableId: terapeutaB },
    ];
    for (const cuerpo of invalidos) {
      const res = await registrar(casoA.id, cuerpo, "terapeutaA");
      assert.equal(
        res.status,
        400,
        `debió rechazar ${JSON.stringify(cuerpo).slice(0, 80)}`,
      );
    }
    assert.equal((await registrar("no-es-uuid", sesionValida)).status, 400);
    assert.equal((await detalle(casoA.id, "no-es-uuid")).status, 400);

    assert.equal((await sesionesEnBase(casoA.id)).length, 0);
  },
);

test(
  "FE-75: una sesión de otro caso no se puede abrir desde el caso incorrecto",
  opciones,
  async () => {
    const { sesion } = await (
      await registrar(casoB.id, sesionValida, "terapeutaB")
    ).json();

    assert.equal((await detalle(casoA.id, sesion.id)).status, 404);
    assert.equal((await detalle(casoA.id, sesion.id, "terapeutaA")).status, 404);
    assert.equal((await detalle(casoB.id, randomUUID())).status, 404);
    assert.equal((await detalle(casoB.id, sesion.id)).status, 200);
  },
);

test(
  "FE-75: una cuenta ajena no puede registrar, listar ni abrir sesiones",
  opciones,
  async () => {
    const { sesion } = await (
      await registrar(casoB.id, sesionValida, "terapeutaB")
    ).json();
    const antes = await sesionesEnBase(casoB.id);

    assert.equal((await registrar(casoB.id, sesionValida, "terapeutaA")).status, 404);
    assert.equal((await listar(casoB.id, "terapeutaA")).status, 404);
    assert.equal((await detalle(casoB.id, sesion.id, "terapeutaA")).status, 404);
    assert.equal((await registrar(casoB.id, sesionValida, "marketing")).status, 403);
    assert.equal((await listar(casoB.id, "marketing")).status, 403);
    assert.equal((await listar(casoB.id, null)).status, 401);
    assert.equal((await registrar(casoB.id, sesionValida, "token-falso")).status, 401);

    const inexistente = randomUUID();
    assert.equal((await listar(inexistente)).status, 404);
    await conexion.query("update casos set deleted_at = now() where id = $1", [
      casoB.id,
    ]);
    assert.equal((await listar(casoB.id)).status, 404);
    assert.equal((await registrar(casoB.id, sesionValida)).status, 404);

    assert.deepEqual(await sesionesEnBase(casoB.id), antes);
  },
);

test(
  "FE-75: si el guardado falla no queda la sesión a medias y el siguiente número no se salta",
  opciones,
  async () => {
    const sinTerapeuta = await crearCaso("Caso sin terapeuta QA", null);
    assert.equal((await registrar(sinTerapeuta.id, sesionValida)).status, 400);
    assert.equal((await sesionesEnBase(sinTerapeuta.id)).length, 0);

    await conexion.query(`
      create function qa_fallar_sesion() returns trigger language plpgsql as
      $$ begin raise exception 'fallo simulado QA'; end; $$;
      create trigger qa_fallo after insert on fichas_seguimiento
        for each row execute function qa_fallar_sesion();
    `);
    try {
      const res = await registrar(casoA.id, sesionValida, "terapeutaA");
      assert.equal(res.status, 500);
    } finally {
      await conexion.query(`
        drop trigger qa_fallo on fichas_seguimiento;
        drop function qa_fallar_sesion();
      `);
    }
    assert.equal((await sesionesEnBase(casoA.id)).length, 0);

    const res = await registrar(casoA.id, sesionValida, "terapeutaA");
    assert.equal(res.status, 201);
    assert.equal((await res.json()).sesion.numero, 1);
  },
);

test(
  "FE-75: con 16 sesiones registradas, la sesión 17 se puede guardar",
  opciones,
  async () => {
    for (let i = 1; i <= 16; i++) {
      const dia = String(i).padStart(2, "0");
      const res = await registrar(casoA.id, {
        fecha: `2026-10-${dia}`,
        evolucion: `Evolución ${i}`,
      });
      assert.equal(res.status, 201);
    }
    const res = await registrar(casoA.id, {
      fecha: "2026-11-12",
      evolucion: "Evolución 17",
    }, "terapeutaA");
    assert.equal(res.status, 201);
    assert.equal((await res.json()).sesion.numero, 17);

    const { sesiones } = await (await listar(casoA.id)).json();
    assert.deepEqual(
      sesiones.map((s) => s.numero),
      Array.from({ length: 17 }, (_, i) => i + 1),
    );
  },
);

test(
  "FE-75: registros simultáneos reciben números distintos y consecutivos",
  opciones,
  async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        registrar(casoA.id, { ...sesionValida, evolucion: `Paralela ${i}` }),
      ),
    );
    assert.ok(respuestas.every((r) => r.status === 201));
    const numeros = (await sesionesEnBase(casoA.id)).map((s) => s.nro_sesion);
    assert.deepEqual(numeros, [1, 2, 3, 4, 5]);
  },
);

test(
  "FE-75: el responsable registrado se conserva tras reasignar el caso y la autoría es de quien registra",
  opciones,
  async () => {
    const { sesion } = await (
      await registrar(casoA.id, sesionValida, "fixture")
    ).json();
    assert.equal(sesion.creadoPor, actor);
    assert.equal(sesion.responsable.id, terapeutaA);

    await conexion.query(
      "update asignaciones_caso set perfil_id = $1 where caso_id = $2",
      [terapeutaB, casoA.id],
    );

    assert.equal((await listar(casoA.id, "terapeutaA")).status, 404);
    const res = await detalle(casoA.id, sesion.id, "terapeutaB");
    assert.equal(res.status, 200);
    assert.equal((await res.json()).sesion.responsable.id, terapeutaA);

    const nueva = await (
      await registrar(casoA.id, sesionValida, "terapeutaB")
    ).json();
    assert.equal(nueva.sesion.responsable.id, terapeutaB);
    assert.equal(nueva.sesion.numero, 2);
  },
);
