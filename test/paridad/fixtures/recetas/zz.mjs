export default {
  'abrir-bandeja': {
    version: 1,
    descripcion: 'Abre la bandeja desde el inicio',
    async verificar(page) { return page.getByRole('heading', { name: 'Bandeja' }).isVisible() },
    async hacer(page) { await page.getByRole('link', { name: 'Ir a bandeja' }).click(); await page.getByRole('heading', { name: 'Bandeja' }).waitFor() },
  },
  'de-comun': {
    version: 3,
    descripcion: 'La de la app gana sobre comun.mjs',
    async hacer() {},
  },
  rota: {
    version: 2,
    descripcion: 'Receta con selector viejo',
    async verificar() { return false },
    async hacer(page) { await page.locator('#no-existe').click({ timeout: 1500 }) },
  },
}
