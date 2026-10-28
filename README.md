# captura-cli

Herramienta de línea de comandos y API de código para agentes de IA que trabajan en una terminal. Deja evidencia
de lo que hizo el agente en el navegador, para que una persona la revise en minutos:

- capturas del viewport con una leyenda y una marca roja **dentro de la imagen**;
- `informe.md`, `casos.json` y `manifest.json` con los casos y su resultado;
- `publicar/`, la única carpeta que se sube a un MR o a un gestor de tareas;
- recetas: tramos de pantalla ya probados que se reutilizan, y borradores de las que faltan.

También corre pruebas de punta a punta bajo pedido a partir de un escenario en JSON.

> Versión 1.1.3: núcleo (API de código, 22 funciones), adaptadores, workspaces con registro guiado, configuración,
> escenarios (`validar`, `run`, `explorar`), `manifest.json`, avisos accionables, plugin de Claude Code, medición de
> tokens (`stats`) y mantenimiento (`doctor`, `limpiar`). Cambios: [CHANGELOG.md](CHANGELOG.md).

## Cómo se usa

captura-cli se instala **una vez en la máquina** y se llama desde cualquier workspace (cualquier repo o carpeta):

```sh
npm i -g --install-links github:BillalbertCode/captura-cli#v1.1.3     # una sola vez
cd <cualquier proyecto>
captura-cli run mi-flujo.json                                         # o cualquier otro comando
```

- **La primera vez en un workspace**, si hay una persona en la terminal, captura-cli pregunta si configurarlo ahora
  (dónde guardar las salidas, dónde viven la config y las recetas, si registrar estadísticas) y sigue con el comando.
  La primera vez en la máquina pregunta además una carpeta base para las salidas de todos los workspaces. No escribe
  nada en el repo.
- **Un agente no tiene teclado:** ahí no pregunta. Sale con el código 6 `WORKSPACE_NUEVO` e imprime las preguntas y el
  comando `captura-cli init --yes …`, para que el agente se las haga al usuario.
  `CAPTURA_INTERACTIVO=0` fuerza ese comportamiento; `CAPTURA_INTERACTIVO=1` fuerza preguntar leyendo la entrada
  (útil para dar las respuestas por tubería).
- **Salidas y proyecto son carpetas distintas.** Las *salidas* son las capturas e informes (por defecto, fuera del repo,
  en `~/.captura-cli/`); el *proyecto* es la config, los adaptadores y las recetas. Aunque el proyecto esté dentro del
  repo, las capturas siguen yendo a las salidas; para guardarlas ahí: `captura-cli config salidas <ruta>` (si cae
  dentro de un repo git, se excluye por `.git/info/exclude`). `init` imprime dónde quedó cada una.
- El workspace es la raíz del repo git (los worktrees cuentan como el mismo). Cada uno se configura una vez, se cambia
  con `captura-cli config` y tiene sus propias salidas, sesiones y caché.
- Instalarlo **solo en un proyecto** también se puede (`npm i -D github:BillalbertCode/captura-cli#v1.1.3` y
  `npx captura-cli …`). Es el caso adicional: ahí los scripts corren con `node` a secas.

## Instalación

No se publica en npm. Se instala desde GitHub, fijando una etiqueta de versión.

Requisitos: Node 20.6 o posterior, npm, git y acceso a GitHub. Los navegadores de Playwright se bajan aparte
(`captura-cli doctor --instalar`). Claude Code solo hace falta para el plugin. Probado solo en Windows.

### Global (recomendado): el comando `captura-cli` queda disponible en cualquier terminal

```sh
npm i -g --install-links github:BillalbertCode/captura-cli#v1.1.3
captura-cli --version
# 1.1.3
```

`--install-links` es necesario. Sin él, npm (10 y 11) instala un paquete de git en modo global como un enlace a la
carpeta temporal donde lo clonó; después borra esa carpeta y el comando falla con `Cannot find module …dist/cli.js`.
Con el flag, npm empaqueta el clon y deja una carpeta real con `dist/`, `LICENSE`, `README.md` y Playwright como
dependencia. No compila nada ni necesita TypeScript.

- Actualizar: el mismo comando con la etiqueta nueva (`#vX.Y.Z`).
- Desinstalar: `npm uninstall -g captura-cli`. Las salidas en `~/.captura-cli/` se conservan.
- Navegadores y todo lo demás: `captura-cli doctor` dice qué falta y cómo arreglarlo; `captura-cli doctor --instalar`
  baja el Chromium de Playwright si no está.

### Sin instalar: `npx`

```sh
npx --yes github:BillalbertCode/captura-cli#v1.1.3 --version
# 1.1.3
```

Ejecuta la herramienta desde la caché de npm sin dejar el comando en el PATH; cada llamada vuelve a resolver la
versión contra GitHub. Sirve para probarla o para fijar una versión en un proyecto, no para el uso diario.

### Respaldo: tarball de la etiqueta

```sh
npm i -g https://codeload.github.com/BillalbertCode/captura-cli/tar.gz/v1.1.3
```

No clona con git y no necesita `--install-links`, pero instala el repo completo (`src/`, `test/`, `docs/`), no solo
`dist/`.

### Estado de la verificación

Probado contra GitHub en Windows (npm 10.9.8 y Node 22 con la 1.0.0; npm 11.19.1 y Node 24 con la 1.0.1 y la 1.1.0),
con `--prefix` en una carpeta temporal:

| Vía | Resultado |
|---|---|
| «Computador nuevo» simulado con la 1.1.0 (2026-10-26): config de Claude limpia, sin claves SSH ni credenciales de git, caché de npm vacía | Funciona: `marketplace add` + `plugin install` (plugin 1.1.0), CLI desde la etiqueta, código 6, configurar y `run` con captura. Con npm 11 sigue haciendo falta `--install-links`. El hook de inicio, sin CLI, da el comando de instalación |
| `npm i -g --install-links github:…#v1.1.0` (2026-10-23) | Funciona: carpeta real, `--version` → `1.1.0`; en un workspace sin configurar, un agente recibe el código 6 y una persona en una terminal real (winpty) configura y el comando continúa, sin volver a preguntar después |
| `npm i -g --install-links github:…#v1.0.1` (2026-10-23) | Funciona: carpeta real, Playwright instalado, `--version` → `1.0.1` |
| Con esa copia: `doctor`, `init`, una app sin login declarada solo con `baseUrl`, `captura-cli script` con `import … from 'captura-cli'` y `captura-cli explorar /` desde Git Bash | Funciona: informe y captura generados |
| `npm i -g github:…` (sin el flag) | Falla: enlace al clon temporal, `MODULE_NOT_FOUND` (2026-10-21) |
| `npx --yes github:…`, `npm i github:…` (local) y `npm i -g <tarball de codeload>` | Funcionaron con la 1.0.0 (2026-10-21) |
| `npm i -g --install-links github:…#release/v1.0.0` en el global real (nvm4w) | Funcionó con la 1.0.0: `captura-cli` en el PATH, sale con 6 en una carpeta nueva |

No verificado: otro computador real (solo simulado en esta máquina); bajar Chromium con `doctor --instalar` (el CDN de
Playwright cerró la conexión desde esa red); macOS y Linux; la 1.0.1 y la 1.1.0 con `npx`, `npm i` local y el tarball (solo se probó la instalación global).

### Cómo se publica una versión (mantenedores)

1. `npm run release:preparar`: crea la rama `release/v<versión>` = HEAD + `dist/` compilado, sin el script
   `prepare` y sin tocar `main` ni la carpeta de trabajo.
2. Etiqueta `v<versión>` sobre ese commit y push de la etiqueta.
3. Actualizar `ref` en `.claude-plugin/marketplace.json` a la etiqueta nueva y commitear en `main`; si no, el plugin
   sigue en la versión anterior. La `url` va completa (`https://github.com/…`): la forma corta `owner/repo` clona por
   SSH y falla en un computador sin claves de GitHub.

Entre versiones, `dist/` no se versiona en `main`; `npm install` en el repo lo compila con `scripts/prepare.mjs`.

## Uso desde un script

```js
// prueba.mjs
import { sesion, marcar, foto, limpiar, caso } from 'captura-cli'

const { page, cerrar } = await sesion('editor', { ticket: 'TAREA-12', app: 'web' })   // app sin login: sesion(null, { ticket, app })
await marcar(page, page.getByRole('button', { name: 'Guardar' }), 'habilitado tras el cambio')
await foto(page, 'guardar-habilitado', { leyenda: 'El botón Guardar se habilita al completar el formulario' })
await limpiar(page)
caso(page, { nombre: 'guardar habilitado', esperado: 'habilitado', observado: 'habilitado', ok: true })
await cerrar({ ninguna: 'verificación puntual' })
```

```sh
cd <el repo que se prueba>
captura-cli script prueba.mjs [argumentos del script…]
```

- **Con la herramienta instalada en global hay que correrlo con `captura-cli script`.** `node prueba.mjs` falla con
  `ERR_MODULE_NOT_FOUND`, porque Node no busca los paquetes globales. `captura-cli script` corre el script en el
  mismo proceso y resuelve `captura-cli`, `captura-cli/correo` y `captura-cli/adaptadores` a la instalación que lo
  ejecuta; si el proyecto tiene su propia copia en `node_modules`, esa gana (y entonces `node prueba.mjs` también
  sirve). Las opciones de captura-cli (`--slot`, `--canal`, `--out`, `--config`) van antes del archivo; lo que va
  después es del script. El código de salida, el tope de tiempo y el cierre del navegador son los de siempre.
- Una app sin login (sin `login` en su config) se abre con `sesion(null, { app })`: sin rol, sin credenciales.
- La primera vez en un workspace, ver «Cómo se usa»: en una terminal te lo pide; un agente recibe el código 6.
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

Instalar el plugin **no instala el CLI**. Al abrir una sesión, el hook de inicio avisa si falta `captura-cli` y da el
comando exacto (`npm i -g --install-links github:BillalbertCode/captura-cli#v1.1.3`); Claude lo corre con tu permiso,
o se lo pides: «instala captura-cli». El plugin queda fijado a la etiqueta de la versión (`ref` en
`.claude-plugin/marketplace.json`), así que su skill coincide con el CLI de esa versión.
Para actualizarlo: `claude plugin marketplace update captura-cli` y `claude plugin update captura@captura-cli`;
reinicia la sesión de Claude Code para que aplique el cambio.

| Pieza | Qué hace |
|---|---|
| Skill `captura` | Reglas, flujo y códigos de salida para el agente, con `references/` (API, escenarios, recetas, datos, entorno, errores) |
| Hook de inicio | Una línea de contexto: si `captura-cli` está instalado y el estado del workspace; si no está, cómo instalarlo |
| Hook de cierre (opt-in) | Con `"evidencia": { "hook": true }` en el `captura.config.json` del proyecto: si el turno tocó archivos de interfaz y no dejó evidencia posterior (un `manifest.json` con capturas y recetas declaradas), le pide al agente que la deje o que termine con `SIN_EVIDENCIA: <motivo>`. Pide una sola vez por turno |

Los hooks nunca traban al agente: ante un error propio dejan seguir.

## Documentación

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
