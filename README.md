# captura-cli

Herramienta de línea de comandos y API de código para agentes de IA que trabajan en una terminal. Deja evidencia
de lo que hizo el agente en el navegador, para que una persona la revise en minutos:

- capturas del viewport con una leyenda y una marca roja **dentro de la imagen**;
- `informe.md`, `casos.json` y `manifest.json` con los casos y su resultado;
- `publicar/`, la única carpeta que se sube a un MR o a un gestor de tareas;
- recetas: tramos de pantalla ya probados que se reutilizan, y borradores de las que faltan.

También corre pruebas de punta a punta bajo pedido a partir de un escenario en JSON.

> Versión 1.0.0: núcleo (API de código, 22 funciones), adaptadores, workspaces, configuración, escenarios
> (`validar`, `run`, `explorar`), `manifest.json`, avisos accionables, plugin de Claude Code, medición de tokens
> (`stats`) y mantenimiento (`doctor`, `limpiar`). Cambios: [CHANGELOG.md](CHANGELOG.md).

## Instalación

No se publica en npm. Se instala desde GitHub, fijando una etiqueta de versión.

### Global (recomendado): el comando `captura-cli` queda disponible en cualquier terminal

```sh
npm i -g --install-links github:BillalbertCode/captura-cli#v1.0.0
captura-cli --version
# 1.0.0
```

`--install-links` es necesario. Sin él, npm 10 instala un paquete de git en modo global como un enlace a la
carpeta temporal donde lo clonó; después borra esa carpeta y el comando falla con `Cannot find module …dist/cli.js`.
Con el flag, npm empaqueta el clon y deja una carpeta real con `dist/`, `LICENSE`, `README.md` y Playwright como
dependencia. No compila nada ni necesita TypeScript.

- Actualizar: el mismo comando con la etiqueta nueva (`#v1.1.0`).
- Desinstalar: `npm uninstall -g captura-cli`. Las salidas en `~/.captura-cli/` se conservan.
- Navegadores y todo lo demás: `captura-cli doctor` dice qué falta y cómo arreglarlo; `captura-cli doctor --instalar`
  baja el Chromium de Playwright si no está.

### Sin instalar: `npx`

```sh
npx --yes github:BillalbertCode/captura-cli#v1.0.0 --version
# 1.0.0
```

Ejecuta la herramienta desde la caché de npm sin dejar el comando en el PATH; cada llamada vuelve a resolver la
versión contra GitHub. Sirve para probarla o para fijar una versión en un proyecto, no para el uso diario.

### Respaldo: tarball de la etiqueta

```sh
npm i -g https://codeload.github.com/BillalbertCode/captura-cli/tar.gz/v1.0.0
```

No clona con git y no necesita `--install-links`, pero instala el repo completo (`src/`, `test/`, `docs/`), no solo
`dist/`.

### Estado de la verificación

Probado contra GitHub el 2026-10-21 (npm 10.9.8, Node 22, Windows) sobre el commit de release, con `--prefix` en
una carpeta temporal:

| Vía | Resultado |
|---|---|
| `npm i -g --install-links github:…` | Funciona: carpeta real, Playwright instalado, `--version` → `1.0.0` |
| `npm i -g github:…` (sin el flag) | Falla: enlace al clon temporal, `MODULE_NOT_FOUND` |
| `npx --yes github:…` | Funciona: `1.0.0` |
| `npm i github:…` (local) | Funciona: `1.0.0` |
| `npm i -g <tarball de codeload>` | Funciona: `1.0.0` |
| `npm i -g --install-links github:…#release/v1.0.0` en el global real (nvm4w) | Funciona: `captura-cli` en el PATH, `--version` → `1.0.0`, sale con 6 en una carpeta nueva |

No verificado: macOS y Linux.

### Cómo se publica una versión (mantenedores)

1. `npm run release:preparar`: crea la rama `release/v<versión>` = HEAD + `dist/` compilado, sin el script
   `prepare` y sin tocar `main` ni la carpeta de trabajo.
2. Etiqueta `v<versión>` sobre ese commit y push de la etiqueta.

Entre versiones, `dist/` no se versiona en `main`; `npm install` en el repo lo compila con `scripts/prepare.mjs`.

## Uso desde un script

```js
import { sesion, marcar, foto, limpiar, caso } from 'captura-cli'

const { page, cerrar } = await sesion('editor', { ticket: 'TAREA-12', app: 'web' })
await marcar(page, page.getByRole('button', { name: 'Guardar' }), 'habilitado tras el cambio')
await foto(page, 'guardar-habilitado', { leyenda: 'El botón Guardar se habilita al completar el formulario' })
await limpiar(page)
caso(page, { nombre: 'guardar habilitado', esperado: 'habilitado', observado: 'habilitado', ok: true })
await cerrar({ ninguna: 'verificación puntual' })
```

- La primera vez en una carpeta sale con código 6 y explica cómo registrarla (`captura-cli init --yes …`).
- Credenciales por defecto: `CAPTURA_<ROL>_USUARIO` y `CAPTURA_<ROL>_CLAVE`, en `.env` o en el entorno.
- Correo: `import { mailpit } from 'captura-cli/correo'`.
- Lo propio de un proyecto (credenciales, formato de id, servicios, publicación, correo) entra por adaptadores:
  [docs/adaptadores.md](docs/adaptadores.md) (`captura-cli adaptador nuevo <tipo>` crea una plantilla).
- Instrucciones para el agente (skill corta con referencias): [plugin/skills/captura/SKILL.md](plugin/skills/captura/SKILL.md).

## Plugin de Claude Code

El plugin `captura` trae la skill y dos hooks. Necesita el comando `captura-cli` instalado en global (ver arriba).

```sh
claude plugin marketplace add BillalbertCode/captura-cli
claude plugin install captura@captura-cli
```

En una sesión (Claude Code 2.1.275 o posterior): `/plugin install captura --marketplace BillalbertCode/captura-cli`.

| Pieza | Qué hace |
|---|---|
| Skill `captura` | Reglas, flujo y códigos de salida para el agente, con `references/` (API, escenarios, recetas, datos, entorno, errores) |
| Hook de inicio | Una línea de contexto: si `captura-cli` está instalado y el estado del workspace; si no está, cómo instalarlo |
| Hook de cierre (opt-in) | Con `"evidencia": { "hook": true }` en el `captura.config.json` del proyecto: si el turno tocó archivos de interfaz y no dejó evidencia posterior (un `manifest.json` con capturas y recetas declaradas), le pide al agente que la deje o que termine con `SIN_EVIDENCIA: <motivo>`. Pide una sola vez por turno |

Los hooks nunca traban al agente: ante un error propio dejan seguir.
- Sin escribir código: un escenario en JSON con `captura-cli validar` y `captura-cli run`, y `captura-cli explorar`
  para hallar selectores: [docs/escenarios.md](docs/escenarios.md).
- Configuración (`captura.config.json`, variables `CAPTURA_*`, `captura-cli config`): [docs/configuracion.md](docs/configuracion.md).
- Medir tokens (libro de uso, `captura-cli stats`, transcritos de Claude Code): [docs/medicion.md](docs/medicion.md).
- Diferencias con la herramienta original: [docs/desviaciones.md](docs/desviaciones.md).

## Mantenimiento

```sh
captura-cli doctor                 # Node, Playwright, navegadores, workspace, config y adaptadores
captura-cli limpiar                # lista residuos del almacén y cuánto liberan (no borra nada)
captura-cli limpiar --aplicar      # los borra: temporales huérfanos, caché de más de 14 días, sesiones vencidas
captura-cli limpiar --antes 30d    # suma las capturas sin cambios en 30 días (también solo lista sin --aplicar)
```

`limpiar` borra solo dentro de su propio almacén (`~/.captura-cli/workspaces/<nombre>-<hash>/`), archivo por archivo y
comprobando cada ruta; nunca hace un borrado recursivo de una carpeta que se le pase. Si las salidas se configuraron
fuera del almacén, no las toca. La caché de cada slot además caduca sola: `entorno levantar` borra la de más de 14 días.

## Principios

- **Agnóstico.** El núcleo no sabe nada de ningún proyecto. Credenciales, formato de id, entorno, publicación y
  correo entran por adaptadores con contrato versionado; los que conocen un proyecto viven fuera de este repo.
- **El repo que se prueba queda limpio.** Las salidas van a `~/.captura-cli/workspaces/<nombre>-<hash>/`, salvo
  que el usuario elija otra ruta.
- **Pensado para agentes.** Códigos de salida estables y mensajes que dicen qué hacer:

| Código | Significa |
|---|---|
| 0 | Todo bien |
| 1 | Cualquier otro error, con el texto exacto |
| 2 | Escenario inválido |
| 3 | `FALTAN_CREDENCIALES`: nombra las variables exactas |
| 4 | `TIMEOUT_GLOBAL`: se superó el tope; navegador cerrado |
| 5 | Hubo tramos sin receta y no se declaró qué pasó |
| 6 | `WORKSPACE_NUEVO`: imprime las preguntas para registrar la carpeta |
| 7 | `PAGINA_COLGADA`: la página se colgó; navegador cerrado |

## Desarrollo

```sh
npm install      # compila dist/ con el script prepare
npm test         # compila y corre las pruebas de adaptadores y de paridad
```

Ver [test/paridad/README.md](test/paridad/README.md).

## Licencia

MIT
