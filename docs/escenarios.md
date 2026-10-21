# Escenarios

Un escenario describe un flujo en JSON, sin escribir código. Sirve para pedir una prueba de punta a punta o para
dejar evidencia de una tarea: el motor lo valida entero antes de abrir el navegador, lo ejecuta con la misma API de
código que un script, y deja `informe.md`, `casos.json`, las capturas y `publicar/`.

```sh
captura-cli validar escenarios/visita.json   # sin navegador; sale con 2 y la lista de errores si no es válido
captura-cli run visita --rol supervisor      # por nombre: busca en la carpeta de escenarios del proyecto
captura-cli explorar /bandeja --rol supervisor  # para hallar selectores antes de escribirlo
```

## Forma

```json
{
  "$schema": "https://raw.githubusercontent.com/BillalbertCode/captura-cli/main/schema/escenario.schema.json",
  "version": 1,
  "id": "TAREA-12",
  "app": "web",
  "rol": "supervisor",
  "recetas": { "ninguna": "flujo de una sola vez" },
  "casos": [
    {
      "nombre": "Registrar visita entregada",
      "esperado": "La fila pasa a Entregada",
      "pasos": [
        { "receta": "abrir-registrar-visita" },
        { "elegir": { "en": { "etiqueta": "Resultado" }, "opcion": "Entregada" } },
        { "llenar": { "en": { "placeholder": "Observación" }, "valor": "Sin novedad" } },
        { "marcar": { "en": { "rol": "button", "nombre": "Guardar" }, "etiqueta": "Guarda la visita" } },
        { "foto": { "descripcion": "visita-lista", "leyenda": "El diálogo listo para guardar" } },
        { "limpiar": true },
        { "click": { "en": { "rol": "button", "nombre": "Guardar" } } },
        { "esperarExito": "Visita registrada" }
      ]
    }
  ]
}
```

| Clave | Qué es |
|---|---|
| `version` | `1` |
| `id` | Carpeta de salida; tiene que cumplir el formato del proyecto (`id.patron`). `--id` manda |
| `app` | App del config. Opcional si hay una sola. `--app` manda |
| `rol` | Rol con el que entrar. `--rol` manda |
| `recetas` | Lo mismo que `cerrar()`: `{ "creadas": ["id"] }` o `{ "ninguna": "motivo" }`. Sin esto, si hubo pasos propios, sale con 5 |
| `casos` | Cada caso va al informe: **OK** si todos sus pasos se cumplen; **FALLA** con el paso y el error si uno falla |

Si un caso falla, el motor imprime el paso exacto (`casos[0].pasos[3] (click): …`), un `diagnostico` y los errores
visibles de la pantalla (campos inválidos, mensajes de error); quita las marcas y sigue con el caso siguiente. Si
durante ese paso el servidor respondió 5xx, el mensaje lo dice: `[el servidor respondió 503 a GET …/api/x durante
este paso]`. Así un problema del entorno no se confunde con un selector roto.

Al cerrar quedan `informe.md` para personas y `manifest.json` para máquinas: resumen, casos, capturas con su
`sha256` y su ruta en `publicar/`, cambios, recetas y respuestas 5xx.

## Pasos

| Paso | Forma | Equivale a |
|---|---|---|
| `ir` | `"/ruta"` o una URL | `page.goto` (relativa a `baseUrl`) |
| `click` | `{ "en": S }` | `locator.click()` |
| `llenar` | `{ "en": S, "valor": "…" }` | `locator.fill()` |
| `elegir` | `{ "en": S, "opcion": "…" }` | `<select>`: `selectOption({ label })`; otro desplegable: `abrirSelectHasta` y clic en la opción |
| `esperar` | `"texto"` o `{ "texto", "ms" }` | `esperarTexto` |
| `esperarExito` | `"texto"` o `{ "texto", "ms", "dentro": S }` | `esperarExito` (dentro de avisos y diálogos, nunca suelto) |
| `esperarToast` | `"texto"` o `{ "texto", "ms", "foto", "leyenda" }` | `esperarToast` (con `foto`, marca y captura el aviso) |
| `esperarHabilitado` | `{ "en": S, "ms" }` | `esperarHabilitado` |
| `comprobar` | `{ "en": S, "visible": bool, "texto": "…", "habilitado": bool }` | Una aserción: falla el caso si no se cumple |
| `marcar` | `{ "en": S, "etiqueta": "…", "lado", "numero" }` | `marcar` |
| `limpiar` | `true` | `limpiar` |
| `foto` | `{ "descripcion", "leyenda", "sinMarca", "completa" }` | `foto`: leyenda obligatoria y marca activa (o `sinMarca` con motivo) |
| `cambio` | `{ "que", "revertir", "revertido" }` | `cambio` |
| `api` | `{ "metodo", "ruta", "cuerpo", "status" }` | `api`; con `status`, falla si la respuesta es otra |
| `receta` | `"id"` o `{ "id", "args" }` | `receta` |
| `explorar` | `true` o `{ "max", "completo", "errores" }` | `explorar`; con `errores`, también los campos inválidos y los mensajes de error visibles |

Un texto escrito como `"/patron/i"` es una expresión regular; cualquier otro, literal.

## Selector `S`

Exactamente uno de:

| Clave | Busca por |
|---|---|
| `rol` (+ `nombre`) | Rol accesible: `{ "rol": "button", "nombre": "Guardar" }` |
| `etiqueta` | Etiqueta del campo (`<label>`, `aria-label`) |
| `placeholder` | Placeholder |
| `texto` | Texto visible |
| `testid` | `data-testid` |
| `css` | Selector CSS (último recurso) |

Más, opcionales: `exacto` (coincidencia exacta del texto), `n` (índice si hay varios; por defecto el primero) y
`dentro` (otro selector que lo contiene). Por ejemplo, un panel que no es `role=dialog`:

```json
{ "click": { "en": { "rol": "button", "nombre": "Confirmar", "dentro": { "css": "section.panel-remitir" } } } }
```

## Límite

El escenario nunca ejecuta código suelto. Un control raro (un calendario propio, un asistente que retoma un
borrador) se resuelve con una **receta**, que es JavaScript del proyecto y se llama con el paso `receta`.
