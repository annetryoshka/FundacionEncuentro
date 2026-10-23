// Datos de demostración: cuentas, pacientes, carpetas y asignaciones.
// Son los mismos que usa el modo simulado del frontend (mismos correos, contraseña e ids).
//   npm run datos:demo           crea lo que falte (se puede repetir)
//   npm run datos:demo:borrar    borra solo lo que crea este script
import pg from 'pg';

const CONTRASENA = 'Encuentro2026';
const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan DATABASE_URL, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en backend/.env');
  process.exit(1);
}

const CUENTAS = [
  { clave: 'direccion', nombre: 'Laura Quiroga', email: 'direccion@fundacion.test', rol: 'administrador' },
  { clave: 'sofia', nombre: 'Sofía Mamani', email: 'terapeuta1@fundacion.test', rol: 'terapeuta' },
  { clave: 'carla', nombre: 'Carla Rojas', email: 'terapeuta2@fundacion.test', rol: 'terapeuta' },
  { clave: 'elena', nombre: 'Elena Choque', email: 'inactiva@fundacion.test', rol: 'terapeuta', activo: false },
  { clave: 'diego', nombre: 'Diego Flores', email: 'apoyo@fundacion.test', rol: 'marketing' },
];

// [nombre, tipo, estado, fecha de ingreso, terapeuta, fecha de nacimiento, teléfono]
const PACIENTES = [
  ['Mariana Gutiérrez Paz', 'voluntario', 'en_proceso', '2026-03-12', 'sofia', '1994-07-21', '71234567'],
  ['Familia Condori Apaza', 'derivado', 'en_proceso', '2026-04-02', 'sofia', null, '72345678'],
  ['Javier Tórrez Villca', 'voluntario', 'concluido', '2026-04-20', 'carla', '1988-02-03', '73456789'],
  ['Lucía Fernández Roca', 'voluntario', 'iniciado', '2026-05-08', null, '2009-11-30', '74567890'],
  ['Andrés Mamani Quispe', 'derivado', 'en_proceso', '2026-05-15', 'carla', '2012-05-14', '75678901'],
  ['Valeria Ríos Céspedes', 'voluntario', 'en_proceso', '2026-06-01', 'sofia', '1999-09-09', '76789012'],
  ['Familia Huanca Limachi', 'derivado', 'iniciado', '2026-06-19', 'carla', null, '77890123'],
  ['Gabriel Ortiz Salazar', 'voluntario', 'concluido', '2026-07-03', 'sofia', '1979-12-01', '78901234'],
  ['Camila Vargas Aliaga', 'voluntario', 'en_proceso', '2026-07-22', null, '2004-03-17', '79012345'],
  ['Mateo Chávez Ticona', 'derivado', 'iniciado', '2026-08-10', 'sofia', '2014-08-25', '60123456'],
  ['Daniela Rojas Paredes', 'voluntario', 'iniciado', '2026-08-28', 'carla', '1991-06-06', '61234567'],
  ['Familia Nina Calle', 'voluntario', 'en_proceso', '2026-09-09', null, null, '62345678'],
  ['Sebastián López Arce', 'derivado', 'iniciado', '2026-09-25', null, '2010-01-19', '63456789'],
  ['Paola Gutiérrez Mendoza', 'voluntario', 'iniciado', '2026-10-05', 'carla', '1985-10-28', '64567890'],
];
// Segunda carpeta de un paciente que ya existe (FE-33): Mariana vuelve al centro.
const SEGUNDAS = [{ paciente: 1, tipo: 'voluntario', estado: 'iniciado', fecha: '2026-10-15', terapeuta: 'sofia' }];

const idCaso = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const idPaciente = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const casos = [
  ...PACIENTES.map(([, tipo, estado, fecha, terapeuta], i) => ({ id: idCaso(i + 1), paciente: idPaciente(i + 1), tipo, estado, fecha, terapeuta })),
  ...SEGUNDAS.map((s, i) => ({ id: idCaso(PACIENTES.length + i + 1), ...s, paciente: idPaciente(s.paciente) })),
];

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: /@(localhost|127\.0\.0\.1)/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
});

async function auth(ruta, metodo, cuerpo) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users${ruta}`, {
    method: metodo,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Supabase Auth ${metodo} ${ruta}: ${res.status} ${datos.msg ?? datos.error_code ?? ''}`);
  return datos;
}

async function idPorCorreo(email) {
  const { rows } = await pool.query('select id from auth.users where lower(email) = lower($1)', [email]);
  return rows[0]?.id;
}

async function crearCuentas() {
  const ids = {};
  for (const c of CUENTAS) {
    let id = await idPorCorreo(c.email);
    if (id) {
      await auth(`/${id}`, 'PUT', { password: CONTRASENA });
    } else {
      id = (await auth('', 'POST', { email: c.email, password: CONTRASENA, email_confirm: true })).id;
    }
    await pool.query(
      `insert into perfiles (id, nombre_completo, rol, activo) values ($1, $2, $3, $4)
       on conflict (id) do update set nombre_completo = $2, rol = $3, activo = $4`,
      [id, c.nombre, c.rol, c.activo ?? true],
    );
    ids[c.clave] = id;
  }
  return ids;
}

async function crearCarpetas(cuentas) {
  const cliente = await pool.connect();
  const resumen = { pacientes: 0, carpetas: 0, asignaciones: 0 };
  try {
    await cliente.query('begin');
    await cliente.query(`select set_config('app.usuario_id', $1, true)`, [cuentas.direccion]);
    for (const [i, [nombre, , , fecha, , nacimiento, telefono]] of PACIENTES.entries()) {
      const r = await cliente.query(
        `insert into pacientes (id, nombre_completo, fecha_nacimiento, edad_al_ingreso, telefono, creado_por, creado_en)
         values ($1, $2, $3::date, date_part('year', age($4::date, $3::date))::int, $5, $6, $4::date + time '10:00')
         on conflict (id) do nothing`,
        [idPaciente(i + 1), nombre, nacimiento, fecha, telefono, cuentas.direccion],
      );
      resumen.pacientes += r.rowCount;
    }
    for (const c of casos) {
      // El número correlativo lo pone el trigger de la base; se inserta solo si no existe para no gastar números.
      const r = await cliente.query(
        `insert into casos (id, paciente_id, tipo, estado, fecha_ingreso, creado_por, creado_en)
         select $1, $2, $3, $4, $5::date, $6, $5::date + time '10:00'
          where not exists (select 1 from casos where id = $1)`,
        [c.id, c.paciente, c.tipo, c.estado, c.fecha, cuentas.direccion],
      );
      resumen.carpetas += r.rowCount;
      if (c.tipo === 'derivado') {
        await cliente.query(
          `insert into contexto_judicial (caso_id, juzgado, nro_expediente, fecha_derivacion, observaciones)
           select $1, 'Juzgado Público de Familia N.º 3 de La Paz', $2, $3::date - 7, 'Derivación para terapia familiar.'
            where not exists (select 1 from contexto_judicial where caso_id = $1)`,
          [c.id, `FAM-2026-${c.id.slice(-3)}`, c.fecha],
        );
      }
      if (c.terapeuta) {
        const a = await cliente.query(
          `insert into asignaciones_caso (caso_id, perfil_id, asignado_por, asignado_en)
           select $1, $2, $3, $4::date + time '11:00'
            where not exists (select 1 from asignaciones_caso where caso_id = $1)`,
          [c.id, cuentas[c.terapeuta], cuentas.direccion, c.fecha],
        );
        resumen.asignaciones += a.rowCount;
      }
    }
    await cliente.query('commit');
  } catch (error) {
    await cliente.query('rollback');
    throw error;
  } finally {
    cliente.release();
  }
  return resumen;
}

async function borrar() {
  const idsCasos = casos.map((c) => c.id);
  const idsPacientes = PACIENTES.map((_, i) => idPaciente(i + 1));
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await cliente.query('delete from asignaciones_caso where caso_id = any($1)', [idsCasos]);
    await cliente.query('delete from contexto_judicial where caso_id = any($1)', [idsCasos]);
    const c = await cliente.query('delete from casos where id = any($1)', [idsCasos]);
    const p = await cliente.query('delete from pacientes where id = any($1)', [idsPacientes]);
    // El contador queda en el número más alto que sigue en uso.
    await cliente.query(
      `update contadores_caso k
          set ultimo_numero = coalesce((select max(numero_correlativo) from casos where tipo = k.tipo), 0)`,
    );
    await cliente.query('commit');
    console.log(`Borradas ${c.rowCount} carpetas y ${p.rowCount} pacientes.`);
  } catch (error) {
    await cliente.query('rollback');
    throw error;
  } finally {
    cliente.release();
  }
  for (const cuenta of CUENTAS) {
    const id = await idPorCorreo(cuenta.email);
    if (!id) continue;
    try {
      await pool.query('delete from perfiles where id = $1', [id]);
      await auth(`/${id}`, 'DELETE');
      console.log(`Borrada la cuenta ${cuenta.email}.`);
    } catch {
      await pool.query('update perfiles set activo = false where id = $1', [id]);
      console.log(`${cuenta.email} tiene registros a su nombre: se desactivó en lugar de borrarla.`);
    }
  }
}

try {
  if (process.argv.includes('--borrar')) {
    await borrar();
  } else {
    const cuentas = await crearCuentas();
    const r = await crearCarpetas(cuentas);
    console.log(`Cuentas listas (contraseña ${CONTRASENA}): ${CUENTAS.map((c) => c.email).join(', ')}`);
    console.log(`Nuevos: ${r.pacientes} pacientes, ${r.carpetas} carpetas, ${r.asignaciones} asignaciones.`);
  }
} finally {
  await pool.end();
}
