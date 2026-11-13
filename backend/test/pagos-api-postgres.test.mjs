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
const nombre = `fe90_run_${randomUUID().replaceAll("-", "")}`;
const terapeutaA = "00000000-0000-4000-8000-000000000002";
const terapeutaB = "00000000-0000-4000-8000-000000000003";
const marketing = "00000000-0000-4000-8000-000000000004";
let admin,
  conexion,
  api,
  db,
  creada = false;
let casoA, casoB, sesionA1, sesionA2, sesionB1;

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
  sesionA2 = await crearSesion(casoA.id, "2026-11-11");
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
          assert.match(nombre, /^fe90_run_[a-f0-9]{32}$/);
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

const registrarPago = (casoId, cuerpo, token = "fixture") =>
  api.solicitar(`/carpetas/${casoId}/pagos`, {
    metodo: "POST",
    cuerpo,
    token,
  });
const listarPagos = (casoId, token = "fixture") =>
  api.solicitar(`/carpetas/${casoId}/pagos`, { token });
const pagoValido = () => ({
  sesionId: sesionA1.id,
  monto: "75.50",
  fecha: "2026-11-12",
  metodo: "qr",
});
const pagosEnBase = async (casoId) =>
  (
    await conexion.query(
      "select id, sesion_id, monto::text as monto from pagos where caso_id = $1 order by fecha, id",
      [casoId],
    )
  ).rows;
const totalCaso = async (casoId) =>
  (
    await conexion.query(
      "select coalesce(sum(monto), 0)::text as total from pagos where caso_id = $1",
      [casoId],
    )
  ).rows[0].total;

test(
  "FE-90: un caso sin pagos responde 200 con lista vacía",
  opciones,
  async () => {
    const res = await listarPagos(casoA.id);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { pagos: [] });
  },
);

test(
  "FE-90: administración guarda Bs 75,50 para S-A1 por QR y al recargar ve el mismo pago",
  opciones,
  async () => {
    const res = await registrarPago(casoA.id, {
      ...pagoValido(),
      referencia: "  QR-0001  ",
    });
    assert.equal(res.status, 200);
    const { pago, reutilizado } = await res.json();
    assert.equal(reutilizado, false);
    assert.equal(pago.casoId, casoA.id);
    assert.equal(pago.sesionId, sesionA1.id);
    assert.equal(pago.monto, "75.50");
    assert.equal(pago.moneda, "BOB");
    assert.equal(pago.fecha, "2026-11-12");
    assert.equal(pago.metodo, "qr");
    assert.equal(pago.referencia, "QR-0001");
    assert.equal(pago.registradoPor, actor);

    const recarga = await (await listarPagos(casoA.id)).json();
    assert.deepEqual(recarga.pagos, [pago]);

    const auditoria = (
      await conexion.query(
        "select accion, usuario_id from auditoria where tabla = 'pagos'",
      )
    ).rows;
    assert.deepEqual(auditoria, [{ accion: "INSERT", usuario_id: actor }]);
  },
);

test(
  "FE-90: repetir la misma solicitud no duplica el cobro y el total sigue en Bs 75,50",
  opciones,
  async () => {
    const primero = await (await registrarPago(casoA.id, pagoValido())).json();
    const segundo = await registrarPago(casoA.id, pagoValido());
    assert.equal(segundo.status, 200);
    const repetido = await segundo.json();
    assert.equal(repetido.reutilizado, true);
    assert.deepEqual(repetido.pago, primero.pago);

    const sinReferencia = await registrarPago(casoA.id, {
      ...pagoValido(),
      referencia: "   ",
    });
    assert.equal(sinReferencia.status, 200);
    assert.equal((await sinReferencia.json()).reutilizado, true);

    assert.equal((await pagosEnBase(casoA.id)).length, 1);
    assert.equal(await totalCaso(casoA.id), "75.50");
  },
);

test(
  "FE-90: una doble solicitud simultánea guarda un único pago",
  opciones,
  async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => registrarPago(casoA.id, pagoValido())),
    );
    assert.ok(respuestas.every((r) => r.status === 200));
    const cuerpos = await Promise.all(respuestas.map((r) => r.json()));
    assert.equal(cuerpos.filter((c) => !c.reutilizado).length, 1);
    assert.equal(new Set(cuerpos.map((c) => c.pago.id)).size, 1);
    assert.equal(await totalCaso(casoA.id), "75.50");
  },
);

test(
  "FE-90: la misma sesión con otros datos responde 409 y conserva el pago original",
  opciones,
  async () => {
    await registrarPago(casoA.id, pagoValido());
    const distintos = [
      { ...pagoValido(), monto: "80.00" },
      { ...pagoValido(), fecha: "2026-11-13" },
      { ...pagoValido(), metodo: "transferencia" },
      { ...pagoValido(), referencia: "OTRA" },
    ];
    for (const cuerpo of distintos) {
      const res = await registrarPago(casoA.id, cuerpo);
      assert.equal(res.status, 409, `debió dar 409 con ${JSON.stringify(cuerpo)}`);
    }
    assert.deepEqual(
      (await pagosEnBase(casoA.id)).map((p) => p.monto),
      ["75.50"],
    );
  },
);

test(
  "FE-90: montos y datos inválidos responden 400 y no guardan nada",
  opciones,
  async () => {
    const invalidos = [
      { ...pagoValido(), monto: "0" },
      { ...pagoValido(), monto: "0.00" },
      { ...pagoValido(), monto: "-5.00" },
      { ...pagoValido(), monto: "75.555" },
      { ...pagoValido(), monto: "75,50" },
      { ...pagoValido(), monto: "" },
      { ...pagoValido(), monto: "abc" },
      { ...pagoValido(), monto: 75.5 },
      { ...pagoValido(), monto: "100000000.00" },
      { ...pagoValido(), fecha: "2026-02-30" },
      { ...pagoValido(), fecha: "12/11/2026" },
      { ...pagoValido(), metodo: "efectivo" },
      { ...pagoValido(), metodo: "tarjeta" },
      { ...pagoValido(), sesionId: "no-es-uuid" },
      { ...pagoValido(), moneda: "USD" },
      { ...pagoValido(), registradoPor: terapeutaA },
      { ...pagoValido(), referencia: "x".repeat(501) },
      { monto: "75.50", fecha: "2026-11-12", metodo: "qr" },
    ];
    for (const cuerpo of invalidos) {
      const res = await registrarPago(casoA.id, cuerpo);
      assert.equal(
        res.status,
        400,
        `debió rechazar ${JSON.stringify(cuerpo).slice(0, 90)}`,
      );
    }
    assert.equal((await registrarPago("no-es-uuid", pagoValido())).status, 400);
    assert.equal((await pagosEnBase(casoA.id)).length, 0);
  },
);

test(
  "FE-90: los límites válidos del importe se guardan exactos",
  opciones,
  async () => {
    const minimo = await registrarPago(casoA.id, { ...pagoValido(), monto: "0.01" });
    assert.equal(minimo.status, 200);
    assert.equal((await minimo.json()).pago.monto, "0.01");

    const maximo = await registrarPago(casoA.id, {
      ...pagoValido(),
      sesionId: sesionA2.id,
      monto: "99999999.99",
      metodo: "transferencia",
    });
    assert.equal(maximo.status, 200);
    assert.equal((await maximo.json()).pago.monto, "99999999.99");
    assert.equal(await totalCaso(casoA.id), "100000000.00");
  },
);

test(
  "FE-90: no se puede pagar desde A una sesión del caso B ni una sesión inexistente",
  opciones,
  async () => {
    for (const sesionId of [sesionB1.id, randomUUID()]) {
      const res = await registrarPago(casoA.id, { ...pagoValido(), sesionId });
      assert.equal(res.status, 400);
    }
    assert.equal((await pagosEnBase(casoA.id)).length, 0);
    assert.equal((await pagosEnBase(casoB.id)).length, 0);
  },
);

test(
  "FE-90: solo administración registra y consulta pagos",
  opciones,
  async () => {
    await registrarPago(casoA.id, pagoValido());
    for (const token of ["terapeutaA", "terapeutaB", "marketing"]) {
      assert.equal((await listarPagos(casoA.id, token)).status, 403, token);
      assert.equal(
        (await registrarPago(casoA.id, { ...pagoValido(), sesionId: sesionA2.id }, token)).status,
        403,
        token,
      );
    }
    assert.equal((await listarPagos(casoA.id, null)).status, 401);
    assert.equal((await registrarPago(casoA.id, pagoValido(), "token-falso")).status, 401);

    assert.equal((await pagosEnBase(casoA.id)).length, 1);
  },
);

test(
  "FE-90: caso inexistente o eliminado responde 404",
  opciones,
  async () => {
    await registrarPago(casoA.id, pagoValido());
    assert.equal((await listarPagos(randomUUID())).status, 404);
    assert.equal((await registrarPago(randomUUID(), pagoValido())).status, 404);

    await conexion.query("update casos set deleted_at = now() where id = $1", [
      casoA.id,
    ]);
    assert.equal((await listarPagos(casoA.id)).status, 404);
    assert.equal(
      (await registrarPago(casoA.id, { ...pagoValido(), sesionId: sesionA2.id })).status,
      404,
    );
  },
);

test(
  "FE-90: cada caso lista solo sus pagos y los totales concilian con la base y la vista mensual",
  opciones,
  async () => {
    await registrarPago(casoA.id, pagoValido());
    await registrarPago(casoA.id, {
      sesionId: sesionA2.id,
      monto: "120.25",
      fecha: "2026-11-13",
      metodo: "transferencia",
    });
    await registrarPago(casoB.id, {
      sesionId: sesionB1.id,
      monto: "50.00",
      fecha: "2026-11-12",
      metodo: "qr",
    });

    const { pagos } = await (await listarPagos(casoA.id)).json();
    assert.deepEqual(
      pagos.map((p) => [p.fecha, p.monto]),
      [
        ["2026-11-12", "75.50"],
        ["2026-11-13", "120.25"],
      ],
    );
    assert.ok(pagos.every((p) => p.casoId === casoA.id));

    const sumaApi = pagos.reduce((total, p) => total + Math.round(Number(p.monto) * 100), 0);
    assert.equal(sumaApi, 19575);
    assert.equal(await totalCaso(casoA.id), "195.75");

    const vista = (
      await conexion.query(
        "select metodo, cantidad_pagos::int as cantidad, total::text as total from v_ingresos_por_mes where mes = '2026-11-01' order by metodo",
      )
    ).rows;
    assert.deepEqual(vista, [
      { metodo: "qr", cantidad: 2, total: "125.50" },
      { metodo: "transferencia", cantidad: 1, total: "120.25" },
    ]);
  },
);

test(
  "FE-90: si el guardado falla no queda el pago ni su auditoría",
  opciones,
  async () => {
    await conexion.query(`
      create function qa_fallar_pago() returns trigger language plpgsql as
      $$ begin raise exception 'fallo simulado QA'; end; $$;
      create trigger qa_fallo after insert on pagos
        for each row execute function qa_fallar_pago();
    `);
    try {
      assert.equal((await registrarPago(casoA.id, pagoValido())).status, 500);
    } finally {
      await conexion.query(`
        drop trigger qa_fallo on pagos;
        drop function qa_fallar_pago();
      `);
    }
    assert.equal((await pagosEnBase(casoA.id)).length, 0);
    assert.equal(
      (await conexion.query("select count(*)::int as n from auditoria where tabla = 'pagos'")).rows[0].n,
      0,
    );

    const res = await registrarPago(casoA.id, pagoValido());
    assert.equal(res.status, 200);
    assert.equal((await res.json()).reutilizado, false);
  },
);
