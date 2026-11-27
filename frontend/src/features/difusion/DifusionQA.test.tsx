import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARPETA_DE_SOFIA, montarApp, montarSinSesion } from '../../test/montarApp'

const RUTAS_CLINICAS = /\/api\/(carpetas|casos|indicadores)/

describe('FE-145 · separación entre difusión y la parte clínica en la interfaz', () => {
  it('marketing solo ve Difusión en el menú, sin Carpetas ni Indicadores', async () => {
    await montarApp('/difusion', 'apoyo')
    const menu = within(await screen.findByRole('navigation', { name: 'Secciones' }))
    expect(menu.getByRole('link', { name: /Difusión/ })).toBeInTheDocument()
    expect(menu.queryByRole('link', { name: /Carpetas/ })).not.toBeInTheDocument()
    expect(menu.queryByRole('link', { name: /Indicadores/ })).not.toBeInTheDocument()
  })

  it.each([
    `/carpetas/${CARPETA_DE_SOFIA}`,
    `/carpetas/${CARPETA_DE_SOFIA}/familia`,
    `/carpetas/${CARPETA_DE_SOFIA}/genograma`,
    `/carpetas/${CARPETA_DE_SOFIA}/pagos`,
    '/indicadores',
  ])('marketing que escribe %s en la barra no ve datos clínicos', async (ruta) => {
    const { fetchEspia } = await montarApp(ruta, 'apoyo')
    await waitFor(() => expect(screen.queryByText(/Cargando|Abriendo/)).not.toBeInTheDocument())
    for (const texto of ['Mariana Gutiérrez Paz', 'Padre QA', 'Bs ']) {
      expect(screen.queryByText(new RegExp(texto))).not.toBeInTheDocument()
    }
    const clinicasRespondidas = fetchEspia.mock.results
      .map((r, i) => ({ url: String(fetchEspia.mock.calls[i][0]), r }))
      .filter(({ url }) => RUTAS_CLINICAS.test(url))
    for (const { r } of clinicasRespondidas) {
      const respuesta = (await r.value) as Response
      expect(respuesta.ok).toBe(false)
    }
  })

  it('el portal sin sesión no llama a ninguna ruta clínica', async () => {
    const { fetchEspia } = montarSinSesion('/publicaciones')
    await screen.findByRole('heading', { level: 1 })
    const llamadas = fetchEspia.mock.calls.map(([url]) => String(url))
    expect(llamadas.filter((u) => RUTAS_CLINICAS.test(u))).toEqual([])
  })
})
