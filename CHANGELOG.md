# Cambios

## 1.0.1 (2026-10-23)

Dos correcciones que salieron de preparar una prueba de instalación desde cero en un proyecto sin autenticación.

- **Apps sin login.** Una app se declara solo con `baseUrl` (sin `login`): `sesion(null, { app })`, `captura-cli run` y
  `captura-cli explorar` la abren en su `inicio` sin rol, sin credenciales y sin sesión guardada. En 1.0.0 la config
  exigía `login`, `boton` y `postLogin` en toda app, y el escenario exigía `rol`. Declarar `boton`, `postLogin` o los
  campos sin `login` es un error que lo explica; una app con login y sin rol también. Si la app no responde, el error
  dice qué URL intentó abrir.
- **Scripts con la instalación global.** `import … from 'captura-cli'` fallaba con `ERR_MODULE_NOT_FOUND` cuando la
  herramienta estaba instalada en global (Node no resuelve paquetes globales). Nuevo: `captura-cli script <archivo>
  [args…]`, que corre el script en el mismo proceso resolviendo `captura-cli`, `captura-cli/correo` y
  `captura-cli/adaptadores` a la instalación que lo ejecuta; una copia propia del proyecto en `node_modules` gana. El
  README y la skill ahora dicen cómo correr los scripts.
- Node 20.6 o posterior (`module.register`).

## 1.0.0 (2026-10-22)

Primera versión instalable: `npm i -g --install-links github:BillalbertCode/captura-cli#v1.0.0`.

- **Núcleo**: API de código con las 22 funciones de la herramienta original (mismo nombre y aridad), probadas con
  pruebas de paridad contra ella. Las diferencias deliberadas están en [docs/desviaciones.md](docs/desviaciones.md).
- **Evidencia**: capturas del viewport con leyenda y marca roja dentro de la imagen, `informe.md`, `casos.json`,
  `manifest.json` (con `sha256` de cada captura) y `publicar/`.
- **Adaptadores** con contrato versionado (`contrato: 1`): credenciales, identificador, entorno, publicación y correo.
  Incluidos: `env`, `patron`, `comando`, `carpeta`, `mailpit`. Guía: [docs/adaptadores.md](docs/adaptadores.md).
- **Workspaces**: salidas fuera del repo (`~/.captura-cli/workspaces/<nombre>-<hash>/`), registro la primera vez
  (código 6 `WORKSPACE_NUEVO`), slots para varios agentes a la vez.
- **Configuración** neutra con errores accionables y esquema para el editor: [docs/configuracion.md](docs/configuracion.md).
- **Escenarios** en JSON con `captura-cli validar` (código 2), `run` y `explorar`: [docs/escenarios.md](docs/escenarios.md).
- **Avisos**: `AVISO_5XX` con URL, status y paso; validaciones silenciosas con `explorar --errores`; página colgada
  (código 7 `PAGINA_COLGADA`).
- **Plugin de Claude Code** `captura`: skill con referencias, hook de inicio y hook de cierre opt-in.
- **Medición**: libro `uso.jsonl`, `captura-cli stats` y `stats --transcrito` con los tokens reales de una sesión:
  [docs/medicion.md](docs/medicion.md).
- **Mantenimiento**: `captura-cli doctor` y `captura-cli limpiar`.

Pendiente: comparar un flujo real contra la ronda de referencia (procedimiento en [docs/medicion.md](docs/medicion.md)).
