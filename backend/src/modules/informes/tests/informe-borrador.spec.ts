import { describe, expect, it, vi } from 'vitest';
import { prepararBorrador } from '../informe-borrador.js';

describe('prepararBorrador', () => {
  it('conserva la versión de la plantilla y los datos usados', () => {
    const origen = { seguimiento: { texto: 'Seguimiento ficticio' } };

    const borrador = prepararBorrador({
      tipo: 'intervencion_sistemica',
      versionPlantilla: 'prueba-v1',
      origen,
      comprobaciones: [{ campo: 'seguimiento', presente: true }],
      generarSecciones: (datos) => [
        { titulo: 'Seguimiento', contenido: datos.seguimiento.texto },
      ],
    });

    origen.seguimiento.texto = 'Dato editado después';

    expect(borrador).toEqual({
      tipo: 'intervencion_sistemica',
      versionPlantilla: 'prueba-v1',
      origen: { seguimiento: { texto: 'Seguimiento ficticio' } },
      secciones: [
        { titulo: 'Seguimiento', contenido: 'Seguimiento ficticio' },
      ],
    });
  });

  it('devuelve 422 antes de ejecutar la plantilla si faltan datos', () => {
    const generarSecciones = vi.fn(() => []);

    expect(() =>
      prepararBorrador({
        tipo: 'judicial',
        versionPlantilla: 'prueba-v1',
        origen: {},
        comprobaciones: [{ campo: 'datoDePrueba', presente: false }],
        generarSecciones,
      }),
    ).toThrow(expect.objectContaining({ status: 422 }));

    expect(generarSecciones).not.toHaveBeenCalled();
  });
});