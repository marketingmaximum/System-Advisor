// Prints para aprovação do cliente: Portal rodando em BASE (padrão http://localhost:3000).
// Remove o selo de desenvolvimento do Next e suprime a newsletter; bloqueia GTM/GA4.
const fs = require('fs');
const path = require('path');
const { ROOT, navegador } = require('./_util');

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = path.join(ROOT, 'entrega-cliente');
const D = { width: 1440, height: 900 };
const M = { width: 390, height: 844 };

async function contexto(browser, vp, extra = () => {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  await ctx.route(/googletagmanager\.com|google-analytics\.com|gravatar\.com/, (r) => r.abort());
  await ctx.addInitScript(() => {
    try { localStorage.setItem('ps_newsletter_subscribed', '1'); } catch {}
  });
  await ctx.addInitScript(extra);
  return ctx;
}

async function limpar(page) {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function preencher(page, faixa) {
  await page.selectOption('#sa-faturamento', faixa);
  await page.selectOption('#sa-funcionarios', faixa === '20_50' ? '51_150' : 'ate_50');
  await page.fill('#sa-sistema_atual', 'Planilhas');
  await page.selectOption('#sa-prazo', '3_6m');
  await page.fill('#sa-nome', 'Cliente Teste');
  await page.fill('#sa-empresa', 'Empresa Teste');
  await page.fill('#sa-email', 'teste@empresa.com.br');
  await page.locator('#sa-telefone').pressSequentially('11912345678');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await navegador();
  const shot = async (page, nome, opts = {}) => {
    await page.screenshot({ path: path.join(OUT, nome), ...opts });
    console.log('ok', nome);
  };

  // Página: sem faixa (ela não aparece na própria página), desktop e celular
  for (const [sufixo, vp] of [['desktop', D], ['celular', M]]) {
    const ctx = await contexto(browser, vp);
    const page = await ctx.newPage();
    await page.goto(BASE + '/ajuda-para-escolher', { waitUntil: 'networkidle' });
    await limpar(page);
    await shot(page, `01-pagina-primeira-dobra-${sufixo}.png`);
    await shot(page, `02-pagina-completa-${sufixo}.png`, { fullPage: true });
    await ctx.close();
  }

  // Obrigados: envio de teste qualificado e não qualificado
  for (const [faixa, nome, sufixo, vp] of [
    ['50_100', '03-obrigado-qualificado', 'desktop', D],
    ['20_50', '04-obrigado-nao-qualificado', 'desktop', D],
    ['50_100', '03-obrigado-qualificado', 'celular', M],
    ['20_50', '04-obrigado-nao-qualificado', 'celular', M],
  ]) {
    const ctx = await contexto(browser, vp);
    const page = await ctx.newPage();
    await page.goto(BASE + '/ajuda-para-escolher', { waitUntil: 'networkidle' });
    await preencher(page, faixa);
    await page.click('form button[type=submit]');
    await page.waitForURL(/\/ajuda-para-escolher\/(obrigado|guia)$/);
    await page.waitForLoadState('networkidle');
    await limpar(page);
    await shot(page, `${nome}-${sufixo}.png`, { fullPage: true });
    await ctx.close();
  }

  // Blocos no site (visita com a faixa no topo)
  {
    const ctx = await contexto(browser, D);
    const page = await ctx.newPage();
    await page.goto(BASE + '/categorias/erp-completo', { waitUntil: 'networkidle' });
    await limpar(page);
    await shot(page, '05-faixa-topo-e-bloco-categoria-erp-desktop.png');
    await page.goto(BASE + '/alternativas-a/rd-station-crm', { waitUntil: 'networkidle' });
    await limpar(page);
    const alt = page.locator('[data-sa-bloco="alternativas"]');
    await alt.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -140));
    await page.waitForTimeout(300);
    await shot(page, '06-bloco-alternativas-desktop.png');
    await page.goto(BASE + '/comparar/rd-station-crm-vs-ploomes', { waitUntil: 'networkidle' });
    await limpar(page);
    await page.locator('[data-sa-bloco="comparador"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 260));
    await page.waitForTimeout(300);
    await shot(page, '07-bloco-comparador-desktop.png');
    await ctx.close();
  }

  // Pop-up: visita sem faixa (fechada antes), rola 50%
  {
    const ctx = await contexto(browser, D, () => {
      try { localStorage.setItem('ps_sa_faixa_fechada_em', String(Date.now())); } catch {}
    });
    const page = await ctx.newPage();
    await page.goto(BASE + '/alternativas-a/rd-station-crm', { waitUntil: 'networkidle' });
    await limpar(page);
    await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.55));
    await page.waitForSelector('dialog[data-sa-bloco="popup"][open]', { timeout: 5000 });
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(400);
    await shot(page, '08-popup-desktop.png');
    await ctx.close();
  }

  // Celular: faixa + bloco ERP e pop-up
  {
    const ctx = await contexto(browser, M);
    const page = await ctx.newPage();
    await page.goto(BASE + '/categorias/erp-completo', { waitUntil: 'networkidle' });
    await limpar(page);
    await page.locator('[data-sa-bloco="erp"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(300);
    await shot(page, '05-bloco-categoria-erp-celular.png');
    await ctx.close();
  }
  {
    const ctx = await contexto(browser, M, () => {
      try { localStorage.setItem('ps_sa_faixa_fechada_em', String(Date.now())); } catch {}
    });
    const page = await ctx.newPage();
    await page.goto(BASE + '/alternativas-a/rd-station-crm', { waitUntil: 'networkidle' });
    await limpar(page);
    await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.55));
    await page.waitForSelector('dialog[data-sa-bloco="popup"][open]', { timeout: 5000 });
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(400);
    await shot(page, '08-popup-celular.png');
    await ctx.close();
  }

  await browser.close();
})();
