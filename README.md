# Fundación Encuentro — Sistema de Gestión Clínica y Administrativa

Sistema web desarrollado para la Fundación Encuentro Jiwasanaka - La Paz, orientado a la digitalización y centralización de procesos clínicos terapéuticos y administrativos, facilitando la gestión de pacientes, casos, fichas clínicas, pagos e informes.

## Descripción del proyecto

El sistema busca mejorar la organización, accesibilidad y trazabilidad de la información institucional mediante una plataforma web que permita gestionar los registros clínicos y administrativos de forma estructurada.

La aplicación cuenta con un frontend desarrollado en React y una API REST construida con NestJS, conectada a una base de datos PostgreSQL.

## Funcionalidades principales

El proyecto contempla las siguientes funcionalidades:

- **Autenticación y usuarios:** inicio de sesión, gestión de usuarios y control de acceso por roles.
- **Gestión de pacientes:** registro y actualización de información de pacientes.
- **Gestión de casos:** creación, consulta y actualización de casos clínicos.
- **Gestión de carpetas:** consulta de carpetas y acceso según los permisos del usuario.
- **Asignación de terapeutas:** asignación y reasignación de profesionales a los casos.
- **Gestión clínica y administrativa:** funcionalidades relacionadas con fichas clínicas, pagos e informes, según el alcance del proyecto.

## Tecnologías utilizadas

| Componente | Tecnología |
|---|---|
| Frontend | React, Vite, TypeScript |
| Backend | NestJS, TypeScript |
| Base de datos | PostgreSQL |
| Servicio de base de datos | Supabase |
| API | REST |
| Documentación API | Swagger / OpenAPI |
| Control de versiones | Git y GitHub |

## Integrantes

**Grupo 7 — Universidad Católica Boliviana**

- Andrea Narváez
- Adriana Pando
- Jorge Calizaya
- Emilia Crespo
- Alejandro Bobarin
- Gemina Ponce

## Estructura del repositorio

```text
FundacionEncuentro/
├── backend/          # API REST con NestJS
├── frontend/         # Aplicación React + Vite
├── db/               # Scripts SQL versionados
├── docs/             # Documentación y especificaciones
│   └── api/          # Contrato entre frontend y backend
├── modelos/
│   └── c4/           # Diagramas de arquitectura C4
└── README.md         # Documentación general del proyecto
```

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/annetryoshka/FundacionEncuentro.git
cd FundacionEncuentro
```

### 2. Configurar el backend

Ingresar al directorio:

```bash
cd backend
```

Instalar las dependencias:

```bash
npm install
```

Crear el archivo `.env` a partir de `.env.example` y configurar las variables necesarias para la conexión a la base de datos y autenticación.

**Importante:** el archivo `.env` contiene información sensible y no debe subirse al repositorio.

Iniciar el servidor:

```bash
npm run start:dev
```

El backend estará disponible en:

http://localhost:3000

Para comprobar su funcionamiento:

http://localhost:3000/api/health

### 3. Configurar el frontend

Desde la raíz del proyecto:

```bash
cd frontend
npm install
npm run dev
```

Abrir en el navegador:

http://localhost:5173

Para utilizar el frontend, el backend debe estar ejecutándose.

### 4. Ejecutar el frontend en modo simulado

El proyecto también permite utilizar una API simulada en el navegador, sin necesidad de levantar el backend.

```bash
cd frontend
npm run dev:simulado
```

## Documentación de la API

El backend cuenta con documentación interactiva generada mediante **Swagger / OpenAPI**.

Con el backend en ejecución, acceder a:

**http://localhost:3000/api/docs**

Desde Swagger es posible:

- Consultar los endpoints disponibles.
- Revisar los métodos HTTP y sus parámetros.
- Visualizar ejemplos de solicitudes y respuestas.
- Consultar los códigos de respuesta HTTP.
- Identificar los endpoints que requieren autenticación.
- Probar solicitudes mediante la interfaz interactiva.

Los endpoints protegidos requieren autenticación mediante Bearer Token.

## Compilación del backend

Para verificar que el backend compile correctamente:

```bash
cd backend
npm run build
```

## Organización del desarrollo

El desarrollo del proyecto se realiza mediante Git y GitHub, utilizando ramas para organizar los cambios y Pull Requests para integrarlos a la rama principal.

Se emplean convenciones de commits según el tipo de modificación:

- `feat`: nuevas funcionalidades.
- `fix`: corrección de errores.
- `docs`: cambios en documentación.
- `test`: incorporación o actualización de pruebas.
- `chore`: tareas de mantenimiento y configuración.

## Documentación adicional

La documentación técnica y académica se encuentra organizada en los siguientes directorios:

- `docs/`: especificaciones, entrevistas, requisitos y trazabilidad.
- `docs/api/`: contrato de comunicación entre frontend y backend.
- `modelos/c4/`: diagramas de arquitectura del sistema.
- `db/`: scripts de base de datos.

---

**Fundación Encuentro — Proyecto académico SIS-213, Grupo 7.**
