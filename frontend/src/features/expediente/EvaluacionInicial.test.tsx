import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARPETA_DE_SOFIA, CARPETA_VACIA_DE_SOFIA, llamadas, montarApp } from '../../test/montarApp'

describe('FE-128 · evaluación inicial y diagnóstico opcional', () => {
  it('guarda una evaluación sin diagnóstico, la recarga y la muestra en el resumen', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/diagnostico`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Crear ficha' }))
    await usuario.type(screen.getByLabelText('Evaluación inicial'), '  Entrevista inicial QA sin diagnóstico  ')
    await usuario.click(screen.getByRole('button', { name: 'Guardar ficha' }))
    expect(await screen.findByText('Ficha de diagnóstico guardada.')).toBeInTheDocument()
    expect(screen.getByText('Entrevista inicial QA sin diagnóstico')).toBeInTheDocument()
    const put = llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/diagnostico`)[0]
    expect(JSON.parse(String((put[1] as RequestInit).body))).toMatchObject({
      evaluacionInicial: 'Entrevista inicial QA sin diagnóstico',
      diagnosticoIngreso: null, hipotesisRelacional: null, comentariosClinicos: null,
    })
    await usuario.click(screen.getByRole('link', { name: /Volver a la carpeta/ }))
    expect(await screen.findByText('Entrevista inicial QA sin diagnóstico')).toBeInTheDocument()
    await usuario.click(screen.getByRole('link', { name: 'Ver diagnóstico' }))
    expect(await screen.findByText('Entrevista inicial QA sin diagnóstico')).toBeInTheDocument()
    expect(screen.getAllByText('Sin registro')).toHaveLength(3)
  })

  it('un diagnóstico escrito no sustituye la evaluación obligatoria', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_VACIA_DE_SOFIA}/diagnostico`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Crear ficha' }))
    await usuario.type(screen.getByLabelText('Diagnóstico de ingreso (opcional)'), 'Diagnóstico ficticio QA')
    await usuario.click(screen.getByRole('button', { name: 'Guardar ficha' }))
    expect(await screen.findByText('Describe la evaluación inicial.')).toBeInTheDocument()
    expect(screen.getByLabelText('Evaluación inicial')).toHaveFocus()
    expect(llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_VACIA_DE_SOFIA}/diagnostico`)).toHaveLength(0)
    await usuario.type(screen.getByLabelText('Evaluación inicial'), 'Evaluación ficticia QA')
    expect(screen.queryByText('Describe la evaluación inicial.')).not.toBeInTheDocument()
  })

  it('lee una ficha antigua sin convertir sus comentarios y solicita la evaluación al editar', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}`, 'sofia')
    const original = fetchEspia.getMockImplementation()!
    fetchEspia.mockImplementation(async (entrada, init) => {
      const r = await original(entrada, init)
      if (new URL(String(entrada), 'http://x').pathname === `/api/carpetas/${CARPETA_DE_SOFIA}/diagnostico`
          && (init?.method ?? 'GET') === 'GET') {
        const datos = await r.json()
        return Response.json({ diagnostico: {
          ...datos.diagnostico, evaluacionInicial: null, comentariosClinicos: 'Comentario histórico QA',
        } })
      }
      return r
    })
    await usuario.click(await screen.findByRole('link', { name: 'Ver diagnóstico' }))
    expect(await screen.findByText('Sin evaluación inicial registrada')).toBeInTheDocument()
    expect(screen.getByText('Comentario histórico QA')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Editar ficha' }))
    expect(screen.getByLabelText('Evaluación inicial')).toHaveValue('')
    expect(screen.getByLabelText('Comentarios clínicos (opcional)')).toHaveValue('Comentario histórico QA')
    await usuario.click(screen.getByRole('button', { name: 'Guardar ficha' }))
    expect(await screen.findByText('Describe la evaluación inicial.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText('Sin evaluación inicial registrada')).toBeInTheDocument()
    expect(llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_DE_SOFIA}/diagnostico`)).toHaveLength(0)
  })

  it('permite limpiar el diagnóstico y conserva la evaluación al guardar', async () => {
    const { usuario, fetchEspia } = await montarApp(`/carpetas/${CARPETA_DE_SOFIA}/diagnostico`, 'sofia')
    await usuario.click(await screen.findByRole('button', { name: 'Editar ficha' }))
    await usuario.clear(screen.getByLabelText('Diagnóstico de ingreso (opcional)'))
    await usuario.click(screen.getByRole('button', { name: 'Guardar ficha' }))
    expect(await screen.findByText('Ficha de diagnóstico guardada.')).toBeInTheDocument()
    expect(screen.getByText('Entrevista inicial ficticia con la familia.')).toBeInTheDocument()
    const put = llamadas(fetchEspia, 'PUT', `/api/carpetas/${CARPETA_DE_SOFIA}/diagnostico`)[0]
    expect(JSON.parse(String((put[1] as RequestInit).body))).toMatchObject({
      evaluacionInicial: 'Entrevista inicial ficticia con la familia.', diagnosticoIngreso: null,
    })
  })
})
