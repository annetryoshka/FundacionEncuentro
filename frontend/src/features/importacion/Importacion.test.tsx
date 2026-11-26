import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fallarUnaVez, llamadas, montarApp } from '../../test/montarApp'
import { COLUMNAS, filaPendiente, plantillaCsv, validarArchivoImportacion } from './importacion'

/**
 * FE-165 · Asistente de importación histórica (FE-162/FE-163, API FE-164) con lotes como los de
 * db/importacion/muestras. Datos ficticios. La carpeta voluntaria Nº 1 de la simulación es Mariana Gutiérrez Paz.
 */
const ENCABEZADO = COLUMNAS.join(',')
const fila = (v: Partial<Record<(typeof COLUMNAS)[number], string>>) => COLUMNAS.map((c) => v[c] ?? '').join(',')
const csv = (...filas: string[]) =>
  new File([[ENCABEZADO, ...filas].join('\n') + '\n'], 'lote-qa.csv', { type: 'text/csv' })

const VALIDA = fila({
  referenciaOrigen: 'V-1',
  nombreCompleto: 'QA Rosa Quispe',
  tipo: 'voluntario',
  fechaIngreso: '2018-03-12',
  estado: 'concluido',
})
const SIN_NOMBRE = fila({ referenciaOrigen: 'E-1', tipo: 'voluntario', fechaIngreso: '2018-03-12' })
const MISMO_NUMERO = fila({
  referenciaOrigen: 'D-1',
  nombreCompleto: 'QA Otra Persona',
  tipo: 'voluntario',
  numeroCorrelativo: '1',
  fechaIngreso: '2017-01-10',
})
const CON_SALTO = fila({
  referenciaOrigen: 'S-1',
  nombreCompleto: 'QA Pedro Mamani',
  tipo: 'derivado',
  numeroCorrelativo: '40',
  fechaIngreso: '2019-07-01',
})

describe('Importación histórica', () => {
  const subir = async (usuario: Awaited<ReturnType<typeof montarApp>>['usuario'], archivo: File) => {
    await usuario.upload(screen.getByLabelText('Planilla de importación'), archivo)
    await usuario.click(screen.getByRole('button', { name: 'Subir y revisar' }))
  }
  const tarjeta = (n: number) =>
    within(screen.getByRole('heading', { name: new RegExp(`^Fila ${n} `) }).closest('div.rounded-3xl, section, li')!)

  it('administración lo abre desde el inicio; sube el CSV como multipart con el origen', async () => {
    const { usuario, fetchEspia } = await montarApp('/inicio')
    await usuario.click(screen.getByRole('link', { name: /Importar registros históricos/ }))
    await usuario.type(screen.getByLabelText('Origen del lote (opcional)'), 'Archivo físico 2018, caja 3')
    await subir(usuario, csv(VALIDA))
    expect(await screen.findByRole('heading', { name: 'lote-qa.csv' })).toBeInTheDocument()
    const cuerpo = (llamadas(fetchEspia, 'POST', '/api/importaciones')[0][1] as RequestInit).body as FormData
    expect((cuerpo.get('archivo') as File).name).toBe('lote-qa.csv')
    expect(cuerpo.get('origen')).toBe('Archivo físico 2018, caja 3')
    expect(screen.getByText('Origen: Archivo físico 2018, caja 3')).toBeInTheDocument()
  })

  it('valida el archivo en el navegador y explica un encabezado que no coincide', async () => {
    const { usuario, fetchEspia } = await montarApp('/importaciones')
    await usuario.click(screen.getByRole('button', { name: 'Subir y revisar' }))
    expect(screen.getByText('Elige un archivo.')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', '/api/importaciones')).toHaveLength(0)
    expect(validarArchivoImportacion(new File(['a'], 'datos.xls'))).toMatch(/Formato no admitido/)

    await subir(usuario, new File(['nombre,fecha\nAna,2020-01-01\n'], 'viejo.csv', { type: 'text/csv' }))
    expect(await screen.findByText(/Los encabezados del CSV deben coincidir con la plantilla/)).toBeInTheDocument()
  })

  it('no deja confirmar con errores sin resolver; corregir la fila la vuelve a validar', async () => {
    const { usuario, fetchEspia } = await montarApp('/importaciones')
    await subir(usuario, csv(VALIDA, SIN_NOMBRE))
    await screen.findByRole('heading', { name: 'lote-qa.csv' })
    expect(
      screen.getByText('Faltan 1 fila por resolver: decide qué hacer con cada una o corrígela.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled()
    expect(tarjeta(3).getByText(/Falta el nombre del paciente/)).toBeInTheDocument()
    expect(tarjeta(3).getByRole('radio', { name: 'Crear paciente y carpeta' })).toBeDisabled()

    await usuario.click(tarjeta(3).getByRole('button', { name: 'Corregir datos' }))
    const nombre = tarjeta(3).getByLabelText('Nombre completo')
    expect(nombre).toHaveAttribute('aria-invalid', 'true')
    await usuario.type(nombre, 'QA Lucía Apaza')
    await usuario.click(tarjeta(3).getByRole('button', { name: 'Guardar y volver a validar' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeEnabled())
    const patch = fetchEspia.mock.calls.find(([u]) =>
      /\/filas\/3\/datos$/.test(new URL(String(u), 'http://x').pathname),
    )!
    expect(JSON.parse(String((patch[1] as RequestInit).body))).toEqual({
      version: 1,
      datos: { nombreCompleto: 'QA Lucía Apaza' },
    })

    await usuario.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByRole('heading', { name: 'Importación confirmada' })).toBeInTheDocument()
    expect(screen.getByText(/2 carpetas creadas, 0 vinculadas y 0 filas no importadas/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Abrir carpeta/ })).toHaveLength(2)
  })

  it('un número de carpeta que ya existe se vincula al caso existente o se excluye, nunca se duplica', async () => {
    const { usuario } = await montarApp('/importaciones')
    await subir(usuario, csv(MISMO_NUMERO))
    await screen.findByRole('heading', { name: 'lote-qa.csv' })
    const t = tarjeta(2)
    expect(t.getByText('Posible duplicado')).toBeInTheDocument()
    expect(t.getByText(/Ya existe la carpeta Nº 1 \(voluntario\) de Mariana Gutiérrez Paz/)).toBeInTheDocument()

    await usuario.click(t.getByRole('radio', { name: 'Vincular a uno existente' }))
    expect(t.getByLabelText('Vincular con')).toHaveDisplayValue(/Carpeta existente Nº 1/)
    await usuario.click(t.getByRole('button', { name: 'Aplicar decisión' }))
    await waitFor(() =>
      expect(tarjeta(2).getByText('Vincular a uno existente', { selector: 'span' })).toBeInTheDocument(),
    )

    await usuario.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByText(/0 carpetas creadas, 1 vinculada/)).toBeInTheDocument()
  })

  it('si el contador saltaría, pide aceptarlo antes de importar', async () => {
    const { usuario, fetchEspia } = await montarApp('/importaciones')
    await subir(usuario, csv(CON_SALTO))
    await screen.findByRole('heading', { name: 'lote-qa.csv' })
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByText(/harán avanzar el contador/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled()
    await usuario.click(
      screen.getByRole('checkbox', { name: /Acepto que el contador avance: derivado del Nº \d+ al Nº 40/ }),
    )
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByRole('heading', { name: 'Importación confirmada' })).toBeInTheDocument()
    const ultima = fetchEspia.mock.calls.filter(([u]) => /\/confirmar$/.test(String(u))).at(-1)!
    expect(JSON.parse(String((ultima[1] as RequestInit).body))).toEqual({ version: 1, aceptaAvanceContador: true })
  })

  it('un 409 por versión vieja bloquea los cambios hasta recargar la vista previa', async () => {
    const { usuario, fetchEspia } = await montarApp('/importaciones')
    await subir(usuario, csv(VALIDA, SIN_NOMBRE))
    await screen.findByRole('heading', { name: 'lote-qa.csv' })
    const t = tarjeta(3)
    await usuario.click(t.getByRole('radio', { name: 'No importar esta fila' }))
    fetchEspia.mockImplementationOnce(() =>
      Promise.resolve(
        Response.json({ message: 'El lote cambió. Vuelve a consultar la vista previa.' }, { status: 409 }),
      ),
    )
    await usuario.click(t.getByRole('button', { name: 'Aplicar decisión' }))
    expect(await screen.findByText(/Otra persona cambió este lote/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled()
    await usuario.click(screen.getByRole('button', { name: 'Recargar vista previa' }))
    await waitFor(() => expect(screen.queryByText(/Otra persona cambió este lote/)).not.toBeInTheDocument())
  })

  it('volver a subir un archivo ya importado lleva al resultado anterior, sin duplicar', async () => {
    const { usuario } = await montarApp('/importaciones')
    await subir(usuario, csv(VALIDA))
    await usuario.click(await screen.findByRole('button', { name: 'Confirmar importación' }))
    await screen.findByRole('heading', { name: 'Importación confirmada' })
    await usuario.click(screen.getByRole('link', { name: 'Importar otro archivo' }))
    await subir(usuario, csv(VALIDA))
    expect(await screen.findByText('Este archivo ya fue importado antes. No se vuelve a cargar.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('link', { name: 'Ver el resultado de esa importación' }))
    expect(await screen.findByText('Este lote ya fue importado.')).toBeInTheDocument()
  })

  it('un fallo de red al confirmar no deja el lote a medias y se puede reintentar', async () => {
    const { usuario, fetchEspia } = await montarApp('/importaciones')
    await subir(usuario, csv(VALIDA))
    await screen.findByRole('heading', { name: 'lote-qa.csv' })
    const ruta = fetchEspia.mock.calls
      .map(([u]) => new URL(String(u), 'http://x').pathname)
      .find((p) => /^\/api\/importaciones\/[^/]+$/.test(p))
    fallarUnaVez(fetchEspia, 'POST', `${ruta ?? ''}/confirmar`, 'red')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByText(/El lote no quedó a medias: puedes reintentar/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByRole('heading', { name: 'Importación confirmada' })).toBeInTheDocument()
  })

  it('terapeutas y marketing no tienen la importación', async () => {
    await montarApp('/importaciones', 'sofia')
    expect(
      await screen.findByRole('heading', { name: 'Esta sección no está disponible para tu cuenta' }),
    ).toBeInTheDocument()
  })

  it('reglas: la plantilla trae las 18 columnas; una fila con error solo se resuelve excluyéndola', async () => {
    expect((await plantillaCsv().text()).replace('﻿', '').trim()).toBe(ENCABEZADO)
    expect(validarArchivoImportacion(new File(['x'], 'a.csv'))).toBeNull()
    const base = {
      numeroFila: 2,
      referenciaOrigen: null,
      datos: {},
      errores: [],
      advertencias: [],
      coincidencias: [],
      resultado: null,
    }
    expect(filaPendiente({ ...base, estado: 'error', decision: 'crear' })).toBe(true)
    expect(filaPendiente({ ...base, estado: 'error', decision: 'excluir' })).toBe(false)
    expect(filaPendiente({ ...base, estado: 'valida_nueva', decision: null })).toBe(true)
  })
})
