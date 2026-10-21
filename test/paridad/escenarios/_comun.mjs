// Base de los escenarios: carga la implementación del descriptor, levanta un sitio local y registra la app "zz".
// El sitio cambia de token en cada arranque: una sesión guardada de otra corrida deja de servir (prueba de sesión vieja).
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const impl = (await import(pathToFileURL(process.env.CAPTURA_IMPL).href)).default
export const C = await import(impl.modulo)
// id(n): fijo (las salidas se acumulan por id). id(n, true): único por corrida, para comprobar nombres stepNN exactos.
export const id = (n, unico = false) => impl.id(n, unico ? String(Date.now() % 1e8) : '')
export const USUARIO = 'A12345678'
export const CLAVE = 'clave-de-prueba'

export function conCredenciales(rol = 'zz') {
  Object.assign(process.env, impl.envCredenciales(rol, USUARIO, CLAVE))
}

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
  }
  const server = http.createServer((q, r) => {
    const ruta = q.url.split('?')[0]
    if (ruta.startsWith('/api/')) {
      r.setHeader('content-type', 'application/json')
      let cuerpo = ''
      q.on('data', (d) => { cuerpo += d })
      q.on('end', () => {
        if (q.headers.authorization !== `Bearer ${token}`) { r.statusCode = 401; return r.end('{"error":"sin token"}') }
        r.end(JSON.stringify({ metodo: q.method, ruta, cuerpo }))
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

export function registrarApp(baseUrl, nombre = 'zz') {
  C.apps[nombre] = {
    baseUrl,
    login: '/sign-in',
    campos: [{ selector: 'input[name=usuario]', valor: 'numero' }, { selector: 'input[name=password]', valor: 'clave' }],
    boton: 'Entrar',
    postLogin: '**/home',
    inicio: '/home',
    cookieSesion: 's',
    apiBase: '/api',
  }
}

// Una falla esperada: imprime "ok rechaza <nombre>: <mensaje>" o "ERROR_ESPERADO_NO_OCURRIO <nombre>".
export async function rechaza(nombre, fn) {
  try { await fn(); console.log(`ERROR_ESPERADO_NO_OCURRIO ${nombre}`) } catch (e) { console.log(`ok rechaza ${nombre}: ${String(e.message).split('\n')[0].slice(0, 160)}`) }
}
