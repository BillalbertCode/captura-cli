# Cambios

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
