# Errores que ya costaron tiempo

- **Nunca dejar un navegador ni un script colgado.** Todo comando de verificación con `timeout`, sin lectores de
  stdin ni heredocs a intérpretes (`python -`), en primer plano (no en segundo plano). La herramienta además cierra el
  navegador si el script falla, recibe una señal, supera `maxMs` (`TIMEOUT_GLOBAL`, 4) o la página se cuelga
  (`PAGINA_COLGADA`, 7). Si igual queda algo, buscarlo y cerrar **solo ese PID**, avisando.
- **Éxito estricto.** `esperarExito(page, 'texto exacto')` busca dentro de avisos y diálogos (role status, alert,
  dialog), con coincidencia exacta si es texto; nunca como subcadena suelta: un texto parecido en un diálogo de
  confirmación dio un falso OK.
- **Esperar por contenido o URL, nunca por tiempo.** Una SPA puede tardar hasta 40 s en la primera carga; los
  `waitForTimeout` fijos fallaron.
- **Terminar el login antes de leer cookies.** `sesion` espera el `postLogin` y `api` espera la sesión; sin eso, el
  401 engaña.
- **Averiguar dónde viaja la sesión** antes de llamar a la API: cookie httpOnly, cabecera con token o proxy del front.
  Si la app pasa el token por cabecera, declarar `cookieSesion`; si no, `api()` usa las cookies del navegador.
- **Ante una falla, `diagnostico`** (URL, texto, botones, cookies) y decidir. No reintentar a ciegas: los timeouts de
  Playwright dicen qué locator esperaban.
- **«Siguiente» o «Consultar» no hace nada y no sale ninguna petición:** casi siempre es una validación silenciosa.
  `explorar` con `errores` lista los campos inválidos (con su patrón y mensaje) y los mensajes de error.
- **`AVISO_5XX`:** el servidor de la app falló (p. ej. la base sin conexiones). No es un selector roto: reportarlo
  como problema del entorno.
- **Un click que «no hace nada»:** leer el componente; el handler puede estar en otro botón.
- **Paneles que no son `role=dialog`:** ubicarlos por su contenido (`dentro` en el escenario, `locator(...).filter`
  en un script).
- **Campos de fecha u hora propios** (inputs de solo lectura con calendario, campos de tres partes): `fill` no
  funciona; resolverlos en una receta.
- **Botones de icono sin texto:** localizar por posición es frágil. Pedir `data-testid` o `aria-label` a quien
  programa la pantalla, y usarlos.
- **Editar scripts con el archivo completo** (Write o heredoc), no con `sed` sobre código: rompió comillas y barras.
- **Las capturas no se commitean** ni se citan en comunicados; para un MR se nombra la ruta o el usuario las adjunta.
- No leer imágenes por defecto, no adivinar credenciales, no levantar servicios ajenos, no escribir en la base.
