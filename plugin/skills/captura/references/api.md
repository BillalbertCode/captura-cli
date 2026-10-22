# API de código

Para lo que un escenario no cubre. Un script corto y descartable por fase, en la carpeta temporal del agente, corrido
con tope: `timeout 300 node <script>.mjs`.

```js
import { sesion, foto, marcar, limpiar, esperarTexto, api, caso, diagnostico } from 'captura-cli'

const { page, cerrar } = await sesion('supervisor', { ticket: 'TAREA-12', app: 'web' })
await esperarTexto(page, 'Bandeja')
await marcar(page, page.getByRole('button', { name: 'Iniciar' }), 'bloqueado: cita futura', { lado: 'der' })
const f = await foto(page, 'iniciar-bloqueado', { leyenda: 'Iniciar bloqueado: la cita es futura' })
await limpiar(page)
const r = await api(page, 'post', '/bandeja/123/iniciar')   // lo que la pantalla esconde
caso(page, { nombre: 'el backend rechaza', esperado: '4xx', observado: String(r.status), ok: r.status >= 400, captura: f })
await cerrar({ ninguna: 'verificación puntual' })   // informe.md, casos.json, manifest.json, publicar/
```

| Función | Para qué |
|---|---|
| `sesion(rol, { ticket, app, reutilizar })` | Login con sesión guardada por app y rol (vale `sesionMin` minutos, 15 por defecto, si la app no manda al login). Cambiar de rol no repite el login del otro. `reutilizar: false` fuerza el login. Los logins con varios campos (documento partido en letra y número) se declaran con `campos` en la config. Imprime el catálogo de recetas |
| `abrir({ ticket, browser, headless, viewport, subcarpeta, maxMs })` | Navegador sin login. `maxMs` (5 min) es el tope: código 4 |
| `marcar(page, locator, texto, { lado, numero })` | Óvalo y etiqueta rojos (`abajo`, `arriba`, `izq`, `der`, `dentro`). Se marca el contenedor completo del aviso, no solo el título. Con `position:fixed`: no altera la página y deja la captura lista para que el usuario agregue flechas encima |
| `foto(page, descripcion, { leyenda, sinMarca, completa })` | Captura del **viewport** (no página completa: corta sidebar y header fijos) con «Paso NN · leyenda» dentro de la imagen. Vuelve a medir las marcas antes de capturar; si un elemento ya no está o quedó fuera, falla con texto. Imprime `marca N "texto" en (x,y) WxH …; contenido: "…"`: con eso se valida sin abrir el PNG |
| `limpiar(page)` | Quita las marcas |
| `caso(page, { nombre, esperado, observado, ok, captura })` | Una fila del informe. El mismo nombre reemplaza al anterior: se puede repetir una fase |
| `cambio(page, { que, revertir, revertido })` | Diario de escrituras |
| `configuracion(page, { que, reversion })` | Bloque de configuración como admin (ver datos.md) |
| `api(page, metodo, ruta, cuerpo)` | Petición con la sesión del navegador; prueba que el backend acepta o rechaza lo que la pantalla permite o esconde |
| `explorar(page, { max, completo, errores })` | Lista compacta de lo interactivo con selectores; la segunda vez en la misma ruta, solo el diff |
| `diagnostico(page, { max })` | Ante una falla: URL, texto, botones y cookies (nombres) |
| `esperarTexto`, `esperarExito`, `esperarToast(page, /texto/, { foto })`, `esperarHabilitado(locator)`, `abrirSelectHasta(locator, 'opción')` | Esperas por estado |
| `receta`, `listarRecetas`, `declararRecetas` | Ver recetas.md |

- **Otro navegador:** `browser: 'firefox' | 'webkit'`. Si el Chromium incluido se cae en una pantalla:
  `CAPTURA_CANAL=msedge` (o `chrome`).
- **Sin pisar capturas previas:** `subcarpeta: 'recorrido'`.
- **PDF:** el visor sale en blanco sin ventana; para ver el contenido, `abrir({ headless: false })` unos segundos.
- **Correo** (si el proyecto declara un adaptador de correo):
  `import { mailpit, urlMailpit } from 'captura-cli/correo'`. `mailpit({ destinatario, asunto })` devuelve asunto,
  destinatarios y adjuntos. Para capturar la interfaz: abrir `urlMailpit()`, buscar, abrir el correo y marcar el
  adjunto.
- **Informe acumulativo:** `cerrar()` guarda los casos en `casos.json` y regenera `informe.md` y `manifest.json`.
  Avisa si hubo capturas y ningún caso.
