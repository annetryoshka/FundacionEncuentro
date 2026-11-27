import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { claseBoton, claseCampo } from '../componentes/estilos'
import { Icono } from '../componentes/iconos'
import { Boton, EnlaceAcceso, Tarjeta } from '../componentes/ui'
import { useSesion } from '../features/auth/sesion'
import { nombreRol } from '../features/usuarios/tipos'

/**
 * Primera pantalla tras el login: muestra solo las funciones que permite el rol (FE-20).
 * Lo más usado (buscar una carpeta) va primero; lo administrativo, debajo.
 */
export function PaginaInicio() {
  const { usuario, tieneRol } = useSesion()
  if (!usuario) return null

  const esAdmin = tieneRol('administrador')
  const veCarpetas = tieneRol('administrador', 'terapeuta')

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-verde-oscuro sm:text-3xl">Hola, {usuario.nombreCompleto}</h1>
          <p className="mt-1.5 text-suave">Entraste como {nombreRol(usuario.rol)}.</p>
        </div>
        {esAdmin && (
          <Link to="/carpetas/nueva" className={claseBoton()} data-recorrido="registrar-paciente">
            <Icono nombre="pacienteNuevo" className="size-[1.125rem]" />
            Registrar paciente
          </Link>
        )}
      </header>

      {veCarpetas ? <BuscarCarpeta esAdmin={esAdmin} /> : <SinAccesoClinico />}

      {esAdmin && (
        <section aria-labelledby="inicio-administracion" data-recorrido="administracion">
          <h2 id="inicio-administracion" className="text-lg font-semibold text-verde-oscuro">
            Administración
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <EnlaceAcceso
                a="/indicadores"
                icono="grafico"
                titulo="Indicadores"
                descripcion="Casos por estado, sesiones y pagos recibidos en un período."
              />
            </li>
            <li>
              <EnlaceAcceso
                a="/gastos"
                icono="pago"
                titulo="Gastos del mes"
                descripcion="Internet, electricidad, alquiler y otros gastos, con el total mensual."
              />
            </li>
            <li>
              <EnlaceAcceso
                a="/difusion"
                icono="megafono"
                titulo="Difusión"
                descripcion="Campañas, actividades y cursos del portal público."
              />
            </li>
            <li>
              <EnlaceAcceso
                a="/importaciones"
                icono="importar"
                titulo="Importar registros históricos"
                descripcion="Carga pacientes y casos antiguos desde una planilla, con revisión fila por fila."
              />
            </li>
            <li>
              <EnlaceAcceso
                a="/usuarios"
                icono="personas"
                titulo="Cuentas del personal"
                descripcion="Crea cuentas para terapeutas y personal de apoyo."
              />
            </li>
          </ul>
        </section>
      )}
    </div>
  )
}

/** Búsqueda directa desde el inicio: lleva al listado de carpetas con el texto ya aplicado. */
function BuscarCarpeta({ esAdmin }: { esAdmin: boolean }) {
  const navegar = useNavigate()
  const [texto, setTexto] = useState('')

  const buscar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const q = texto.trim()
    navegar(q ? `/carpetas?q=${encodeURIComponent(q)}` : '/carpetas')
  }

  return (
    <Tarjeta data-recorrido="buscar-carpeta">
      <div>
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-verde-oscuro">
            <Icono nombre="carpeta" className="size-5 text-verde" />
            {esAdmin ? 'Buscar una carpeta' : 'Buscar en mis carpetas'}
          </h2>
          <p className="mt-0.5 text-suave">
            {esAdmin
              ? 'Escribe el nombre del paciente o el número de carpeta.'
              : 'Solo aparecen las carpetas que la dirección te asignó.'}
          </p>

          <form role="search" onSubmit={buscar} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="inicio-busqueda" className="sr-only">
              Nombre o número de carpeta
            </label>
            <input
              id="inicio-busqueda"
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ej.: Mamani o 12"
              autoComplete="off"
              className={`${claseCampo(false)} mt-0 sm:flex-1`}
            />
            <Boton type="submit" icono="buscar">
              Buscar
            </Boton>
          </form>

          <Link
            to="/carpetas"
            className="mt-3 inline-flex items-center gap-1 rounded-full text-sm font-semibold text-naranja-texto underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-naranja"
          >
            {esAdmin ? 'Ver todas las carpetas' : 'Ver mis carpetas'}
            <Icono nombre="siguiente" className="size-4" />
          </Link>
        </div>
      </div>
    </Tarjeta>
  )
}

/** Marketing (FE-144): no ve información clínica; su trabajo es la difusión. */
function SinAccesoClinico() {
  return (
    <section aria-labelledby="inicio-difusion" className="space-y-3" data-recorrido="inicio-difusion">
      <p className="max-w-prose text-suave">Tu cuenta no tiene acceso a la información clínica de los pacientes.</p>
      <h2 id="inicio-difusion" className="text-lg font-semibold text-verde-oscuro">
        Difusión
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <EnlaceAcceso
            a="/articulos"
            icono="informe"
            titulo="Artículos de investigación"
            descripcion="Artículos autorizados para la sección «Investigaciones» del portal."
          />
        </li>
        <li>
          <EnlaceAcceso
            a="/difusion"
            icono="megafono"
            titulo="Publicaciones"
            descripcion="Campañas, actividades y cursos: borradores, publicación y retiro."
          />
        </li>
        <li>
          <EnlaceAcceso
            a="/publicaciones"
            icono="web"
            titulo="Ver el portal público"
            descripcion="Lo que ven los visitantes, tal como está publicado."
          />
        </li>
      </ul>
    </section>
  )
}
