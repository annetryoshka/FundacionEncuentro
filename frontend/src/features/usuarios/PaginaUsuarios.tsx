import { ErrorDeCarga } from '../../componentes/ErrorDeCarga'
import { useRef, useState, type FormEvent } from 'react'
import { ErrorApi, mensajeErrorGeneral } from '../../api/cliente'
import { useCarga } from '../../api/useCarga'
import {
  Aviso,
  Boton,
  Cargando,
  CampoTexto,
  EncabezadoPagina,
  GrupoOpciones,
  Insignia,
  Tarjeta,
} from '../../componentes/ui'
import { fechaCorta } from '../../utilidades/fechas'
import type { Rol } from '../auth/tipos'
import { ROLES, nombreRol, type Usuario } from './tipos'
import { crearUsuario, listarUsuarios } from './usuariosApi'
import { generarContrasena, validarNuevoUsuario, type ErroresUsuario, type FormularioUsuario } from './validacion'

type Formulario = FormularioUsuario
const VACIO: Formulario = { nombreCompleto: '', correo: '', rol: '', contrasenaInicial: '' }

/** FE-28 · Listado y formulario de cuentas del personal (historia FE-10). Solo administración. */
export function PaginaUsuarios() {
  const lista = useCarga(() => listarUsuarios(), [])

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        titulo="Cuentas del personal"
        descripcion="Crea las cuentas con las que el personal entra al sistema. El rol define qué información puede ver cada persona."
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <ListadoUsuarios estado={lista} />
        <FormularioUsuario alCrear={lista.recargar} />
      </div>
    </div>
  )
}

function ListadoUsuarios({ estado }: { estado: ReturnType<typeof useCarga<Usuario[]>> }) {
  const { datos: usuarios, error, cargando, recargar } = estado

  return (
    <Tarjeta className="lg:order-1">
      <h2 className="text-lg font-semibold text-verde-oscuro">
        Cuentas registradas{usuarios && <span className="font-normal text-suave"> ({usuarios.length})</span>}
      </h2>

      {cargando && !usuarios && <Cargando texto="Cargando cuentas…" />}

      {error !== undefined && <ErrorDeCarga error={error} alReintentar={recargar} className="mt-4" />}

      {usuarios && usuarios.length === 0 && <p className="mt-4 text-suave">Todavía no hay cuentas registradas.</p>}

      {usuarios && usuarios.length > 0 && (
        <>
          {/* Celular: tarjetas apiladas. Desde md: tabla. */}
          <ul className="mt-4 divide-y divide-linea/70 md:hidden">
            {usuarios.map((u) => (
              <li key={u.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-texto">{u.nombreCompleto}</p>
                  <EstadoCuenta activo={u.activo} />
                </div>
                <p className="text-sm break-all text-suave">{u.email}</p>
                <p className="text-sm text-texto">{nombreRol(u.rol)}</p>
              </li>
            ))}
          </ul>

          <table className="mt-4 hidden w-full text-left text-sm md:table">
            <caption className="sr-only">Cuentas del personal. No se muestran contraseñas.</caption>
            <thead>
              <tr className="border-b border-linea text-suave">
                <th scope="col" className="py-2.5 pr-3 font-medium">
                  Nombre
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Correo
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Rol
                </th>
                <th scope="col" className="py-2.5 pl-3 font-medium">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-linea/70 last:border-0">
                  <td className="py-3 pr-3">
                    <span className="block font-medium text-texto">{u.nombreCompleto}</span>
                    <span className="block text-xs text-suave">Desde {fechaCorta(u.creadoEn)}</span>
                  </td>
                  <td className="px-3 py-3 break-all text-texto">{u.email}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-texto">{nombreRol(u.rol)}</td>
                  <td className="py-3 pl-3">
                    <EstadoCuenta activo={u.activo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Tarjeta>
  )
}

function EstadoCuenta({ activo }: { activo: boolean }) {
  return activo ? <Insignia color="verde">Activa</Insignia> : <Insignia>Inactiva</Insignia>
}

function FormularioUsuario({ alCrear }: { alCrear: () => void }) {
  const [form, setForm] = useState<Formulario>(VACIO)
  const [errores, setErrores] = useState<ErroresUsuario>({})
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [verContrasena, setVerContrasena] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [creada, setCreada] = useState<Usuario | null>(null)

  const refNombre = useRef<HTMLInputElement>(null)
  const refCorreo = useRef<HTMLInputElement>(null)
  const refContrasena = useRef<HTMLInputElement>(null)
  const refAviso = useRef<HTMLDivElement>(null)

  const cambiar = (campo: keyof Formulario, valor: string) => {
    const siguiente = { ...form, [campo]: valor }
    setForm(siguiente)
    setCreada(null)
    if (intento) setErrores(validarNuevoUsuario(siguiente))
  }

  const enfocarPrimerError = (e: ErroresUsuario) => {
    if (e.nombreCompleto) refNombre.current?.focus()
    else if (e.correo) refCorreo.current?.focus()
    else if (e.contrasenaInicial) refContrasena.current?.focus()
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando) return
    setIntento(true)
    setErrorGeneral(null)
    setCreada(null)

    const encontrados = validarNuevoUsuario(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return enfocarPrimerError(encontrados)

    setGuardando(true)
    try {
      const usuario = await crearUsuario({
        nombreCompleto: form.nombreCompleto.trim(),
        email: form.correo.trim().toLowerCase(),
        rol: form.rol as Rol,
        password: form.contrasenaInicial,
      })
      setCreada(usuario)
      setForm(VACIO)
      setIntento(false)
      setErrores({})
      setVerContrasena(false)
      alCrear()
      requestAnimationFrame(() => refAviso.current?.focus())
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 409) {
        const conflicto = { correo: 'Ya existe una cuenta con este correo.' }
        setErrores(conflicto)
        enfocarPrimerError(conflicto)
      } else {
        setErrorGeneral(
          error instanceof ErrorApi && error.estado === 400
            ? 'El servidor rechazó los datos. Revisa los campos e inténtalo de nuevo.'
            : mensajeErrorGeneral(error),
        )
        requestAnimationFrame(() => refAviso.current?.focus())
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta className="lg:sticky lg:top-6 lg:order-2">
      <h2 className="text-lg font-semibold text-verde-oscuro">Nueva cuenta</h2>
      <p className="mt-1 text-sm text-suave">Todos los campos son obligatorios.</p>

      <form noValidate onSubmit={guardar} className="mt-5">
        <fieldset disabled={guardando} className="space-y-5">
          <legend className="sr-only">Datos de la nueva cuenta</legend>

          <CampoTexto
            ref={refNombre}
            etiqueta="Nombre completo"
            name="nombreCompleto"
            autoComplete="off"
            value={form.nombreCompleto}
            onChange={(e) => cambiar('nombreCompleto', e.target.value)}
            error={errores.nombreCompleto}
          />

          <CampoTexto
            ref={refCorreo}
            etiqueta="Correo electrónico"
            name="correo"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={form.correo}
            onChange={(e) => cambiar('correo', e.target.value)}
            error={errores.correo}
            ayuda="Será su usuario para iniciar sesión."
          />

          <GrupoOpciones
            leyenda="Rol"
            nombre="rol"
            opciones={ROLES.map((r) => ({ valor: r.valor, nombre: r.nombre, descripcion: r.descripcion }))}
            valor={form.rol as Rol | ''}
            alCambiar={(rol) => cambiar('rol', rol)}
            error={errores.rol}
          />

          <div>
            <CampoTexto
              ref={refContrasena}
              etiqueta="Contraseña inicial"
              name="contrasenaInicial"
              type={verContrasena ? 'text' : 'password'}
              autoComplete="new-password"
              autoCapitalize="none"
              spellCheck={false}
              value={form.contrasenaInicial}
              onChange={(e) => cambiar('contrasenaInicial', e.target.value)}
              error={errores.contrasenaInicial}
              ayuda="Al menos 8 caracteres, con letras y números. Entrégala en persona."
              accesorio={
                <button
                  type="button"
                  onClick={() => setVerContrasena((v) => !v)}
                  aria-pressed={verContrasena}
                  className="absolute inset-y-0 right-0 mt-1.5 rounded-r-xl px-4 text-sm font-semibold text-naranja-texto hover:text-naranja focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-verde"
                >
                  {verContrasena ? 'Ocultar' : 'Mostrar'}
                </button>
              }
            />
            <Boton
              variante="texto"
              className="mt-1 -ml-2 text-sm"
              onClick={() => {
                cambiar('contrasenaInicial', generarContrasena())
                setVerContrasena(true)
              }}
            >
              Generar una contraseña segura
            </Boton>
          </div>

          {errorGeneral && (
            <Aviso ref={refAviso} tipo="error">
              {errorGeneral}
            </Aviso>
          )}
          {creada && (
            <Aviso ref={refAviso} tipo="exito">
              Cuenta creada para <strong>{creada.nombreCompleto}</strong> ({nombreRol(creada.rol)}). Ya puede iniciar
              sesión con {creada.email} y la contraseña inicial.
            </Aviso>
          )}

          <Boton type="submit" cargando={guardando} textoCargando="Creando cuenta…" className="w-full">
            Crear cuenta
          </Boton>
        </fieldset>
      </form>
    </Tarjeta>
  )
}
