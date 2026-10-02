// QA dos blocos do site (card d41b15bf): links com UTM, rodapé, regras de frequência do pop-up e da faixa
const path = require('path');
const { SHOTS, servidor, navegador, VIEWPORTS, relatorio } = require('./_util');

(async () => {
  const r = relatorio('qa-blocos');
  const { srv, base } = await servidor(4176);
  const browser = await navegador();
  const url = base + '/blocos/demo.html';
  const rolarMeio = (p) => p.evaluate(() => { window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.6); window.dispatchEvent(new Event('scroll')); });

  // Visita 1: faixa aparece, pop-up não
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  let page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const links = await page.$$eval('.sa-bloco a, .sa-faixa a', (as) => as.map((a) => a.getAttribute('href')));
  const esperados = ['alternativas', 'erp', 'comparador', 'blog', 'faixa'].map((b) => `/ajuda-para-escolher?utm_source=portal&utm_content=${b}`);
  r.check(esperados.every((e) => links.includes(e)), `links com utm_source=portal e utm_content por bloco (${links.length})`);
  const rodapes = await page.$$eval('.sa-bloco', (bs) => bs.every((b) => /System Advisor, consultoria parceira independente/.test(b.textContent)));
  r.check(rodapes, 'todo bloco tem o rodapé "System Advisor, consultoria parceira independente"');
  r.check(/1\.343 sistemas/.test(await page.textContent('[data-sa-bloco="erp"]')), 'bloco ERP mostra o número dinâmico (1.343)');
  const blogPos = await page.evaluate(() => { const b = document.querySelector('[data-sa-bloco="blog"]'); const h = [...document.querySelectorAll('article h2')]; return b.previousElementSibling.previousElementSibling === h[1] && b.nextElementSibling === h[2]; });
  r.check(blogPos, 'bloco do blog no fim da seção do 2º subtítulo');
  r.check(await page.isVisible('.sa-faixa'), 'faixa aparece');
  await page.screenshot({ path: path.join(SHOTS, 'qa', 'blocos-desktop.png'), fullPage: false });
  await rolarMeio(page); await page.waitForTimeout(300);
  r.check(!(await page.$('dialog.sa-popup[open]')), 'com a faixa na visita, o pop-up não aparece em 50%');

  // Fecha a faixa → nova visita (nova aba = nova sessão) → pop-up em 50%
  await page.click('.sa-faixa .sa-fechar');
  await page.close();
  page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  r.check(!(await page.$('.sa-faixa')), 'faixa fechada não volta (30 dias)');
  r.check(!(await page.$('dialog.sa-popup[open]')), 'pop-up não aparece antes de 50% da rolagem');
  await rolarMeio(page);
  const abriu = await page.waitForSelector('dialog.sa-popup[open]', { timeout: 3000 }).then(() => true).catch(() => false);
  r.check(abriu, 'pop-up aparece ao rolar 50%');
  r.check(await page.getAttribute('dialog.sa-popup a', 'href') === '/ajuda-para-escolher?utm_source=portal&utm_content=popup', 'botão do pop-up com utm_content=popup');
  await page.screenshot({ path: path.join(SHOTS, 'qa', 'blocos-popup-desktop.png') });
  await page.keyboard.press('Escape');
  r.check(!(await page.$('dialog.sa-popup[open]')), 'Esc fecha o pop-up');
  await page.reload({ waitUntil: 'networkidle' }); await rolarMeio(page); await page.waitForTimeout(300);
  r.check(!(await page.$('dialog.sa-popup[open]')), 'depois de fechado, não aparece de novo (30 dias)');

  // Passados 31 dias, volta
  await page.evaluate(() => { localStorage.setItem('ps_sa_popup_fechado_em', String(Date.now() - 31 * 864e5)); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' }); await rolarMeio(page); await page.waitForTimeout(300);
  r.check(!!(await page.$('dialog.sa-popup[open]')), 'depois de 30 dias volta a aparecer');

  // Quem enviou o formulário nunca mais vê pop-up nem faixa
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('ps_sa_form_enviado', '1'); });
  await page.reload({ waitUntil: 'networkidle' }); await rolarMeio(page); await page.waitForTimeout(300);
  r.check(!(await page.$('dialog.sa-popup[open]')) && !(await page.$('.sa-faixa')), 'quem já enviou o formulário não vê pop-up nem faixa');
  await ctx.close();

  // Mobile: sem rolagem horizontal
  const m = await browser.newPage({ viewport: VIEWPORTS.mini });
  await m.goto(url, { waitUntil: 'networkidle' });
  r.check(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'blocos sem rolagem horizontal em 360px');
  await m.screenshot({ path: path.join(SHOTS, 'qa', 'blocos-mobile.png'), fullPage: false });

  await browser.close();
  srv.close();
  r.fim();
})();
