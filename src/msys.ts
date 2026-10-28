// Git Bash (Windows) convierte un argumento que empieza con "/" en una ruta de Windows antes de que el comando lo
// reciba: `/bandeja` llega como `C:/…/Git/bandeja`. Se deshace solo si el prefijo es EXACTAMENTE la raíz de Git
// (EXEPATH, con o sin su carpeta bin); cualquier otra ruta se deja como está.

export function sinConversionMsys(arg: string, env: NodeJS.ProcessEnv = process.env, plataforma: string = process.platform): string {
  const exe = env['EXEPATH']
  if (plataforma !== 'win32' || !env['MSYSTEM'] || !exe) return arg
  const a = arg.replaceAll('\\', '/')
  const base = exe.replaceAll('\\', '/').replace(/\/+$/, '')
  // EXEPATH apunta al binario de Git: …/Git/bin (una instalación) o …/Git/usr/bin/bash (la de Git for Windows).
  // La raíz de la instalación está quitando "/bin" o "/usr/bin/bash"; se prueba al final para no pisar /usr/share.
  const raizGit = base.replace(/\/(usr\/)?bin\/[^/]+$/i, '').replace(/\/(usr\/)?bin$/i, '')
  for (const raiz of [base.replace(/\/(usr\/)?bin$/i, ''), base, ...(raizGit && raizGit !== base ? [raizGit] : [])]) {
    const r = raiz.toLowerCase(), x = a.toLowerCase()
    if (x === r || x === `${r}/`) return '/'
    if (x.startsWith(`${r}/`)) return a.slice(raiz.length)
  }
  return arg
}
