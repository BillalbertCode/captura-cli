# Cambios

## 1.1.3 (2026-10-28)

Correcciones que salieron de usar la 1.1.2 en una tarea real (SUT-647, Portal).

- **`api()` ya no recorta la respuesta.** Devuelve `{ status, texto, json }`: el texto **completo** y el JSON parseado
  (`null` si no es JSON). Solo el log se recorta; el `JSON.parse` del script ya no falla a los 500 caracteres.
- **Repetir una corrida ya no pisa evidencia.** `--limpiar` (en `script` y `run`) vacía la carpeta del id antes de
  empezar (capturas, `publicar/` e informe). Al cerrar se avisa si `publicar/` tiene PNG que no están en el
  `manifest.json`: se subirían igual.
- **`explorar` pide el id como lo pide.** `--id <id>` en la línea de uso, `CAPTURA_ID=<id>` y un argumento suelto
  (solo si encaja con el patrón del config); el error dice cómo pasarlo. Git Bash: `sinConversionMsys` deshace
  también la conversión cuando `EXEPATH` apunta al bash (`…/Git/usr/bin/bash`), no solo cuando apunta a `…/Git/bin`.
- **React-select y «Element is outside of the viewport».** `abrirSelectHasta` trae el control a la vista, lo enfoca,
  abre el desplegable y elige la opción por rol `option`; el paso `click` de los escenarios hace
  `scrollIntoViewIfNeeded` antes de clicar y su error sugiere `elegir`.
- **`recetas-candidatas.md` ya no propone recetas imposibles.** El `verificar` sale de la URL y del texto de la app
  (con los números generalizados: `/\d+ En trámite/`), nunca de la etiqueta que escribió el agente.
- **Las corridas cuentan.** `captura-cli script` arranca el libro de uso: cada invocación queda contada con su código
  de salida, aunque falle antes de abrir el navegador. `stats` separa por tarea (`--id SUT-NN`) y lista las corridas
  por id.
- **Salud del entorno.** `entorno estado` consulta el `baseUrl` de cada app y avisa si alguna no responde; el config
  acepta `precondiciones` (comandos de solo lectura, p. ej. la VPN) que `sesion()` ejecuta antes de abrir la app y
  que fallan con un mensaje legible.
- **Esperas por dato.** `foto(..., { esperarRed: true })` espera a que la app termine de pedir datos antes de capturar;
  el paso `foto` del escenario acepta `esperarRed`.
- **La ayuda no trae el formato de id del proyecto.** Los ejemplos de `stats --id` y `explorar` son neutros; el
  formato sale de `id.patron` en el config.

## 1.1.2 (2026-10-26)

Lo que salió de la prueba de instalación desde cero con un Claude sin contexto, en un proyecto sin autenticación.

- **Salidas y proyecto.** Las capturas no iban a la carpeta del proyecto: `salidas` y `proyecto` son carpetas
  distintas y la herramienta no lo decía. Las preguntas de `init` ahora lo aclaran, y `init` termina diciendo dónde
  quedó cada cosa; si el proyecto está dentro del repo y las salidas no, avisa que las capturas NO van ahí y da el
  comando para moverlas (`captura-cli config salidas <ruta>`).
- **Cuál salida aplica.** `init` y `config` dicen si las salidas son una ruta propia del workspace o el valor por
  defecto. La ruta propia manda sobre la global (`salidas-base`), que solo se propone al registrar un workspace nuevo
  y no mueve los ya registrados. `config` lo imprime en `salidas-origen:`; la línea `salidas:` sigue siendo solo la ruta.

## 1.1.1 (2026-10-26)

Sin cambios de código. Empaqueta lo que se corrigió después de etiquetar la 1.1.0.

- **Plugin fijado a la etiqueta.** `.claude-plugin/marketplace.json` apunta al plugin de la etiqueta de la versión
  (`git-subdir` con `ref` y URL https completa; la forma corta `owner/repo` clona por SSH y falla sin claves de GitHub).
- README: el plugin no instala el CLI (el hook de inicio da el comando), requisitos, npm 10 y 11 necesitan
  `--install-links`, y lo verificado en un «computador nuevo» simulado.

## 1.1.0 (2026-10-23)

Primer uso guiado: el propósito es instalar una vez en la máquina y llamarlo desde cualquier workspace.

- **Un workspace sin configurar se configura al usarlo.** Con una persona en la terminal, cualquier comando que necesite
  el workspace (`run`, `validar`, `explorar`, `recetas`, `config`, `script`, …) ofrece configurarlo y sigue con el
  comando; antes solo `init` preguntaba y los demás salían con 6. La primera vez en la máquina pregunta además una
  carpeta base para las salidas de todos los workspaces. Ctrl+C, decir que no o cerrar la entrada no guarda nada.
  Sin terminal (un agente) no cambia nada: sale con 6 y las preguntas. `CAPTURA_INTERACTIVO=0|1` fuerza un modo u otro.
- `doctor` ya no sugiere `config` sino `init` para un workspace sin registrar; `doctor` y los hooks nunca preguntan.
- README reordenado: «Cómo se usa» (instalar una vez, usar en cualquier workspace) antes de la instalación; instalarlo
  solo en un proyecto queda como el caso adicional.

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
- **Git Bash en Windows.** `captura-cli explorar /ruta` fallaba: Git Bash convierte un argumento que empieza con `/`
  en una ruta de Windows (`/bandeja` llegaba como `C:/…/Git/bandeja`). El CLI deshace esa conversión (solo si el
  prefijo es exactamente la raíz de Git) y el error, si la ruta sigue mal, nombra el motivo y `MSYS_NO_PATHCONV=1`.
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
