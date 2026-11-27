import { describe, expect, it } from 'vitest';
import { armarDocumentoExportable } from '../armar-documento-exportable.js';

describe('armarDocumentoExportable', () => {
  const valores = (datos: Record<string, unknown>) =>
    Object.fromEntries(armarDocumentoExportable('historial', datos).filas.map((f) => [f.campo, f.valor]));

  it('muestra nombres y fechas legibles en lugar de códigos de la base', () => {
    const filas = valores({
      caso: { tipo: 'voluntario', estado: 'en_proceso', clasificacion: 'social', fechaIngreso: '2026-03-12' },
      paciente: { nombreCompleto: 'Paciente Ficticio', fechaNacimiento: '2015-01-05' },
      judicial: { fechaDerivacion: '2026-02-01' },
      familia: { integrantes: [{ nombreCompleto: 'Familiar Ficticio', parentesco: 'abuela_materna', fechaReferencia: '2026-03-01', conviveConPaciente: true }] },
      sesiones: [{ nroSesion: 1, fecha: '2026-03-19', tareas: [{ descripcion: 'Tarea', fechaAsignada: '2026-03-19', fechaLimite: '2026-03-26', completada: false }] }],
      pagos: [{ nroSesion: 1, fecha: '2026-03-19', monto: '80.50', moneda: 'BOB', metodo: 'qr' }],
    });

    expect(filas).toMatchObject({
      'Tipo de caso': 'Voluntario',
      Estado: 'En proceso',
      Clasificación: 'Social',
      'Fecha de ingreso': '12/03/2026',
      'Fecha de nacimiento': '05/01/2015',
      'Fecha de derivación': '01/02/2026',
      'Familiar 1 · Parentesco': 'Abuela materna',
      'Familiar 1 · Fecha de referencia': '01/03/2026',
      'Familiar 1 · Convive con el paciente': 'Sí',
      'Sesión 1 · Fecha': '19/03/2026',
      'Sesión 1 · Tarea 1 · Fecha asignada': '19/03/2026',
      'Sesión 1 · Tarea 1 · Fecha límite': '26/03/2026',
      'Sesión 1 · Tarea 1 · Completada': 'No',
      'Pago 1 · Fecha': '19/03/2026',
      'Pago 1 · Monto': '80.50',
      'Pago 1 · Moneda': 'Bs',
      'Pago 1 · Método': 'QR',
    });
  });

  it('deja tal cual un código o una fecha que no reconoce', () => {
    const filas = valores({ caso: { estado: 'archivado', fechaIngreso: '12/03/2026' } });

    expect(filas).toMatchObject({ Estado: 'archivado', 'Fecha de ingreso': '12/03/2026' });
  });
});
