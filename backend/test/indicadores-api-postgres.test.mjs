import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { before, beforeEach, after, test } from "node:test";
import pg from "pg";
import { Global, Module, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AuthModule } from "../dist/modules/auth/auth.module.js";
import { IndicadoresModule } from "../dist/modules/indicadores/indicadores.module.js";
import { DatabaseService } from "../dist/database/database.service.js";

const habilitada =
  process.env.FE40_PG_QA === "1" && Boolean(process.env.FE40_PG_ADMIN_URL);
const opciones = {
  skip: habilitada
    ? false
    : "Requiere PostgreSQL QA local opt-in FE40_PG_QA y FE40_PG_ADMIN_URL",
  timeout: 25000,
};
const nombre = `fe95_run_${randomUUID().replaceAll("-", "")}`;
const administrador = "00000000-0000-4000-8000-000000000001";
const terapeutaA = "00000000-0000-4000-8000-000000000002";
const terapeutaB = "00000000-0000-4000-8000-000000000003";
const marketing = "00000000-0000-4000-8000-000000000004";
let admin,
  conexion,
  app,
  base,
  db,
  fetchOriginal,
  creada = false;
let casos, sesiones;

async function levantarApi(dbService) {
  const usuariosPorToken = {
    fixture: administrador,
    terapeutaA,
    terapeutaB,
    marketing,
  };
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (new URL(url).hostname === "127.0.0.1") return fetchOriginal(url, init);
    if (String(url) === "https://auth.invalid/auth/v1/user") {
      const token = init.headers.Authorization?.replace(/^Bearer /, "");
      const id = Object.hasOwn(usuariosPorToken, token)
        ? usuariosPorToken[token]
        : undefined;
      return Response.json(id ? { id } : {}, { status: id ? 200 : 401 });
    }
    throw new Error("Salida externa no permitida en prueba");
  };
  class Infraestructura {}
  Global()(Infraestructura);
  Module({
    providers: [
      { provide: DatabaseService, useValue: dbService },
      {
        provide: ConfigService,
        useValue: {
          getOrThrow: (clave) =>
            ({
              SUPABASE_URL: "https://auth.invalid",
              SUPABASE_ANON_KEY: "ficticia",
            })[clave],
        },
      },
    ],
    exports: [DatabaseService, ConfigService],
  })(Infraestructura);
  class Aplicacion {}
  Module({ imports: [Infraestructura, AuthModule, IndicadoresModule] })(
    Aplicacion,
  );
  app = await NestFactory.create(Aplicacion, { logger: false });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
}

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
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${nombre}"`);
    creada = true;
    url.pathname = `/${nombre}`;
    conexion = new pg.Client({
      connectionString: url.toString(),
      connectionTimeoutMillis: 10000,
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
      [administrador, "administrador", "Admin QA"],
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
    await levantarApi(db);
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
  await cargarDatosFE91();
});

after(async () => {
  if (!habilitada) return;
  try {
    if (app) await app.close();
    else if (db) await db.onModuleDestroy();
  } finally {
    if (fetchOriginal) globalThis.fetch = fetchOriginal;
    try {
      await conexion?.end();
    } finally {
      try {
        if (creada) {
          assert.match(nombre, /^fe95_run_[a-f0-9]{32}$/);
          await admin.query(`DROP DATABASE "${nombre}" WITH (FORCE)`);
        }
      } finally {
        await admin?.end();
      }
    }
  }
});

async function comoAdmin(fn) {
  await conexion.query("begin");
  try {
    await conexion.query("select set_config('app.usuario_id', $1, true)", [
      administrador,
    ]);
    const resultado = await fn();
    await conexion.query("commit");
    return resultado;
  } catch (error) {
    await conexion.query("rollback");
    throw error;
  }
}

async function crearCaso(paciente, estado, terapeuta) {
  return comoAdmin(async () => {
    const p = await conexion.query(
      "insert into pacientes (nombre_completo) values ($1) returning id",
      [paciente],
    );
    const c = await conexion.query(
      `insert into casos (paciente_id, tipo, estado, fecha_ingreso)
       values ($1, 'voluntario', $2, '2026-10-01') returning id`,
      [p.rows[0].id, estado],
    );
    await conexion.query(
      "insert into asignaciones_caso (caso_id, perfil_id, asignado_por) values ($1, $2, $3)",
      [c.rows[0].id, terapeuta, administrador],
    );
    return { id: c.rows[0].id, pacienteId: p.rows[0].id };
  });
}

async function crearSesion(caso, fecha, responsable) {
  return comoAdmin(async () => {
    const { rows } = await conexion.query(
      `insert into fichas_seguimiento (caso_id, fecha, evolucion, responsable_id, creado_por)
       values ($1, $2, 'Evolución ficticia QA', $3, $4) returning id`,
      [caso.id, fecha, responsable, administrador],
    );
    return { id: rows[0].id, caso };
  });
}

async function crearPago(sesion, fecha, monto, moneda = "BOB") {
  await comoAdmin(() =>
    conexion.query(
      `insert into pagos (caso_id, sesion_id, fecha, monto, moneda, metodo, registrado_por)
       values ($1, $2, $3, $4, $5, 'qr', $6)`,
      [sesion.caso.id, sesion.id, fecha, monto, moneda, administrador],
    ),
  );
}

async function cargarDatosFE91() {
  casos = {
    A: await crearCaso("Ana Ficticia QA", "iniciado", terapeutaA),
    B: await crearCaso("Beto Ficticio QA", "en_proceso", terapeutaB),
    C: await crearCaso("Carla Ficticia QA", "concluido", terapeutaA),
    D: await crearCaso("Dante Ficticio QA", "iniciado", terapeutaA),
  };
  sesiones = {
    A1: await crearSesion(casos.A, "2026-10-12", terapeutaA),
    A2: await crearSesion(casos.A, "2026-10-12", terapeutaA),
    B1: await crearSesion(casos.B, "2026-10-19", terapeutaB),
    C1: await crearSesion(casos.C, "2026-10-11", terapeutaA),
    D1: await crearSesion(casos.D, "2026-10-20", terapeutaA),
  };
  await crearPago(sesiones.A1, "2026-10-12", "75.50");
  await crearPago(sesiones.A2, "2026-10-20", "40.25");
  await crearPago(sesiones.B1, "2026-10-19", "125.00");
  await crearPago(sesiones.C1, "2026-10-15", "25.10");
}

const consultar = (parametros, token = "fixture") =>
  fetch(`${base}/api/indicadores?${new URLSearchParams(parametros)}`, {
    headers: token === null ? {} : { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });

async function indicadores(desde, hasta) {
  const res = await consultar({ desde, hasta });
  assert.equal(res.status, 200, `${desde}..${hasta}`);
  return res.json();
}

const resumen = (r) => ({
  casos: r.casosActuales,
  estados: [
    r.casosPorEstado.iniciado,
    r.casosPorEstado.en_proceso,
    r.casosPorEstado.concluido,
  ],
  sesiones: r.sesiones,
  pagos: Number(r.pagosRecibidos.monto),
});

test(
  "FE-95: el período 12–19 de octubre coincide con la conciliación manual de FE-91",
  opciones,
  async () => {
    const r = await indicadores("2026-10-12", "2026-10-19");
    assert.deepEqual(r, {
      periodo: { desde: "2026-10-12", hasta: "2026-10-19" },
      casosActuales: 4,
      casosPorEstado: { iniciado: 2, en_proceso: 1, concluido: 1 },
      sesiones: 3,
      pagosRecibidos: { monto: "225.60", moneda: "BOB" },
    });
  },
);

test(
  "FE-95: el período 1–5 de octubre no tiene movimientos y conserva los casos actuales",
  opciones,
  async () => {
    const r = await indicadores("2026-10-01", "2026-10-05");
    assert.deepEqual(resumen(r), {
      casos: 4,
      estados: [2, 1, 1],
      sesiones: 0,
      pagos: 0,
    });
  },
);

test(
  "FE-95: el total sin pagos se informa como 0.00, con el mismo formato que los demás montos",
  { ...opciones, todo: opciones.skip ? undefined : "Defecto FE-95-D1: el total vacío llega como \"0\"" },
  async () => {
    const r = await indicadores("2026-10-01", "2026-10-05");
    assert.equal(r.pagosRecibidos.monto, "0.00");
  },
);

test(
  "FE-95: los extremos del período se incluyen y el día anterior o posterior no",
  opciones,
  async () => {
    const dia20 = resumen(await indicadores("2026-10-20", "2026-10-20"));
    assert.equal(dia20.sesiones, 1);
    assert.equal(dia20.pagos, 40.25);

    const dia11 = resumen(await indicadores("2026-10-11", "2026-10-11"));
    assert.equal(dia11.sesiones, 1);
    assert.equal(dia11.pagos, 0);

    const sinBordes = resumen(await indicadores("2026-10-13", "2026-10-18"));
    assert.equal(sinBordes.sesiones, 0);
    assert.equal(sinBordes.pagos, 25.1);

    const conBordes = resumen(await indicadores("2026-10-11", "2026-10-20"));
    assert.equal(conBordes.sesiones, 5);
    assert.equal(conBordes.pagos, 265.85);
  },
);

test(
  "FE-95: sesiones y pagos se cuentan por su propia fecha al cruzar de mes",
  opciones,
  async () => {
    const sesionFinDeMes = await crearSesion(casos.D, "2026-10-31", terapeutaA);
    await crearPago(sesionFinDeMes, "2026-11-01", "60.00");

    const octubre = resumen(await indicadores("2026-10-01", "2026-10-31"));
    assert.equal(octubre.sesiones, 6);
    assert.equal(octubre.pagos, 265.85);

    const noviembre = resumen(await indicadores("2026-11-01", "2026-11-30"));
    assert.equal(noviembre.sesiones, 0);
    assert.equal(noviembre.pagos, 60);

    const cruce = resumen(await indicadores("2026-10-31", "2026-11-01"));
    assert.equal(cruce.sesiones, 1);
    assert.equal(cruce.pagos, 60);
  },
);

test(
  "FE-95: agregar dos tareas a S-A1 no multiplica sesiones ni pagos",
  opciones,
  async () => {
    for (const descripcion of ["Tarea QA 1", "Tarea QA 2"]) {
      await comoAdmin(() =>
        conexion.query(
          "insert into tareas_terapeuticas (caso_id, sesion_id, descripcion, perfil_id) values ($1, $2, $3, $4)",
          [casos.A.id, sesiones.A1.id, descripcion, terapeutaA],
        ),
      );
    }
    const r = await indicadores("2026-10-12", "2026-10-19");
    assert.equal(r.sesiones, 3);
    assert.equal(r.pagosRecibidos.monto, "225.60");
  },
);

test(
  "FE-95: casos o pacientes eliminados dejan de contar en casos, sesiones y pagos",
  opciones,
  async () => {
    await conexion.query("update casos set deleted_at = now() where id = $1", [
      casos.C.id,
    ]);
    let r = await indicadores("2026-10-11", "2026-10-19");
    assert.deepEqual(resumen(r), {
      casos: 3,
      estados: [2, 1, 0],
      sesiones: 3,
      pagos: 200.5,
    });

    await conexion.query("update pacientes set deleted_at = now() where id = $1", [
      casos.B.pacienteId,
    ]);
    r = await indicadores("2026-10-11", "2026-10-19");
    assert.deepEqual(resumen(r), {
      casos: 2,
      estados: [2, 0, 0],
      sesiones: 2,
      pagos: 75.5,
    });
  },
);

test(
  "FE-95: el total coincide con la suma manual de pagos en BOB y no mezcla otra moneda",
  opciones,
  async () => {
    const sesionExtra = await crearSesion(casos.B, "2026-10-19", terapeutaB);
    await crearPago(sesionExtra, "2026-10-19", "999.99", "USD");

    const r = await indicadores("2000-01-01", "2100-12-31");
    const manual = (
      await conexion.query(
        `select sum(g.monto)::text as total, count(*)::int as n
           from pagos g join casos c on c.id = g.caso_id
          where g.moneda = 'BOB' and c.deleted_at is null`,
      )
    ).rows[0];
    assert.equal(manual.n, 4);
    assert.equal(r.pagosRecibidos.monto, manual.total);
    assert.equal(r.pagosRecibidos.monto, "265.85");
    assert.equal(r.sesiones, 6);
  },
);

test(
  "FE-95: fechas inválidas, faltantes o invertidas responden 400",
  opciones,
  async () => {
    const invalidos = [
      { desde: "2026-10-19", hasta: "2026-10-12" },
      { desde: "2026-02-30", hasta: "2026-03-01" },
      { desde: "2026-02-29", hasta: "2026-03-01" },
      { desde: "2026-10-1", hasta: "2026-10-19" },
      { desde: "12/10/2026", hasta: "2026-10-19" },
      { desde: "", hasta: "2026-10-19" },
      { hasta: "2026-10-19" },
      { desde: "2026-10-12" },
      {},
      { desde: "2026-10-12", hasta: "2026-10-19", estado: "iniciado" },
    ];
    for (const parametros of invalidos) {
      const res = await consultar(parametros);
      assert.equal(res.status, 400, `debió rechazar ${JSON.stringify(parametros)}`);
    }

    assert.equal((await consultar({ desde: "2026-10-12", hasta: "2026-10-12" })).status, 200);
    assert.equal((await consultar({ desde: "2028-02-29", hasta: "2028-02-29" })).status, 200);
  },
);

test(
  "FE-95: solo administración consulta los indicadores",
  opciones,
  async () => {
    const periodo = { desde: "2026-10-12", hasta: "2026-10-19" };
    for (const token of ["terapeutaA", "terapeutaB", "marketing"]) {
      const res = await consultar(periodo, token);
      assert.equal(res.status, 403, token);
      assert.ok(!(await res.text()).includes("225.60"), `${token} recibió montos`);
    }
    assert.equal((await consultar(periodo, null)).status, 401);
    assert.equal((await consultar(periodo, "token-falso")).status, 401);
  },
);

test(
  "FE-95: si la consulta falla se informa un error y la siguiente consulta funciona",
  opciones,
  async () => {
    await conexion.query(
      "alter function indicadores_operativos(date, date) rename to qa_indicadores_ocultos",
    );
    try {
      const res = await consultar({ desde: "2026-10-12", hasta: "2026-10-19" });
      assert.equal(res.status, 500);
      assert.ok(!(await res.text()).includes("qa_indicadores_ocultos"));
    } finally {
      await conexion.query(
        "alter function qa_indicadores_ocultos(date, date) rename to indicadores_operativos",
      );
    }
    const r = await indicadores("2026-10-12", "2026-10-19");
    assert.equal(r.pagosRecibidos.monto, "225.60");
  },
);
