# captura-cli

Herramienta de línea de comandos y API de código para agentes de IA que trabajan en una terminal. Deja evidencia
de lo que hizo el agente en el navegador, para que una persona la revise en minutos:

- capturas del viewport con una leyenda y una marca roja **dentro de la imagen**;
- `informe.md`, `casos.json` y `manifest.json` con los casos y su resultado;
- `publicar/`, la única carpeta que se sube a un MR o a un gestor de tareas;
- recetas: tramos de pantalla ya probados que se reutilizan, y borradores de las que faltan.

También corre pruebas de punta a punta bajo pedido a partir de un escenario en JSON.

> Estado: en construcción hacia la 1.0.0. Ya están el núcleo (API de código, 22 funciones), los adaptadores
> incluidos, el registro de workspaces, la configuración, los escenarios (`validar`, `run`, `explorar`),
> `manifest.json` y los avisos accionables (5xx, validaciones silenciosas). Faltan el plugin y la medición de tokens.

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
- Navegadores: la primera vez, `npx playwright install chromium` (si ya están en la máquina, no hace falta).

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
- Correo: `import { mailpit } from 'captura-cli/correo'`. Para escribir adaptadores propios: `captura-cli/adaptadores`.
- Sin escribir código: un escenario en JSON con `captura-cli validar` y `captura-cli run`, y `captura-cli explorar`
  para hallar selectores: [docs/escenarios.md](docs/escenarios.md).
- Configuración (`captura.config.json`, variables `CAPTURA_*`, `captura-cli config`): [docs/configuracion.md](docs/configuracion.md).
- Diferencias con la herramienta original: [docs/desviaciones.md](docs/desviaciones.md).

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
