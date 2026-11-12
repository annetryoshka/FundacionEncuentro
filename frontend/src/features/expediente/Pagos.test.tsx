import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { atenderSimulado, CONTRASENA_DEMO } from '../../api/simulado/servidor'
import { CARPETA_DE_SOFIA, SESION_1, SESION_2, llamadas, montarApp } from '../../test/montarApp'

/** FE-87 · Formulario y listado de pagos (reglas FE-86, API FE-88). Solo administración. */
describe('Pagos', () => {
  const RUTA = `/api/carpetas/${CARPETA_DE_SOFIA}/pagos`
  const cuerpo = (llamada: unknown[]) => JSON.parse(String((llamada[1] as RequestInit).body)) as unknown
  const listado = async () =>
    within((await screen.findByRole('heading', { name: 'Pagos registrados' })).closest('section')!)

  it('lista los pagos con su sesión y el total; solo ofrece sesiones sin pago', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/pagos`)
    const pagos = await listado()
    expect(await pagos.findByText('Sesión 1 (12/10/2026)')).toBeInTheDocument()
    expect(pagos.getByText(/Pagado el 12 de octubre de 2026 · QR/)).toBeInTheDocument()
    expect(pagos.getByText('Total pagado').nextSibling).toHaveTextContent('Bs 75,50')

    const opciones = within(screen.getByLabelText('Sesión')).getAllByRole('option')
    expect(opciones.map((o) => o.textContent)).toEqual(['Elige una sesión', 'Sesión 2 · 19/10/2026'])
  })

  it('valida monto, método y sesión antes de enviar', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/pagos`)
    await usuario.type(await screen.findByLabelText('Monto (Bs)'), '75,555')
    await usuario.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByText('Elige la sesión que se paga.')).toBeInTheDocument()
    expect(screen.getByText(/Monto no válido/)).toBeInTheDocument()
    expect(screen.getByText('Elige el método de pago.')).toBeInTheDocument()

    await usuario.clear(screen.getByLabelText('Monto (Bs)'))
    await usuario.type(screen.getByLabelText('Monto (Bs)'), '0')
    await usuario.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByText('El monto debe ser mayor que cero.')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'POST', RUTA)).toHaveLength(0)
  })

  it('registra un pago con coma decimal y actualiza el total', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/pagos`)
    await usuario.selectOptions(await screen.findByLabelText('Sesión'), SESION_2)
    await usuario.type(screen.getByLabelText('Monto (Bs)'), '40,25')
    const fecha = screen.getByLabelText('Fecha del pago')
    await usuario.clear(fecha)
    await usuario.type(fecha, '2026-10-20')
    await usuario.click(screen.getByRole('radio', { name: 'Transferencia' }))
    await usuario.type(screen.getByLabelText('Referencia (opcional)'), 'TRX-123')
    await usuario.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByText('Pago de Bs 40,25 registrado.')).toBeInTheDocument()
    const pagos = await listado()
    expect(pagos.getByText(/Pagado el 20 de octubre de 2026 · Transferencia · Ref\. TRX-123/)).toBeInTheDocument()
    expect(pagos.getByText('Total pagado').nextSibling).toHaveTextContent('Bs 115,75')
    expect(screen.getByText('Todas las sesiones de esta carpeta ya tienen su pago registrado.')).toBeInTheDocument()
    expect(cuerpo(llamadas(fetchEspia, 'POST', RUTA)[0])).toEqual({
      sesionId: SESION_2,
      monto: '40.25',
      fecha: '2026-10-20',
      metodo: 'transferencia',
      referencia: 'TRX-123',
    })
  })

  it('la terapeuta no ve el apartado de pagos ni puede abrirlo por URL', async () => {
    const { usuario } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/sesiones`, 'sofia')
    const apartados = within(await screen.findByRole('navigation', { name: 'Apartados de la carpeta' }))
    expect(apartados.queryByRole('link', { name: 'Pagos' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  })

  it('la terapeuta que abre la URL de pagos ve que no tiene permiso', async () => {
    const { fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/pagos`, 'sofia')
    expect(
      await screen.findByRole('heading', { name: 'Esta sección no está disponible para tu cuenta' }),
    ).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'GET', RUTA)).toHaveLength(0)
  })

  it('la API simulada repite el comportamiento del backend: reintento idéntico y conflicto', async () => {
    await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/pagos`)
    const login = await atenderSimulado('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'direccion@fundacion.test', password: CONTRASENA_DEMO }),
    })
    const { accessToken } = (await login.json()) as { accessToken: string }
    const pagar = (datos: Record<string, unknown>) =>
      atenderSimulado(RUTA, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ sesionId: SESION_1, fecha: '2026-10-12', metodo: 'qr', referencia: null, ...datos }),
      })
    const repetido = await pagar({ monto: '75.50' })
    expect(repetido.status).toBe(200)
    expect(((await repetido.json()) as { reutilizado: boolean }).reutilizado).toBe(true)
    expect((await pagar({ monto: '80' })).status).toBe(409)
    expect((await pagar({ monto: '-5' })).status).toBe(400)
  })
})
