# Cómo escribir un adaptador

captura-cli no sabe nada de ningún proyecto. Lo que un proyecto tiene de propio entra por **adaptadores**: de dónde
salen las credenciales, qué formato tiene un id, cómo se levantan sus servicios, dónde se publica la evidencia y de
dónde se lee el correo. Esta guía alcanza para escribir uno sin leer el código de la herramienta.

- Los adaptadores **incluidos** (`builtin:*`) son genéricos y vienen con la herramienta.
- Los **propios** son un archivo `.mjs` en la carpeta del proyecto (la que se registró con `captura-cli init`), nunca
  en el repo de captura-cli. Ahí pueden tener nombres, prefijos y servicios del proyecto.

```sh
captura-cli adaptador nuevo credenciales        # plantilla en <proyecto>/adaptadores/credenciales.mjs
captura-cli adaptadores verificar               # comprueba cada adaptador declarado contra el contrato
```

## El contrato (versión 1)

Un adaptador es un módulo ES (`.mjs`) cuyo `export default` es una **fábrica**:

```js
export default {
  contrato: 1,                 // versión del contrato que cumple
  tipo: 'credenciales',        // credenciales | identificador | entorno | publicacion | correo
  crear(opciones, contexto) {  // se llama una vez por corrida; devuelve la instancia
    return { resolver(rol, app) { /* … */ } }
  },
}
```

Se declara en `captura.config.json`. Las rutas son relativas a la carpeta del config. Las claves junto a `usa` llegan
como `opciones`:

```json
{
  "adaptadores": {
    "credenciales": { "usa": "./adaptadores/credenciales.mjs", "prefijo": "E2E_" },
    "identificador": "builtin:patron",
    "entorno": { "usa": "./adaptadores/entorno.mjs", "script": "./scripts/servicios.sh" }
  }
}
```

`contexto` trae rutas absolutas:

| Campo | Qué es |
|---|---|
| `raiz` | Raíz del workspace (el repo que se prueba; la copia principal aunque se esté en un worktree) |
| `base` | Carpeta del `captura.config.json` (o la raíz si no hay config): base para rutas relativas |
| `slot` | Slot de esta corrida (`CAPTURA_SLOT` o `--slot`; 0 por defecto) |
| `dirSlot` | Carpeta propia del slot en el almacén: ahí puede guardar lo suyo (registro de servicios, caché) |

Un tipo sin declarar usa su incluido neutro: `env`, `patron`, `comando` y `carpeta`. El correo no tiene uno por
defecto: se activa declarándolo o con `"extras": ["correo"]` (que usa `builtin:mailpit`).

Reglas para todos:

- **No esperar teclado** ni dejar procesos colgados: todo comando con tope de tiempo y sin stdin.
- **Falta configuración:** lanzar un error con `name: 'FaltaConfiguracion'`. La herramienta sale con
  `FALTAN_CREDENCIALES` (código 3) y el mensaje, para que el agente se lo pida al usuario:
  `throw Object.assign(new Error('definir MI_URL'), { name: 'FaltaConfiguracion' })`.
- **Nada de secretos en el adaptador:** se leen del entorno o de un archivo fuera de cualquier repo público.

## credenciales

```ts
resolver(rol: string, app?: string): { usuario, clave, letra, numero } | { faltan: string[], donde: string }
```

Es **síncrono**: `credenciales(rol)` lo es en la API. Si falta algo, devuelve `faltan` con las variables exactas en
orden y `donde` (un archivo o una descripción). La herramienta sale con 3:

```
FALTAN_CREDENCIALES: <rol> -> definir <faltan, separadas por coma> en <donde>, o pedírselas al usuario
```

`letra` y `numero` son para logins que parten el usuario en dos campos (`A-12345` → `A` y `12345`). Si no aplica,
`letra: ''` y `numero: usuario`.

```js
export default {
  contrato: 1,
  tipo: 'credenciales',
  crear(opciones) {
    const prefijo = opciones.prefijo ?? 'E2E_'
    const alias = { 'jefe de área': 'JEFE', ...(opciones.alias ?? {}) }
    const nombre = (rol) => rol.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')
    return {
      resolver(rol) {
        const p = alias[rol] ?? nombre(rol)
        const vu = `${prefijo}${p}_IDENTIFIER`, vc = `${prefijo}${p}_PASSWORD`
        const usuario = process.env[vu], clave = process.env[vc]
        if (!usuario || !clave) return { faltan: [...(usuario ? [] : [vu]), ...(clave ? [] : [vc])], donde: '.env del proyecto' }
        return { usuario, clave, letra: usuario.match(/^[A-Za-z]/)?.[0] ?? '', numero: usuario.replace(/^[A-Za-z]-?/, '') }
      },
    }
  },
}
```

Incluido `builtin:env`: lee `<prefijo><ROL>_USUARIO` y `_CLAVE` de un archivo `.env` y del entorno (el entorno
manda). Sus opciones salen de la sección `credenciales` del config: `archivo`, `prefijo` y `alias`.

## identificador

```ts
validar(id: string): string | null   // null si es válido; si no, el mensaje
carpeta(id: string): string          // nombre de la carpeta de salida
```

Un id inválido hace fallar `abrir()`/`sesion()` con ese mensaje, y `captura-cli validar`/`run` lo listan como
`id: <mensaje>` (código 2).

```js
export default {
  contrato: 1,
  tipo: 'identificador',
  crear(opciones) {
    const re = new RegExp(opciones.patron ?? '^TAREA-\\d+$', 'i')
    return {
      validar: (id) => (re.test(id ?? '') ? null : `id requerido, formato TAREA-NN (recibido: "${id ?? ''}")`),
      carpeta: (id) => id.toUpperCase(),
    }
  },
}
```

Incluido `builtin:patron`: opciones `patron` (por defecto `^[A-Za-z0-9._-]+$`) y `mayusculas` (por defecto `true`).
Las toma de la sección `id` del config.

## entorno

```ts
url(app: string, cfg: AppConfig, slot: number): string                              // obligatorio
levantar?(app: string, { slot, args }): Promise<{ ok: boolean, salida: string }>
estado?({ slot }): Promise<{ ok: boolean, salida: string }>
parar?(app: string | undefined, { slot }): Promise<{ ok: boolean, salida: string }>
```

- `url` da la URL base de la app en ese slot. `sesion()` la usa en lugar de `baseUrl`.
- `levantar`, `estado` y `parar` son opcionales. Los corre `captura-cli entorno <comando>`, que sale con 0 si
  `ok` y con 1 si no, e imprime `salida` (una línea por servicio es lo más útil para un agente).
- **Slots:** la herramienta solo separa por slot lo que guarda (sesiones, caché, `dirSlot`). Qué significa un slot
  para los servicios (otro bloque de puertos, otra caché de bundler) lo decide este adaptador.
- **`parar` cierra solo lo del slot propio** y solo lo que el adaptador levantó (llevar un registro en `dirSlot`).
  Nunca procesos ajenos ni por nombre.

```js
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

export default {
  contrato: 1,
  tipo: 'entorno',
  crear(opciones, contexto) {
    const script = join(contexto.base, opciones.script ?? './servicios.sh')
    const correr = (...args) => {
      const r = spawnSync('bash', [script, ...args], { encoding: 'utf8', timeout: 400000, stdio: ['ignore', 'pipe', 'pipe'] })
      return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() || String(r.error ?? '') }
    }
    return {
      url(app, cfg, slot) {
        if (!slot) return cfg.baseUrl
        const u = new URL(cfg.baseUrl)
        u.port = String(Number(u.port) + 100 * slot)
        return u.origin
      },
      levantar: async (app, { slot, args }) => correr('levantar', app, ...args, `--slot=${slot}`),
      estado: async () => correr('estado'),
      parar: async (app, { slot }) => correr('parar', ...(app ? [app] : []), `--slot=${slot}`),
    }
  },
}
```

Incluido `builtin:comando`: ejecuta comandos de la config sin escribir código. Opciones: `comandos` (`levantar`,
`estado` y `parar`, con los marcadores `{app}`, `{slot}` y `{args}`), `cwd`, `timeoutSeg` (400) y `puertoPorSlot`
(suma `n·slot` al puerto de la URL). Los comandos reciben `CAPTURA_SLOT` en el entorno.

## publicacion

```ts
publicar(carpeta: string, id: string): Promise<void>
```

Se llama al cerrar, después de escribir `informe.md`, `casos.json` y `manifest.json`. `carpeta` es la del id;
adentro están `publicar/` (lo único que se sube) y `manifest.json`, con cada captura, su ruta en `publicar/` y su
`sha256`. Si falla, la corrida no cambia de código: se avisa `AVISO: publicación: <mensaje>`.

```js
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export default {
  contrato: 1,
  tipo: 'publicacion',
  crear(opciones) {
    return {
      async publicar(carpeta, id) {
        const token = process.env.MI_TRACKER_TOKEN
        if (!token) throw Object.assign(new Error('definir MI_TRACKER_TOKEN'), { name: 'FaltaConfiguracion' })
        const m = JSON.parse(readFileSync(join(carpeta, 'manifest.json'), 'utf8'))
        for (const c of m.capturas) {
          // subir join(carpeta, c.publicar) al ticket `id`, con c.leyenda como comentario
        }
      },
    }
  },
}
```

Incluido `builtin:carpeta`: no sube nada; la evidencia queda en `publicar/`.

## correo

```ts
buscar({ buscar?, destinatario?, asunto? }): Promise<Array<{ id, asunto, para: string[], fecha, adjuntos: [{ nombre, tipo, bytes }] }>>
url(): string | undefined
```

Los scripts lo usan con `import { mailpit, urlMailpit } from 'captura-cli/correo'`, sin importar qué adaptador hay
detrás. Si falta la configuración, `buscar` lanza `FaltaConfiguracion` y la herramienta sale con 3.

Incluido `builtin:mailpit`: opciones `url` o `variable` (por defecto `CAPTURA_MAILPIT_URL`).

## Mensajes que ve quien escribe un adaptador

Los muestran `captura-cli adaptadores verificar` (sale con 1 si alguno falla) y cualquier comando que cargue la config
(sale con 1).

| Mensaje | Qué corregir |
|---|---|
| `ADAPTADOR_INVALIDO: <tipo>: no se pudo cargar <ruta>: <error>` | La ruta (relativa a la carpeta del config) o un error de sintaxis del módulo |
| `ADAPTADOR_INVALIDO: <tipo>: "builtin:x" no existe. Incluidos: builtin:env, …` | El nombre del incluido |
| `ADAPTADOR_INVALIDO: <tipo> (<usa>): el módulo no exporta por defecto un objeto { contrato, tipo, crear }` | Falta el `export default` |
| `… falta "contrato: 1"` | Declarar la versión del contrato |
| `… declara contrato 2 y esta versión de captura-cli usa el 1; ver docs/adaptadores.md («Versiones del contrato»)` | Adaptador escrito para otra versión |
| `… declara tipo "entorno" y se usa como "correo"` | El `tipo` o la clave en `adaptadores` |
| `… falta la función crear(opciones, contexto)` | La fábrica |
| `… crear() no devolvió un objeto` | `crear` debe devolver la instancia |
| `… falta el método resolver()` | Un método obligatorio del tipo |
| `… levantar debe ser una función` | Un método opcional declarado con otro valor |
| `CONFIG_INVALIDA: …: "adaptadores.<tipo>" debe ser "builtin:nombre", "./ruta.mjs" o { "usa": … }` | La forma en el config |
| `CONFIG_INVALIDA: …: clave desconocida "adaptadores.<x>"` | Tipos válidos: credenciales, identificador, entorno, publicacion, correo |

En ejecución:

| Situación | Qué ve el agente | Código |
|---|---|---|
| `resolver` devuelve `faltan` | `FALTAN_CREDENCIALES: <rol> -> definir … en <donde>, o pedírselas al usuario` | 3 |
| Un adaptador lanza `FaltaConfiguracion` | `FALTAN_CREDENCIALES: <correo\|entorno> -> <mensaje>` | 3 |
| `validar(id)` devuelve un mensaje | El mensaje (en `run`/`validar`: `id: <mensaje>`) | 1 / 2 |
| `publicar` falla | `AVISO: publicación: <mensaje>` | sin cambio |
| Otro error de un adaptador | `ERROR: <stack>` | 1 |

## Versiones del contrato

| Versión | Desde | Qué cambió |
|---|---|---|
| 1 | captura-cli 1.0.0 | Primera versión |

Si un día hay un contrato 2, esta tabla dice qué cambió, y la herramienta rechaza los adaptadores de la versión
anterior con el mensaje de arriba en lugar de fallar a mitad de una corrida.

## Tipos para el editor

Los tipos TypeScript del contrato se publican en `captura-cli/adaptadores` (`Fabrica`, `AdaptadorCredenciales`,
`ContextoAdaptador`, …). En un `.mjs`, si captura-cli se puede resolver desde la carpeta del proyecto:

```js
/** @type {import('captura-cli/adaptadores').Fabrica<'credenciales'>} */
export default { contrato: 1, tipo: 'credenciales', crear(opciones, contexto) { /* … */ } }
```
