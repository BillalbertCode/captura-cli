# Pruebas de paridad

Comprueban que `captura-cli` se comporta igual que la herramienta que reemplaza: mismas 22 funciones del núcleo
(nombre y aridad), mismos códigos de salida y mismos archivos de salida, con el mismo texto que hoy lee un agente.
Corren contra un sitio local que levanta cada escenario; no hace falta ningún servicio externo.

```sh
npm run test:paridad                                   # contra esta implementación (dist/)
CAPTURA_IMPL=<ruta/descriptor.mjs> npm run test:paridad  # contra otra
```

## Descriptor de implementación

Las pruebas no nombran a ninguna implementación: la reciben por un módulo cuyo `default` declara

| Clave | Qué es |
|---|---|
| `nombre` | Texto para los mensajes |
| `modulo` | URL `file:` del módulo que exporta la API de código |
| `cli` | Ruta del ejecutable del CLI (solo con la capacidad `cli`) |
| `id(n, sufijo='')` | Id válido para la implementación; con `sufijo`, único por corrida |
| `envCredenciales(rol, usuario, clave)` | Variables de entorno que dan credenciales a ese rol |
| `variablesFaltantes(rol)` | Variables que `FALTAN_CREDENCIALES` debe nombrar, en orden |
| `env()` | Variables extra para cada proceso (por ejemplo, un almacén aislado) |
| `cwd` | Carpeta de trabajo de los escenarios (opcional) |
| `preparar()` | Se llama una vez antes de las pruebas (por ejemplo, registrar el workspace) |
| `capacidades` | `workspace`, `escenario`, `manifest`, `canal`, `slot-por-puertos`, `api-sin-cookie`, `pagina-colgada`, `correo-en-nucleo` |
| `defectos` | Defectos conocidos de esa implementación que una prueba salta con aviso |

El descriptor de esta implementación es `test/impl/captura-cli.mjs`. Un descriptor de una implementación de
referencia, con sus propios prefijos de credenciales e ids, vive fuera del repo (por ejemplo en `test/.tmp/`, que
git ignora).

## Qué cubre

| Archivo | Cubre |
|---|---|
| `exportaciones.test.mjs` | Las 22 exportaciones del núcleo (`exportaciones.json`), alias `paso`, nada de más, correo fuera |
| `codigos.test.mjs` | Códigos 0, 1, 3, 4 y 5 con su texto exacto |
| `salidas.test.mjs` | `stepNN-<desc>.png` (viewport, leyenda y marca roja medidas en los píxeles), `casos.json`, `informe.md`, `publicar/`, `recetas-candidatas.md` |
| `funciones.test.mjs` | Sesión guardada, marcas, `explorar`, `esperarExito`, `diagnostico`, recetas, esperas, `CAPTURA_CANAL`, `CAPTURA_SLOT`, `api()` sin `cookieSesion`, código 7 |
| `cli.test.mjs` | Contrato nuevo: código 6 (`WORKSPACE_NUEVO`, en el CLI y en la API), 2 (escenario inválido), `manifest.json` |

Lo que cambia a propósito respecto a la referencia está en [docs/desviaciones.md](../../docs/desviaciones.md).
