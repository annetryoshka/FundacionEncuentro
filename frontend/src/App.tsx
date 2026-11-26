import { Navigate, Route, Routes } from 'react-router'
import { Plantilla } from './componentes/Plantilla'
import { PaginaLogin } from './features/auth/PaginaLogin'
import { RutaProtegida } from './features/auth/RutaProtegida'
import { PaginaCarpeta } from './features/carpetas/PaginaCarpeta'
import { PaginaCarpetas } from './features/carpetas/PaginaCarpetas'
import { PaginaNuevaCarpeta } from './features/carpetas/PaginaNuevaCarpeta'
import { PaginaConstancia } from './features/expediente/PaginaConstancia'
import { PaginaDiagnostico } from './features/expediente/PaginaDiagnostico'
import { PaginaFamilia } from './features/expediente/familia/PaginaFamilia'
import { PaginaGenograma } from './features/expediente/genograma/PaginaGenograma'
import { PaginaInforme } from './features/expediente/informes/PaginaInforme'
import { PaginaInformes } from './features/expediente/informes/PaginaInformes'
import { PaginaHistorial } from './features/expediente/PaginaHistorial'
import { PaginaNuevaSesion } from './features/expediente/PaginaNuevaSesion'
import { PaginaPagos } from './features/expediente/PaginaPagos'
import { PaginaSesion } from './features/expediente/PaginaSesion'
import { PaginaSesiones } from './features/expediente/PaginaSesiones'
import { PaginaIndicadores } from './features/indicadores/PaginaIndicadores'
import { PaginaDifusion } from './features/difusion/PaginaDifusion'
import { PaginaEditarPublicacion, PaginaNuevaPublicacion } from './features/difusion/PaginaEditarPublicacion'
import { PaginaImportacion } from './features/importacion/PaginaImportacion'
import { PaginaLoteImportacion } from './features/importacion/PaginaLoteImportacion'
import { PaginaCategoriasCaso } from './features/investigacion/PaginaCategoriasCaso'
import { PaginaInvestigacion } from './features/investigacion/PaginaInvestigacion'
import { PaginaRevisionInvestigacion } from './features/investigacion/PaginaRevisionInvestigacion'
import { PlantillaPublica } from './features/publico/PlantillaPublica'
import { PaginaPublicaciones } from './features/publico/PaginaPublicaciones'
import { PaginaDetallePublicacion, PaginaPublicaNoEncontrada } from './features/publico/PaginaDetallePublicacion'
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

      {/* FE-149 · Portal público: sin sesión y sin navegación clínica */}
      <Route path="/publicaciones" element={<PlantillaPublica />}>
        <Route index element={<PaginaPublicaciones />} />
        <Route path=":id" element={<PaginaDetallePublicacion />} />
        <Route path="*" element={<PaginaPublicaNoEncontrada />} />
      </Route>

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
        {/* Sprint 2 · Expediente clínico de la carpeta */}
        {/* Sprint 3 · FE-127 familia y FE-132 genograma: administración o la terapeuta asignada */}
        <Route
          path="carpetas/:id/familia"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaFamilia />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id/genograma"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaGenograma />
            </RutaProtegida>
          }
        />
        {/* FE-154 · Informes: solo la terapeuta asignada (la API responde 403 a otros roles) */}
        <Route
          path="carpetas/:id/informes"
          element={
            <RutaProtegida roles={['terapeuta']}>
              <PaginaInformes />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id/informes/:versionId"
          element={
            <RutaProtegida roles={['terapeuta']}>
              <PaginaInforme />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id/historial"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaHistorial />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id/constancia"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaConstancia />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id/diagnostico"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaDiagnostico />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id/sesiones"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaSesiones />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id/sesiones/nueva"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaNuevaSesion />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id/sesiones/:sesionId"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaSesion />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id/pagos"
          element={
            <RutaProtegida roles={['administrador']}>
              <PaginaPagos />
            </RutaProtegida>
          }
        />
        {/* FE-144 · Difusión: marketing y administración */}
        <Route
          path="difusion"
          element={
            <RutaProtegida roles={['administrador', 'marketing']}>
              <PaginaDifusion />
            </RutaProtegida>
          }
        />
        <Route
          path="difusion/nueva"
          element={
            <RutaProtegida roles={['administrador', 'marketing']}>
              <PaginaNuevaPublicacion />
            </RutaProtegida>
          }
        />
        <Route
          path="difusion/:id"
          element={
            <RutaProtegida roles={['administrador', 'marketing']}>
              <PaginaEditarPublicacion />
            </RutaProtegida>
          }
        />
        {/* FE-165 · Importación histórica: solo administración */}
        <Route
          path="importaciones"
          element={
            <RutaProtegida roles={['administrador']}>
              <PaginaImportacion />
            </RutaProtegida>
          }
        />
        <Route
          path="importaciones/:id"
          element={
            <RutaProtegida roles={['administrador']}>
              <PaginaLoteImportacion />
            </RutaProtegida>
          }
        />
        {/* FE-170 · Investigación (Atlas.ti): administración y terapeutas, cada una con su alcance */}
        <Route
          path="investigacion"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaInvestigacion />
            </RutaProtegida>
          }
        />
        <Route
          path="investigacion/exportaciones/:id"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaRevisionInvestigacion />
            </RutaProtegida>
          }
        />
        <Route
          path="carpetas/:id/investigacion"
          element={
            <RutaProtegida roles={['administrador', 'terapeuta']}>
              <PaginaCategoriasCaso />
            </RutaProtegida>
          }
        />
        <Route
          path="indicadores"
          element={
            <RutaProtegida roles={['administrador']}>
              <PaginaIndicadores />
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
