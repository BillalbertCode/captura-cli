# Configuración

captura-cli se configura en tres lugares. Ninguno trae nombres, prefijos ni patrones de un proyecto concreto.

| Dónde | Qué guarda | Cómo se cambia |
|---|---|---|
| `~/.captura-cli/config.json` (o `CAPTURA_HOME`) | Valores del usuario: `salidasBase` | `captura-cli config salidas-base <ruta\|ninguna>` |
| `~/.captura-cli/workspaces/<nombre>-<hash>/workspace.json` | Lo respondido al registrar la carpeta: `salidas`, `proyecto`, `estadisticas` | `captura-cli init --yes …` la primera vez; después `captura-cli config <clave> <valor>` |
| `<proyecto>/captura.config.json` | Apps, formato de id, credenciales, rutas, adaptadores | Editándolo. `captura-cli config` muestra el resultado efectivo |

## Orden de precedencia

De mayor a menor: variable de entorno > `captura.config.json` > registro del workspace > valor por defecto.

| Variable | Reemplaza |
|---|---|
| `CAPTURA_HOME` | El almacén `~/.captura-cli` |
| `CAPTURA_CONFIG` | La ruta del `captura.config.json` |
| `CAPTURA_OUT` | `rutas.salidas` y la carpeta de salidas registrada |
| `CAPTURA_RECETAS` | `rutas.recetas` |
| `CAPTURA_SLOT` | El slot de la corrida (`N` o `auto`; por defecto 0) |
| `CAPTURA_CANAL` | El navegador: `msedge` o `chrome` instalado en lugar del Chromium de Playwright |
| `CAPTURA_INTERACTIVO` | `0`: nunca preguntar (sale con 6 y las preguntas, como con un agente). `1`: preguntar leyendo la entrada aunque no sea una terminal (respuestas por tubería). Sin definir: pregunta solo si hay terminal |

### Primer uso de un workspace

Un workspace es la raíz del repo git (o la carpeta, si no hay git); los worktrees cuentan como el mismo. Se configura
una vez:

- **Con una persona en la terminal**, cualquier comando que necesite el workspace (`run`, `validar`, `explorar`,
  `recetas`, `config`, `script`, …) ofrece configurarlo y sigue: dónde van las salidas, dónde viven la config, los
  adaptadores y las recetas, y si registrar estadísticas. La primera vez en la máquina pregunta además una carpeta base
  para las salidas de todos los workspaces (`captura-cli config salidas-base <ruta>` la cambia después). Si dices que
  no, o cancelas con Ctrl+C, no se guarda nada y el comando sale con 6.
- **Sin terminal** (un agente), no pregunta: sale con el código 6 `WORKSPACE_NUEVO`, imprime las preguntas y el comando
  `captura-cli init --yes --salidas global --proyecto "<ruta>" --estadisticas si`.
- `doctor` y los hooks del plugin nunca preguntan: solo informan.

## captura.config.json

Todas las claves son opcionales. Las rutas relativas se resuelven desde la carpeta del archivo. Una clave desconocida
es un error (`CONFIG_INVALIDA`, código 1) con la corrección sugerida; así un typo no pasa en silencio. El esquema
`schema/captura.config.schema.json` da autocompletado en el editor: `init` lo deja en `$schema`.

| Clave | Por defecto | Qué es |
|---|---|---|
| `viewport` | `{ "width": 1366, "height": 900 }` | Tamaño de las capturas |
| `sesionMin` | `15` | Minutos que vale una sesión guardada; `0` = login siempre |
| `apps` | `{}` | Apps a probar, por nombre (ver abajo). Con una sola, `sesion()` la usa sin `{ app }` |
| `id.patron` | `^[A-Za-z0-9._-]+$` | Formato del id de cada corrida |
| `id.mayusculas` | `true` | La carpeta del id va en mayúsculas |
| `credenciales.archivo` | `.env` | Archivo de variables del adaptador `builtin:env` |
| `credenciales.prefijo` | `CAPTURA_` | Prefijo: `<prefijo><ROL>_USUARIO` y `<prefijo><ROL>_CLAVE` |
| `credenciales.alias` | `{}` | Rol → nombre en las variables: `{ "jefe de área": "JEFE" }` |
| `rutas.salidas` | almacén del workspace | Carpeta de las capturas (una subcarpeta por id) |
| `rutas.recetas` | `<proyecto>/recetas` | Catálogo de recetas (`<app>.mjs`, `comun.mjs`) |
| `rutas.helpers` | `<proyecto>/helpers` | Funciones propias del proyecto |
| `rutas.escenarios` | `<proyecto>/escenarios` | Escenarios guardados |
| `rutas.sesiones` | almacén, por slot | Sesiones guardadas. Tienen cookies de usuarios reales |
| `adaptadores.<tipo>` | el incluido neutro | `credenciales`, `identificador`, `entorno`, `publicacion`, `correo` |
| `extras` | `[]` | `["correo"]` carga `builtin:mailpit` si no hay `adaptadores.correo` |
| `evidencia.hook` | `false` | Activa el hook de cierre del plugin de Claude Code: exige evidencia si el turno tocó la interfaz |
| `evidencia.patrones` | `**/*.tsx`, `**/*.jsx`, `**/*.vue`, `**/*.svelte`, `**/*.html`, `**/*.css`, `**/*.scss` | Qué archivos cuentan como interfaz (globs relativos a la raíz del repo) |
| `evidencia.horas` | `12` | Hasta cuántas horas atrás cuentan los commits como «del turno» (lo sin commitear siempre cuenta) |

El rol se normaliza para las variables: sin acentos, en mayúsculas y con `_` en lugar de espacios o signos. Así,
`"jefe de área"` se lee de `CAPTURA_JEFE_DE_AREA_USUARIO`. Las variables del entorno del proceso mandan sobre el
archivo.

Si `rutas.salidas` o `rutas.sesiones` caen dentro de un repo git, se agregan a `.git/info/exclude` (el `.gitignore`
versionado no se toca) y se avisa una vez.

### Una app

```json
{
  "apps": {
    "web": {
      "baseUrl": "http://localhost:5173",
      "login": "/login",
      "campoUsuario": "input[name=email]",
      "campoClave": "input[name=password]",
      "boton": "Entrar",
      "postLogin": "**/inicio",
      "inicio": "/inicio",
      "cookieSesion": null,
      "apiBase": "/api"
    }
  }
}
```

| Clave | Obligatoria | Qué es |
|---|---|---|
| `baseUrl` | sí | `http(s)://host[:puerto]`. Con slots, el adaptador de entorno la ajusta |
| `login` | no | Ruta de la pantalla de login. **Sin ella, la app no tiene login** (ver abajo) |
| `campoUsuario`, `campoClave` | con `login`, salvo que haya `campos` | Selectores de los campos |
| `campos` | no | Login con varios campos: `[{ "selector": "…", "valor": "usuario\|clave\|letra\|numero" }]`. `letra` y `numero` parten un usuario como `A-12345` |
| `boton` | con `login` | Nombre accesible del botón de entrar |
| `postLogin` | con `login` | Patrón de URL que confirma el login |
| `inicio` | no | Ruta donde se abre la app (y con la que se comprueba una sesión guardada). Por defecto `/` |
| `cookieSesion` | no | Cookie con el token que `api()` manda como `Bearer`. `null` o sin declarar: `api()` usa las cookies del navegador |
| `apiBase` | no | Prefijo de las rutas de `api()` |

### Una app sin login

Una app sin autenticación se declara solo con `baseUrl` (y, si hace falta, `inicio` y `apiBase`):

```json
{ "apps": { "web": { "baseUrl": "http://localhost:5173", "inicio": "/", "apiBase": "/api" } } }
```

- `sesion(null, { app })` (en un script) y `captura-cli run` / `explorar` la abren en su `inicio`: no piden rol, no
  usan credenciales y no guardan sesión. Un escenario de una app sin login no lleva `rol`, y `explorar` no necesita
  `--rol`.
- `boton`, `postLogin`, `campos`, `campoUsuario` y `campoClave` solo tienen sentido con `login`: declararlos sin él es
  un error que lo dice (casi siempre falta `login`).
- Si la app no responde, el error dice qué URL se intentó abrir y que se revise con `captura-cli entorno estado`.
- En una app **con** login, falta de rol es un error claro: `sesion(): la app web tiene login; falta el rol`.

Se permiten claves propias dentro de una app (por ejemplo, datos que lee un adaptador de entorno), salvo que se
parezcan a una conocida: `botton` es un error que sugiere `boton`.

### Adaptadores

```json
{
  "adaptadores": {
    "identificador": { "usa": "builtin:patron", "patron": "^TAREA-\\d+$" },
    "entorno": { "usa": "builtin:comando", "comandos": { "levantar": "./servicios.sh levantar {app} --slot={slot}" }, "puertoPorSlot": 100 },
    "publicacion": "./adaptadores/publicar.mjs"
  }
}
```

`"builtin:<nombre>"` usa uno incluido; una ruta usa un módulo propio. `{ "usa": …, …opciones }` le pasa opciones.
`captura-cli adaptadores verificar` comprueba cada uno contra el contrato. Cómo escribir uno: `docs/adaptadores.md`.

## Claves de la herramienta original

| Clave | Qué hacer |
|---|---|
| `salida` | `"rutas": { "salidas": "…" }`, o nada (almacén global) |
| `playwrightDesde` | Quitarla: Playwright viene incluido |
| `apps.<app>.stack` | Va en las opciones del adaptador de entorno |
