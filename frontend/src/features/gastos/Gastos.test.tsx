import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fallarUnaVez, llamadas, montarApp } from '../../test/montarApp'
import { moverMes, nombreMes, validarGasto, formularioVacio } from './gastos'

/**
 * FE-175 · Gastos de funcionamiento (contrato FE-172, API FE-174). Ejemplo de aceptación de FE-172 §5:
 * internet 120 + electricidad 80 + alquiler 1500 = 1700; electricidad a 85 → 1705; anular internet → 1585.
 */
describe('Gastos del mes', () => {
  const total = () => screen.getByText(/^Total gastado en/).nextElementSibling!.textContent
  const porTipo = (nombre: string) =>
    within(screen.getByRole('heading', { name: 'Totales del mes' }).parentElement!).getByText(nombre)
      .nextElementSibling!.textContent
  const fila = (texto: RegExp) => screen.getAllByRole('listitem').find((li) => texto.test(li.textContent ?? ''))!

  async function registrar(
    usuario: Awaited<ReturnType<typeof montarApp>>['usuario'],
    tipo: string,
    fecha: string,
    monto: string,
    descripcion = '',
  ) {
    const formulario = within(screen.getByRole('group', { name: 'Registrar gasto' }))
    await usuario.click(formulario.getByRole('radio', { name: tipo }))
    await usuario.clear(formulario.getByLabelText('Fecha del gasto'))
    await usuario.type(formulario.getByLabelText('Fecha del gasto'), fecha)
    await usuario.type(formulario.getByLabelText('Monto (Bs)'), monto)
    if (descripcion) await usuario.type(formulario.getByLabelText(/^Descripción/), descripcion)
    await usuario.click(formulario.getByRole('button', { name: 'Guardar gasto' }))
    // Al guardar, el formulario queda limpio y el mes se vuelve a consultar.
    await waitFor(() => expect(formulario.getByLabelText('Monto (Bs)')).toHaveValue(''))
    await screen.findByText(new RegExp(`Gasto de Bs [\\d.,]+ registrado`))
  }

  it('recorre el ejemplo de FE-172: 1700 → 1705 al corregir → 1585 al anular', async () => {
    const { usuario, fetchEspia } = await montarApp('/gastos?mes=2026-11')
    expect(await screen.findByText('No hay gastos registrados en noviembre de 2026.')).toBeInTheDocument()
    expect(total()).toBe('Bs 0,00')

    await registrar(usuario, 'Internet / Wi-Fi', '2026-11-20', '120')
    await registrar(usuario, 'Electricidad', '2026-11-21', '80,00')
    await registrar(usuario, 'Alquiler', '2026-11-22', '1500')
    await waitFor(() => expect(total()).toBe('Bs 1.700,00'))
    expect(porTipo('Alquiler')).toBe('Bs 1.500,00')
    const posts = llamadas(fetchEspia, 'POST', '/api/gastos').map(([, i]) =>
      JSON.parse(String((i as RequestInit).body)),
    )
    expect(posts[1]).toEqual({ categoria: 'electricidad', fecha: '2026-11-21', monto: '80.00', descripcion: null })

    await usuario.click(within(fila(/Electricidad/)).getByRole('button', { name: /Corregir/ }))
    const monto = within(fila(/Electricidad/)).getByLabelText('Monto (Bs)')
    await usuario.clear(monto)
    await usuario.type(monto, '85')
    await usuario.click(within(fila(/Electricidad/)).getByRole('button', { name: 'Guardar corrección' }))
    expect(await screen.findByText('Gasto corregido.')).toBeInTheDocument()
    await waitFor(() => expect(total()).toBe('Bs 1.705,00'))

    await usuario.click(within(fila(/Internet/)).getByRole('button', { name: /Anular/ }))
    expect(screen.getByText(/Dejará de sumar en el total del mes/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí, anular gasto' })).toHaveFocus())
    await usuario.type(screen.getByLabelText('Motivo (opcional)'), 'Registrado por error')
    await usuario.click(screen.getByRole('button', { name: 'Sí, anular gasto' }))
    expect(await screen.findByText(/Gasto anulado/)).toBeInTheDocument()
    await waitFor(() => expect(total()).toBe('Bs 1.585,00'))
    // El anulado sigue a la vista, tachado y sin acciones.
    const anulado = within(fila(/Internet/))
    expect(anulado.getByText('Anulado')).toBeInTheDocument()
    expect(anulado.getByText('Motivo: Registrado por error')).toBeInTheDocument()
    expect(anulado.queryByRole('button', { name: /Corregir/ })).not.toBeInTheDocument()
    expect(screen.getByText('2 gastos · 1 anulado (no suman)')).toBeInTheDocument()
  })

  it('valida antes de enviar: tipo, monto con coma, «otros» exige descripción; Cancelar no escribe', async () => {
    const { usuario, fetchEspia } = await montarApp('/gastos?mes=2026-11')
    await screen.findByText(/No hay gastos registrados/)
    const formulario = within(screen.getByRole('group', { name: 'Registrar gasto' }))
    await usuario.click(formulario.getByRole('button', { name: 'Guardar gasto' }))
    expect(formulario.getByText('Elige el tipo de gasto.')).toBeInTheDocument()
    expect(formulario.getByText('Escribe el monto en bolivianos.')).toBeInTheDocument()

    await usuario.click(formulario.getByRole('radio', { name: 'Otros gastos' }))
    await usuario.type(formulario.getByLabelText('Monto (Bs)'), '12,345')
    await usuario.click(formulario.getByRole('button', { name: 'Guardar gasto' }))
    expect(formulario.getByText(/hasta 8 cifras y 2 decimales/)).toBeInTheDocument()
    expect(formulario.getByText(/Describe el gasto/)).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', '/api/gastos')).toHaveLength(0)

    await usuario.click(formulario.getByRole('button', { name: 'Cancelar' }))
    expect(formulario.getByLabelText('Monto (Bs)')).toHaveValue('')
    expect(llamadas(fetchEspia, 'POST', '/api/gastos')).toHaveLength(0)
  })

  it('cambia de mes con las flechas y lo guarda en la URL; octubre tiene su gasto', async () => {
    const { usuario, fetchEspia } = await montarApp('/gastos?mes=2026-11')
    await screen.findByText(/No hay gastos registrados en noviembre/)
    await usuario.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(await screen.findByText('Alquiler ficticio de octubre', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'octubre de 2026' })).toBeInTheDocument()
    const url = new URL(String(llamadas(fetchEspia, 'GET', '/api/gastos').at(-1)![0]), 'http://x')
    expect(url.searchParams.get('mes')).toBe('2026-10')
  })

  it('guardar desactiva el botón; un fallo conserva lo escrito', async () => {
    const { usuario, fetchEspia } = await montarApp('/gastos?mes=2026-11')
    await screen.findByText(/No hay gastos registrados/)
    const formulario = within(screen.getByRole('group', { name: 'Registrar gasto' }))
    await usuario.click(formulario.getByRole('radio', { name: 'Alquiler' }))
    await usuario.clear(formulario.getByLabelText('Fecha del gasto'))
    await usuario.type(formulario.getByLabelText('Fecha del gasto'), '2026-11-02')
    await usuario.type(formulario.getByLabelText('Monto (Bs)'), '1500')
    fallarUnaVez(fetchEspia, 'POST', '/api/gastos', 'red')
    await usuario.click(formulario.getByRole('button', { name: 'Guardar gasto' }))
    expect(await screen.findByText(/No se guardó/)).toBeInTheDocument()
    expect(formulario.getByLabelText('Monto (Bs)')).toHaveValue('1500')
    expect(total()).toBe('Bs 0,00')
  })

  it('un error al cargar el mes no se muestra como «sin gastos»', async () => {
    const { usuario, fetchEspia } = await montarApp('/inicio')
    fallarUnaVez(fetchEspia, 'GET', '/api/gastos', 500)
    await usuario.click(screen.getByRole('link', { name: /Gastos del mes/ }))
    expect(await screen.findByText(/No se pudieron cargar los gastos del mes/)).toBeInTheDocument()
    expect(screen.queryByText(/No hay gastos registrados/)).not.toBeInTheDocument()
  })

  it('terapeutas y marketing no tienen gastos ni ven el menú', async () => {
    const { fetchEspia } = await montarApp('/gastos', 'sofia')
    expect(
      await screen.findByRole('heading', { name: 'Esta sección no está disponible para tu cuenta' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Gastos' })).not.toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', '/api/gastos')).toHaveLength(0)
  })

  it('reglas de meses y del formulario', () => {
    expect(moverMes('2026-01', -1)).toBe('2025-12')
    expect(moverMes('2026-12', 1)).toBe('2027-01')
    expect(nombreMes('2026-11')).toBe('noviembre de 2026')
    const base = { ...formularioVacio('2026-11'), categoria: 'internet' as const, fecha: '2026-11-20' }
    expect(validarGasto({ ...base, monto: '0' }).monto).toMatch(/mayor que cero/)
    expect(validarGasto({ ...base, monto: '120,5' })).toEqual({})
    expect(validarGasto({ ...base, monto: '1', fecha: '2999-01-01' }).fecha).toMatch(/futura/)
  })
})
