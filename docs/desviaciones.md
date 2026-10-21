# Desviaciones respecto a la referencia

La paridad se lee contra esta lista. Una desviación deliberada cambia el comportamiento a propósito, y su prueba
exige el comportamiento nuevo. Un caso «conocido, no corregido» se mantiene igual que en la referencia.

## Deliberadas

| Qué | Referencia | captura-cli | Motivo |
|---|---|---|---|
| `esperarHabilitado(locator, ms)` | Vuelve enseguida: compara `locator.isEnabled()`, que es una promesa y por lo tanto siempre verdadera | Espera a que el elemento deje de estar `disabled`, con el tope `ms` | Es lo que documenta la función. Prueba: `funciones.test.mjs` |
| `api(page, …)` en apps sin `cookieSesion` | Falla con `no hay cookie de sesión "null"` | La petición sale del contexto del navegador, con sus cookies. Solo falla si responde 401 o 403 y el navegador no tiene ninguna cookie de la app; el mensaje dice qué configurar | Hay apps que guardan la sesión en cookies httpOnly con otro nombre. Con `cookieSesion` declarado se comporta igual que la referencia (Bearer) |
| Página colgada (evento `crash`) | Error genérico; el script queda colgado hasta el tope externo | Cierra el navegador y sale con **7** `PAGINA_COLGADA: la página se colgó en <url> tras <último paso>; reintentá o corré con CAPTURA_CANAL=msedge` | Corridas reales con «Page crashed» intermitente |
| `sesion(rol, { app })` sin `app` | Usa una app del proyecto por defecto | Usa la única app declarada; si hay varias, error con la lista | Ningún nombre de proyecto por defecto |
| Credenciales | Archivo, prefijo y alias fijos del proyecto | `.env` con `CAPTURA_<ROL>_USUARIO` / `_CLAVE` y alias de la config, mediante el adaptador `builtin:env` | Ningún prefijo de proyecto por defecto |
| Formato del id | Un patrón del proyecto | `^[A-Za-z0-9._-]+$` por defecto (`id.patron` en la config) | Ídem |
| `mailpit`, `urlMailpit` | En el núcleo, URL en una variable del proyecto | `captura-cli/correo`, mediante el adaptador de correo (`builtin:mailpit`, URL en la config o en `CAPTURA_MAILPIT_URL`) | El correo no es del núcleo |
| Slot → puertos | `CAPTURA_SLOT` suma 100·N al puerto dentro del núcleo | El núcleo separa por slot lo que guarda; la URL la da el adaptador de entorno (`builtin:comando` con `puertoPorSlot`) | El esquema de puertos es del proyecto |
| Dónde caen las salidas | `<repo>/<salida>/<id>/` | `~/.captura-cli/workspaces/<nombre>-<hash>/captures/<id>/`, o la ruta elegida al registrar el workspace | El repo que se prueba no recibe nada |
| Workspace sin registrar | No aplica | Código **6** `WORKSPACE_NUEVO`, con las preguntas para el agente | Nuevo |
| Rutas en los mensajes de recetas | `captura.recetas/<app>.mjs` | La ruta real de la carpeta de recetas del workspace | La carpeta ya no es fija |

## Agregados (no cambian nada de lo anterior)

| Qué | Dónde |
|---|---|
| `manifest.json` junto a `informe.md`: resumen, casos, capturas con `sha256` y ruta en `publicar/`, cambios, recetas, 5xx | Cierre (`cerrar()` y `run`) |
| `AVISO_5XX: el servidor respondió <status> a <MÉTODO> <url> durante <paso>; …` en stderr (una vez por petición) y la sección «Errores del servidor» en el informe | Cualquier respuesta 5xx de la página o de `api()` |
| En `run`, si un paso falla y hubo un 5xx durante ese paso, el mensaje de la falla lo cita | `captura-cli run` |
| `explorar(page, { errores: true })`, el paso `{ "explorar": { "errores": true } }` y `captura-cli explorar … --errores`: campos inválidos (`aria-invalid` o validación nativa, con su mensaje) y mensajes de error visibles | Validaciones silenciosas |
| En `run`, al fallar un paso, los errores visibles se imprimen junto al `diagnostico` | `captura-cli run` |
| Escenarios en JSON, `captura-cli validar`, `run`, `explorar` | F3 |

## Conocidas, no corregidas

| Qué | Comportamiento (igual en las dos) |
|---|---|
| Marca sobre un elemento pegado arriba | Si el elemento está a menos de 40 px del borde y la página no puede subir más, la marca queda debajo de la franja de leyenda |
| Recetas «creadas» que no existen | El cierre sale con 5, pero esas ids igual quedan acumuladas en `casos.json` e `informe.md` («Creadas: …») |
