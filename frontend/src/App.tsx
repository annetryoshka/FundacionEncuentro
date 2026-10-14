import { Navigate, Route, Routes } from 'react-router'
import { Plantilla } from './componentes/Plantilla'
import { PaginaLogin } from './features/auth/PaginaLogin'
import { RutaProtegida } from './features/auth/RutaProtegida'
import { PaginaCarpeta } from './features/carpetas/PaginaCarpeta'
import { PaginaCarpetas } from './features/carpetas/PaginaCarpetas'
import { PaginaNuevaCarpeta } from './features/carpetas/PaginaNuevaCarpeta'
import { PaginaUsuarios } from './features/usuarios/PaginaUsuarios'
import { PaginaInicio } from './paginas/PaginaInicio'
import { PaginaNoEncontrada } from './paginas/PaginaNoEncontrada'

/**
 * FE-43 · Rutas del sistema. Los permisos por rol se repiten en el backend:
 * aquí solo deciden qué pantallas y menús ve cada persona.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PaginaLogin />} />

      <Route
        element={
          <RutaProtegida>
            <Plantilla />
          </RutaProtegida>
        }
      >
        <Route index element={<Navigate to="/inicio" replace />} />
        <Route path="inicio" element={<PaginaInicio />} />
        <Route
          path="carpetas"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaCarpetas />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/nueva"
          element={
            <RutaProtegida roles={['administrador']}>
              <PaginaNuevaCarpeta />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaCarpeta />
            </RutaProtegida>
          }
        />
        <Route
          path="usuarios"
          element={
            <RutaProtegida roles={['administrador']}>
              <PaginaUsuarios />
            </RutaProtegida>
          }
        />
        <Route path="*" element={<PaginaNoEncontrada />} />
      </Route>
    </Routes>
  )
}
