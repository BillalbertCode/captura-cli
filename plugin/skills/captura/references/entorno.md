# Servicios, slots y procesos

Los servicios de la app los levanta el **adaptador de entorno** del proyecto (un script que ya exista, declarado con
`builtin:comando`, o un adaptador propio). La herramienta no sabe de puertos ni de repos.

```sh
captura-cli entorno estado                    # qué hay arriba en el slot propio + si cada app responde
captura-cli entorno levantar <app> [args…]    # lo que falte
captura-cli entorno parar [app]               # solo cuando el usuario lo pide
```

- **Salud:** `entorno estado` además consulta el `baseUrl` de cada app del config y avisa si alguna no responde
  (VPN caída o servicio abajo). Lo que la herramienta no sabe (el backend, el BFF, la base) se declara en
  `captura.config.json` con **`precondiciones`**: una lista de comandos de solo lectura (p. ej. `["bash bin/vpn.sh"]`)
  que `sesion()` ejecuta **antes** de abrir la app; si uno falla, la sesión no abre y el error dice cuál fue y qué
  salió. Así no se capturan pantallas contra un entorno caído.

- **Slots (varios agentes a la vez):** cada corrida usa un número (`--slot N`, `--slot auto` = el primero libre, o
  `CAPTURA_SLOT`). La herramienta separa por slot sesiones, caché y temporales; el adaptador traduce el slot a
  puertos o URLs. Levantar y capturar con el **mismo** slot.
- **Desde qué copia del código:** si el adaptador deja elegir (la copia de trabajo de la tarea, un worktree, o una
  copia base del último código integrado), usar la de la tarea para lo que cambió y la base para el resto. La copia
  de la tarea **nunca** se cierra ni se toca al parar: solo se baja el proceso, para no perder cambios.
- **Quedan arriba al terminar:** el usuario avisa cuándo parar. Así no se reabren de a uno entre tareas.
- **`parar` cierra solo lo del slot propio** y solo lo que el adaptador levantó. Un servicio **ajeno** (de otra
  sesión) no se toca: se dice y se pregunta al usuario.
- **Puerto ocupado por otro código** (otra copia del mismo repo): solo si el adaptador ofrece reemplazarlo y el
  usuario lo acepta.
- **No arranca** (VPN caída, puerto de otro): la línea decisiva del log y parar.
- **Comandos de servicios nunca por una tubería** (`| tail` deja el comando sin volver): con tope y leyendo el
  resumen, p. ej. `timeout 400 captura-cli entorno levantar web`.

## Diagnóstico y residuos

- Algo no arranca (navegador, Playwright, config, adaptadores): `captura-cli doctor`. Si falta Chromium,
  `captura-cli doctor --instalar`.
- Espacio: `captura-cli stats` muestra cuánto ocupa cada parte del almacén; `captura-cli limpiar` lista lo que se
  puede borrar. **`--aplicar` solo si el usuario lo pide**, y las capturas (`--antes`) solo con su confirmación.

## Procesos propios

Antes de reportar, listar y cerrar lo propio: navegadores o scripts de más de 30 minutos que apuntan a la carpeta de
trabajo. Nunca tocar servicios que escuchan en un puerto ni procesos de otras sesiones. Sin `pkill`: por PID
(`taskkill //PID <n> //T //F` en Git Bash o `Stop-Process` en PowerShell), avisando. Los servicios levantados se dejan
arriba y se nombran en el reporte.
