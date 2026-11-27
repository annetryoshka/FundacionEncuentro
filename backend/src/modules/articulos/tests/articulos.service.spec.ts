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
    servicio = new ArticulosService({ query, transaction } as unknown as DatabaseService);
  });

  it('crea con textos recortados, autor en blanco como null y sin imagen', async () => {
    query.mockResolvedValueOnce({ rows: [{ id }] });
    await servicio.crear(usuario, articulo);
    expect(transaction).toHaveBeenCalledWith(usuario, expect.any(Function));
    expect(query.mock.calls[0][1]).toEqual(['Título QA', 'Resumen QA', 'Contenido QA', null, null, null, null, null]);
  });

  it('crea con imagen y su texto alternativo', async () => {
    query.mockResolvedValueOnce({ rows: [{ id }] });
    await servicio.crear(usuario, { ...articulo, imagen: { ruta: 'inv/a.png', textoAlternativo: ' Portada ', ancho: 800 } });
    expect(query.mock.calls[0][1].slice(4)).toEqual(['inv/a.png', 'Portada', 800, null]);
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
    query.mockResolvedValueOnce({ rows: [{ estado: actual, resumen: 'R' }] }).mockResolvedValueOnce({ rows: [{ id, estado: nuevo }] });
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
    (await validate(plainToInstance(GuardarArticuloDto, cuerpo))).map((e) => e.property);
  const valido = { titulo: '[DEMO QA] Artículo', resumen: 'Resumen', contenido: 'Texto' };

  it('acepta el ejemplo de FE-185', async () => {
    expect(await errores({ ...valido, autorVisible: 'Autor ficticio', imagen: null })).toEqual([]);
  });

  it.each([
    ['título vacío', { titulo: '   ' }, 'titulo'],
    ['título de 151', { titulo: 'x'.repeat(151) }, 'titulo'],
    ['resumen de 501', { resumen: 'x'.repeat(501) }, 'resumen'],
    ['contenido vacío', { contenido: ' ' }, 'contenido'],
    ['contenido de 20001', { contenido: 'x'.repeat(20001) }, 'contenido'],
    ['autor de 151', { autorVisible: 'x'.repeat(151) }, 'autorVisible'],
    ['imagen con ..', { imagen: { ruta: '../clinico/x.png', textoAlternativo: 'a' } }, 'imagen'],
    ['imagen con protocolo', { imagen: { ruta: 'https://otro.test/x.png', textoAlternativo: 'a' } }, 'imagen'],
    ['imagen sin texto alternativo', { imagen: { ruta: 'a.png', textoAlternativo: '  ' } }, 'imagen'],
  ])('rechaza %s', async (_n, cambio, propiedad) => {
    expect(await errores({ ...valido, ...cambio })).toContain(propiedad);
  });
});
