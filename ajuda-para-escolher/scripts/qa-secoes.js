// QA das seções: ordem das dobras, uma screenshot por seção em desktop e mobile, overflow por seção
const fs = require('fs');
const path = require('path');
const { SHOTS, servidor, navegador, VIEWPORTS, relatorio } = require('./_util');

const ORDEM = ['hero', 'dar-errado', 'trocar-ou-ajustar', 'passo-a-passo', 'quem-atende', 'formulario'];

(async () => {
  const r = relatorio('qa-secoes');
  const { srv, base } = await servidor(4174);
  const browser = await navegador();
  const pasta = path.join(SHOTS, 'secoes');
  fs.mkdirSync(pasta, { recursive: true });

  for (const nome of ['desktop', 'mobile', 'mini']) {
    const page = await browser.newPage({ viewport: VIEWPORTS[nome], deviceScaleFactor: 1 });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const ordem = await page.$$eval('[data-secao]', (els) => els.map((e) => e.getAttribute('data-secao')));
    if (nome === 'desktop') r.check(JSON.stringify(ordem) === JSON.stringify(ORDEM), `ordem das dobras: ${ordem.join(' → ')}`);

    for (const sec of ORDEM) {
      const el = page.locator(`[data-secao="${sec}"]`);
      const largura = await el.evaluate((e) => Math.max(...[...e.querySelectorAll('*')].map((c) => c.getBoundingClientRect().right)));
      r.check(largura <= VIEWPORTS[nome].width + 0.5, `${nome}: ${sec} cabe na largura (${Math.round(largura)}px)`);
      if (nome !== 'mini') await el.screenshot({ path: path.join(pasta, `${nome}-${sec}.png`) });
    }

    // Âncoras do índice e dos CTAs apontam para seções que existem
    const quebradas = await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.querySelector(h)));
    if (nome === 'desktop') r.check(quebradas.length === 0, `âncoras internas válidas ${quebradas.join(', ')}`);
    await page.close();
  }

  // Obrigados
  for (const arq of ['obrigado-especialista.html', 'obrigado-guia.html']) {
    for (const nome of ['desktop', 'mobile']) {
      const page = await browser.newPage({ viewport: VIEWPORTS[nome], deviceScaleFactor: 1 });
      await page.goto(`${base}/${arq}`, { waitUntil: 'networkidle' });
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      r.check(ov <= 0, `${arq} ${nome}: sem rolagem horizontal`);
      await page.screenshot({ path: path.join(pasta, `${nome}-${arq.replace('.html', '')}.png`), fullPage: true });
      await page.close();
    }
  }

  await browser.close();
  srv.close();
  r.fim();
})();
