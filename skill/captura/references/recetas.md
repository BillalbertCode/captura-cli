# Recetas: lo ya probado se reutiliza

Una **receta** es un tramo de pantalla ya verificado (abrir una bandeja, elegir una fecha, llegar al paso N de un
asistente) con su propia comprobación. Es conocimiento del proyecto: vive en la carpeta de recetas del workspace
(`<app>.mjs`, y `comun.mjs` para lo compartido; gana la de la app). La herramienta solo la carga, la ejecuta y anota
su estado.

```js
export default {
  'abrir-bandeja': {
    version: 1,
    descripcion: 'Abre la bandeja desde el menú lateral',
    vistoEn: 'TAREA-12 2026-10-22',
    async verificar(page) { return page.getByRole('heading', { name: /bandeja/i }).first().isVisible() },
    async hacer(page) {
      await page.getByRole('link', { name: /bandeja/i }).first().click()
      await page.getByRole('heading', { name: /bandeja/i }).first().waitFor()
    },
  },
}
```

- **Antes de escribir un script o un escenario:** `captura-cli recetas <app>` (una línea por receta con versión y
  estado). Si la pantalla ya está, se usa y no se explora.
- **Usar:** `{ "receta": "abrir-bandeja" }` o `await receta(page, 'abrir-bandeja', args)`. Si `verificar()` ya pasa,
  no hace nada («ya estaba»); si no, ejecuta `hacer()` y vuelve a verificar. Si no se rompe, se avanza.
- **La receta describe la pantalla, no el rol:** dos roles con la misma bandeja usan la misma receta; lo distinto son
  los datos.
- **Volcado de texto (`diagnostico`, `explorar`) solo** cuando la receta no existe o falla.
- **Registrar** una receta apenas un paso funcionó y **antes de seguir**. Idempotente y tolerante a otro punto de
  partida (un borrador guardado que reabre en otro paso). Para asistentes que retoman un borrador: detectar el paso
  por su texto y continuar desde ahí.
- **Si se rompe** (la pantalla cambió), el error dice qué receta y dónde corregirla: se corrige, se **sube su
  `version`** y se anota qué cambió. El estado (ok/rota, versión, id, fecha) queda en el almacén.
- **Cierre obligatorio:** la herramienta graba lo que el script hace por su cuenta y deja un borrador por tramo en
  `recetas-candidatas.md` (selectores pegables; las claves salen como `<clave>`). Si hubo tramos sin receta, hay que
  declarar qué pasó o sale con **5** y el informe queda INCOMPLETO:
  - `cerrar({ creadas: ['abrir-bandeja'] })` / `"recetas": { "creadas": [...] }`: se registraron (revisar el
    borrador: unir tramos, `verificar` real, parametrizar datos y claves);
  - `cerrar({ ninguna: 'motivo' })` / `"recetas": { "ninguna": "motivo" }`: no se van a repetir; el motivo queda en
    el informe.
