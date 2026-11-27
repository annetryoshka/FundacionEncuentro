import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import fuenteApp from '../../App.tsx?raw'
import { CARPETA_DE_SOFIA, montarApp } from '../../test/montarApp'
import { RECORRIDOS } from './recorridos'

const fuentes = import.meta.glob<string>('../../**/*.tsx', { query: '?raw', import: 'default', eager: true })
const marcados = new Set(
  Object.values(fuentes).flatMap((f) => [...f.matchAll(/data-recorrido="([^"]+)"/g)].map((m) => m[1])),
)

const abrirAyuda = (usuario: Awaited<ReturnType<typeof montarApp>>['usuario']) =>
  usuario.click(screen.getByRole('button', { name: 'Ayuda: cómo se usa esta pantalla' }))

describe('Recorridos guiados', () => {
  it('cubre todas las pantallas internas de App.tsx', () => {
    const internas = [...fuenteApp.matchAll(/path="([a-z][^"]*)"/g)].map((m) => `/${m[1]}`)
    expect(internas.length).toBeGreaterThan(20)
    expect(Object.keys(RECORRIDOS).sort()).toEqual(internas.sort())
  })

  it('cada paso señala un elemento marcado en alguna pantalla', () => {
    const sinMarca = Object.values(RECORRIDOS)
      .flatMap((pasos) => pasos ?? [])
      .flatMap((p) => (p.elemento && !marcados.has(p.elemento) ? [p.elemento] : []))
    expect(sinMarca).toEqual([])
  })

  it('recorre la pantalla paso a paso y devuelve el foco al botón al salir', async () => {
    const { usuario } = await montarApp('/carpetas')
    await waitFor(() => expect(document.querySelector('[data-recorrido="lista-carpetas"]')).not.toBeNull())
    await abrirAyuda(usuario)

    const dialogo = screen.getByRole('dialog', { name: 'Carpetas' })
    expect(within(dialogo).getByText(/^Paso 1 de \d+$/)).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument()

    await usuario.click(within(dialogo).getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('dialog', { name: 'Buscar' })).toBeInTheDocument()
    await usuario.keyboard('{ArrowRight}')
    expect(screen.getByRole('dialog', { name: 'Filtrar' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByRole('dialog', { name: 'Buscar' })).toBeInTheDocument()

    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ayuda: cómo se usa esta pantalla' })).toHaveFocus()
  })

  it('el último paso dice «Terminar» y cierra el recorrido', async () => {
    const { usuario } = await montarApp('/difusion')
    await screen.findByRole('status')
    await abrirAyuda(usuario)
    let dialogo = screen.getByRole('dialog')
    while (within(dialogo).queryByRole('button', { name: /Siguiente/ })) {
      await usuario.click(within(dialogo).getByRole('button', { name: /Siguiente/ }))
      dialogo = screen.getByRole('dialog')
    }
    await usuario.click(within(dialogo).getByRole('button', { name: 'Terminar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('omite lo que el rol no ve: la terapeuta no tiene «Paciente nuevo»', async () => {
    const { usuario } = await montarApp('/carpetas', 'sofia')
    await screen.findByRole('link', { name: /Mariana Gutiérrez Paz/ })
    await abrirAyuda(usuario)
    expect(screen.getByRole('dialog', { name: 'Mis carpetas' })).toBeInTheDocument()

    const titulos: string[] = []
    for (;;) {
      const dialogo = screen.getByRole('dialog')
      titulos.push(within(dialogo).getByRole('heading').textContent ?? '')
      const siguiente = within(dialogo).queryByRole('button', { name: /Siguiente/ })
      if (!siguiente) break
      await usuario.click(siguiente)
    }
    expect(titulos).not.toContain('Paciente nuevo')
    expect(titulos).not.toContain('Carpetas')
  })

  it('marketing ve en el inicio su acceso a difusión, no la búsqueda de carpetas', async () => {
    const { usuario } = await montarApp('/inicio', 'apoyo')
    await abrirAyuda(usuario)
    const titulos: string[] = []
    for (;;) {
      const dialogo = screen.getByRole('dialog')
      titulos.push(within(dialogo).getByRole('heading').textContent ?? '')
      const siguiente = within(dialogo).queryByRole('button', { name: /Siguiente/ })
      if (!siguiente) break
      await usuario.click(siguiente)
    }
    expect(titulos).toContain('Difusión')
    expect(titulos).not.toContain('Buscar una carpeta')
  })

  it('la carpeta del paciente tiene su propio recorrido', async () => {
    const { usuario } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`)
    await screen.findByRole('heading', { name: 'Mariana Gutiérrez Paz', level: 1 })
    await abrirAyuda(usuario)
    expect(screen.getByRole('dialog', { name: 'La carpeta del paciente' })).toBeInTheDocument()
  })

  it('el botón «?» no aparece en pantallas sin recorrido', async () => {
    const { usuario } = await montarApp('/usuarios')
    expect(screen.queryByRole('button', { name: 'Ayuda: cómo se usa esta pantalla' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('link', { name: 'Inicio' }))
    expect(screen.getByRole('button', { name: 'Ayuda: cómo se usa esta pantalla' })).toBeInTheDocument()
  })
})
