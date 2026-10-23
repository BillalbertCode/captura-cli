// Sitio local de prueba (sin depender de la API): login, inicio, bandeja, esperas y un formulario con aviso de éxito.
// Cambia de token en cada arranque: una sesión guardada de otra corrida deja de servir (prueba de sesión vieja).
import http from 'node:http'
import { randomBytes } from 'node:crypto'

const filas = Array.from({ length: 60 }, (_, i) => `<div style="height:40px">fila ${i}</div>`).join('')
const html = (cuerpo) => `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;font:16px sans-serif">${cuerpo}</body></html>`

export function sitio({ puerto = 0 } = {}) {
  const token = randomBytes(6).toString('hex')
  const guardia = `<script>if(!document.cookie.includes('s=${token}'))location='/sign-in'</script>`
  const paginas = {
    '/sign-in': `<h1>Entrar</h1><input name="usuario"><input name="password" type="password">
      <button onclick="document.cookie='s=${token};path=/';document.cookie='u='+document.querySelector('[name=usuario]').value+';path=/';location='/home'">Entrar</button>`,
    '/home': `${guardia}<h1>Inicio</h1><a href="/bandeja">Ir a bandeja</a>${filas}<button id="fondo">Guardar al fondo</button>`,
    '/bandeja': `${guardia}<h1>Bandeja</h1><input placeholder="Documento"><select id="tipo"><option>Uno</option><option>Dos</option></select>
      <input type="password" placeholder="Clave"><button>Buscar</button>`,
    '/esperas': `${guardia}<h1>Esperas</h1><button id="lento" disabled>Continuar</button>
      <div id="combo" role="combobox" tabindex="0" style="padding:8px;border:1px solid #999;width:200px">Elegir</div><div id="lista"></div>
      <div id="aviso"></div><p>El trámite fue registrado hace poco</p>
      <script>
        setTimeout(()=>{document.getElementById('lento').disabled=false},600)
        let aperturas=0
        document.getElementById('combo').addEventListener('click',()=>{aperturas++;const l=document.getElementById('lista');
          l.innerHTML=aperturas>=2?'<div role="option">Opción tardía</div>':'<div role="option">Cargando…</div>'})
        document.addEventListener('keydown',(e)=>{if(e.key==='Escape')document.getElementById('lista').innerHTML=''})
      </script>`,
    // Formulario con un panel que NO es role=dialog (se ubica por su contenido) y un aviso de éxito con role=status.
    '/form': `${guardia}<h1>Formulario</h1><label>Nombre <input id="nombre"></label>
      <section class="panel"><h2>Confirmar envío</h2><button>Cancelar</button><button id="enviar">Enviar</button></section>
      <div id="estado"></div>
      <script>document.getElementById('enviar').addEventListener('click',()=>{setTimeout(()=>{const e=document.getElementById('estado');
        e.setAttribute('role','status');e.textContent='Enviado con éxito: '+document.getElementById('nombre').value},200)})</script>`,
    // Validación silenciosa: con un RIF inválido "Consultar" no hace ninguna petición; solo marca el campo.
    '/form2': `${guardia}<h1>Consulta</h1><label>RIF <input id="rif" pattern="^[0-9]{9}$" aria-describedby="rif-ayuda"></label>
      <span id="rif-ayuda">9 dígitos</span><button id="consultar">Consultar</button><p id="msg" class="campo-error"></p>
      <script>document.getElementById('consultar').addEventListener('click',()=>{const r=document.getElementById('rif');
        if(!r.checkValidity()){r.setAttribute('aria-invalid','true');document.getElementById('msg').textContent='El RIF debe tener 9 dígitos'}})</script>`,
    // Una app sin login: pantalla pública con un contador.
    '/publico': `<h1>Publico</h1><p>Esta pantalla no pide login.</p><button id="contar">Contar</button> <span id="n">0</span>
      <script>document.getElementById('contar').addEventListener('click',()=>{const n=document.getElementById('n');n.textContent=Number(n.textContent)+1})</script>`,
    // El backend de la app falla (503): la pantalla se queda cargando.
    '/roto': `${guardia}<h1>Reportes</h1><p id="estado">Cargando datos…</p><script>setTimeout(()=>fetch('/api/falla'),300)</script>`,
  }
  const server = http.createServer((q, r) => {
    const ruta = q.url.split('?')[0]
    if (ruta === '/api/falla') {
      r.statusCode = 503
      return r.end('{"error":"ya tenemos demasiados clientes"}')
    }
    if (ruta.startsWith('/api/')) {
      r.setHeader('content-type', 'application/json')
      let cuerpo = ''
      q.on('data', (d) => { cuerpo += d })
      q.on('end', () => {
        // Dos formas de sesión: token por cabecera (Bearer) o la cookie del navegador.
        if (q.headers.authorization === `Bearer ${token}`) return r.end(JSON.stringify({ metodo: q.method, ruta, cuerpo }))
        if ((q.headers.cookie || '').includes(`s=${token}`)) return r.end(JSON.stringify({ metodo: q.method, ruta, cuerpo, via: 'cookie' }))
        r.statusCode = 401
        r.end('{"error":"sin sesión"}')
      })
      return
    }
    r.setHeader('content-type', 'text/html; charset=utf-8')
    r.end(html(paginas[ruta] || '<h1>404</h1>'))
  })
  return new Promise((ok) => server.listen(puerto, () => {
    const p = server.address().port
    ok({ url: `http://localhost:${p}`, puerto: p, token, cerrar: () => new Promise((c) => server.close(c)) })
  }))
}

/** Configuración de la app "zz" del sitio, igual para la API (en memoria) y para captura.config.json. */
export const appZZ = (baseUrl) => ({
  baseUrl,
  login: '/sign-in',
  campos: [{ selector: 'input[name=usuario]', valor: 'numero' }, { selector: 'input[name=password]', valor: 'clave' }],
  boton: 'Entrar',
  postLogin: '**/home',
  inicio: '/home',
  cookieSesion: 's',
  apiBase: '/api',
})
