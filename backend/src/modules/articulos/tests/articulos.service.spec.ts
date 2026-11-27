import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../../../database/database.service.js';
import type { ImagenesPublicasService } from '../../imagenes-publicas/imagenes-publicas.service.js';
import { ArticulosService } from '../articulos.service.js';
import { GuardarArticuloDto } from '../dto/articulo.dto.js';

const usuario = 'a7d176ae-e95a-4f4d-8506-f33201d57016';
const id = '6d55de91-8124-4089-a1d1-b6694d47acfd';
const articulo = { titulo: '  Título QA  ', resumen: '  Resumen QA ', contenido: ' Contenido QA ', autorVisible: '  ' };
const errorPg = (code: string) => Object.assign(new Error('pg'), { code });

describe('FE-184: servicio de artículos', () => {
  const query = vi.fn();
  const transaction = vi.fn();
  let servicio: ArticulosService;

  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation((_u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query }));
    servicio = new ArticulosService(
      { query, transaction } as unknown as DatabaseService,
      { guardar: vi.fn(), leer: vi.fn() } as unknown as ImagenesPublicasService,
    );
  });

  it('crea con textos recortados y autor en blanco como null; la imagen no va en el formulario', async () => {
    query.mockResolvedValueOnce({ rows: [{ id }] }).mockResolvedValueOnce({ rows: [{ id, imagen: null }] });
    await expect(servicio.crear(usuario, articulo)).resolves.toEqual({ id, imagen: null });
    expect(transaction).toHaveBeenCalledWith(usuario, expect.any(Function));
    expect(query.mock.calls[0][1]).toEqual(['Título QA', 'Resumen QA', 'Contenido QA', null]);
    expect(query.mock.calls[0][0]).not.toMatch(/imagen/);
  });

  it('editar no toca la imagen', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ estado: 'borrador' }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id }] });
    await servicio.editar(usuario, id, articulo);
    expect(query.mock.calls[1][0]).not.toMatch(/imagen/);
  });

  it('quitar la imagen de un artículo sin imagen da 404', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 });
    await expect(servicio.quitarImagen(usuario, id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('la vista previa de un artículo sin imagen da 404', async () => {
    query.mockResolvedValueOnce({ rows: [{ imagenId: null }] });
    await expect(servicio.archivoImagen(id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['borrador', 'publicado', true],
    ['publicado', 'retirado', true],
    ['retirado', 'borrador', true],
    ['borrador', 'retirado', false],
    ['publicado', 'borrador', false],
    ['retirado', 'publicado', false],
    ['publicado', 'publicado', false],
  ])('de %s a %s: permitido=%s', async (actual, nuevo, permitido) => {
    query
      .mockResolvedValueOnce({ rows: [{ estado: actual, resumen: 'R' }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id, estado: nuevo }] });
    const promesa = servicio.cambiarEstado(usuario, id, nuevo as 'publicado');
    if (permitido) await expect(promesa).resolves.toMatchObject({ estado: nuevo });
    else await expect(promesa).rejects.toBeInstanceOf(ConflictException);
  });

  it('publicar sin resumen da 422 con camposFaltantes y no actualiza', async () => {
    query.mockResolvedValueOnce({ rows: [{ estado: 'borrador', resumen: '  ' }] });
    const error = await servicio.cambiarEstado(usuario, id, 'publicado').catch((e) => e);
    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(error.getResponse()).toMatchObject({ camposFaltantes: ['resumen'] });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('editar un publicado quitándole el resumen da 422', async () => {
    query.mockResolvedValueOnce({ rows: [{ estado: 'publicado' }] });
    await expect(servicio.editar(usuario, id, { ...articulo, resumen: null })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('eliminar: inexistente 404, publicado alguna vez 409, nunca publicado se borra', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(servicio.eliminar(usuario, id)).rejects.toBeInstanceOf(NotFoundException);
    query.mockResolvedValueOnce({ rows: [{ publicado: true }] });
    await expect(servicio.eliminar(usuario, id)).rejects.toBeInstanceOf(ConflictException);
    query.mockResolvedValueOnce({ rows: [{ publicado: false }] }).mockResolvedValueOnce({ rows: [] });
    await servicio.eliminar(usuario, id);
    expect(query.mock.calls.at(-1)![0]).toMatch(/^delete from public\.publicaciones_foro/);
  });

  it('la lectura pública usa solo la vista de publicados y no pide transacción', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '1' }] }).mockResolvedValueOnce({ rows: [{ id }] });
    const r = await servicio.listarPublicados({ pagina: 2, tamano: 5 });
    expect(r).toEqual({ investigaciones: [{ id }], total: 1, pagina: 2, tamano: 5 });
    expect(query.mock.calls.every(([sql]) => /v_investigaciones_publicas/.test(sql))).toBe(true);
    expect(query.mock.calls[1][1]).toEqual([5, 5]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('un publicado inexistente da 404', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(servicio.obtenerPublicado(id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['42501', ForbiddenException],
    ['23514', BadRequestException],
    ['23502', BadRequestException],
  ])('traduce %s', async (codigo, clase) => {
    transaction.mockRejectedValueOnce(errorPg(codigo));
    await expect(servicio.crear(usuario, articulo)).rejects.toBeInstanceOf(clase);
  });
});

describe('FE-184: validación del artículo', () => {
  const errores = async (cuerpo: Record<string, unknown>) =>
    (await validate(plainToInstance(GuardarArticuloDto, cuerpo), { whitelist: true, forbidNonWhitelisted: true })).map(
      (e) => e.property,
    );
  const valido = { titulo: '[DEMO QA] Artículo', resumen: 'Resumen', contenido: 'Texto' };

  it('acepta el ejemplo de FE-185', async () => {
    expect(await errores({ ...valido, autorVisible: 'Autor ficticio' })).toEqual([]);
  });

  it.each([
    ['título vacío', { titulo: '   ' }, 'titulo'],
    ['título de 151', { titulo: 'x'.repeat(151) }, 'titulo'],
    ['resumen de 501', { resumen: 'x'.repeat(501) }, 'resumen'],
    ['contenido vacío', { contenido: ' ' }, 'contenido'],
    ['contenido de 20001', { contenido: 'x'.repeat(20001) }, 'contenido'],
    ['autor de 151', { autorVisible: 'x'.repeat(151) }, 'autorVisible'],
    ['una ruta de imagen (la imagen se sube aparte)', { imagen: { ruta: 'a.png', textoAlternativo: 'a' } }, 'imagen'],
  ])('rechaza %s', async (_n, cambio, propiedad) => {
    expect(await errores({ ...valido, ...cambio })).toContain(propiedad);
  });
});
