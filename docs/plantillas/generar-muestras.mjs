// Genera las muestras ficticias de docs/plantillas/muestras (FE-157).
// Uso, desde la raíz del repositorio:  cd backend && npm run build && node ../docs/plantillas/generar-muestras.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { armarDocumentoExportable } from '../../backend/dist/modules/exportaciones/armar-documento-exportable.js';
import { generarDocx } from '../../backend/dist/modules/exportaciones/generar-docx.js';
import { generarPdf } from '../../backend/dist/modules/exportaciones/generar-pdf.js';

const destino = new URL('./muestras/', import.meta.url);
const relleno = (n) => Array.from({ length: n }, () => 'Texto ficticio para revisar la presentación en varias líneas.').join(' ');

// Todos los datos son inventados: no corresponden a ninguna persona.
const ficha = armarDocumentoExportable('historial', {
  caso: { numeroCorrelativo: 101, tipo: 'voluntario', estado: 'en_proceso', clasificacion: 'social', fechaIngreso: '2026-10-10' },
  paciente: { nombreCompleto: 'Persona Ficticia de Prueba', edadAlIngreso: 30 },
  responsable: { nombreCompleto: 'Terapeuta Ficticia' },
  diagnostico: { evaluacionInicial: relleno(3), comentariosClinicos: 'Primera línea ficticia.\nSegunda línea ficticia.' },
  familia: { integrantes: [{ nombreCompleto: 'Familiar Ficticio', parentesco: 'otro', ocupacion: 'Ocupación de prueba' }] },
  sesiones: Array.from({ length: 12 }, (_, i) => ({
    nroSesion: i + 1,
    fecha: `2026-11-${String(i + 1).padStart(2, '0')}`,
    evolucion: relleno(i === 5 ? 90 : 2),
    tareas: [{ descripcion: 'Actividad ficticia', fechaAsignada: '2026-11-01', completada: i % 2 === 0 }],
  })),
});

const informe = {
  titulo: 'Informe revisado',
  parrafos: ['Antecedentes', relleno(6), 'Proceso', relleno(10), 'Conclusiones del texto de prueba', relleno(4)],
  filas: [{ campo: 'Versión revisada', valor: '1' }],
};

await mkdir(destino, { recursive: true });
for (const [nombre, datos] of [['historial-ficticio', ficha], ['informe-ficticio', informe]]) {
  await writeFile(new URL(`${nombre}.pdf`, destino), await generarPdf(datos));
  await writeFile(new URL(`${nombre}.docx`, destino), await generarDocx(datos));
  console.log(`generado: ${nombre} (${datos.filas.length} filas)`);
}
