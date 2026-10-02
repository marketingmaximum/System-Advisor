// QA da integração no Portal (Next.js) rodando em http://localhost:3000 (next dev ou next start).
// Uso: BASE=http://localhost:3000 node scripts/qa-portal.js
// Bloqueia GTM/GA4 para não sujar o Analytics durante o teste.
const fs = require('fs');
const path = require('path');
const { SHOTS, navegador, VIEWPORTS, relatorio } = require('./_util');

const BASE = process.env.BASE || 'http://localhost:3000';
const PAGINA = BASE + '/ajuda-para-escolher';
const PII = /maria|qa\.portal@empresa|11987654321|987654321|ACME QA|Planilhas QA/i;
const OUT = path.join(SHOTS, 'portal');

async function novoContexto(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.route(/googletagmanager\.com|google-analytics\.com|gravatar\.com/, (r) => r.abort());
  return ctx;
}
const dl = (page) => page.evaluate(() => (window.dataLayer || []).filter((e) => e && e.event).map((e) => ({ ...e })));

async function preencher(page, faixa, funcionarios = 'ate_50') {
  await page.selectOption('#sa-faturamento', faixa);
  await page.selectOption('#sa-funcionarios', funcionarios);
  await page.fill('#sa-sistema_atual', 'Planilhas QA');
  await page.selectOption('#sa-prazo', '3_6m');
  await page.fill('#sa-nome', 'Maria QA');
  await page.fill('#sa-empresa', 'ACME QA');
  await page.fill('#sa-email', 'qa.portal@empresa.com.br');
  await page.locator('#sa-telefone').pressSequentially('11987654321');
}

(async () => {
  const r = relatorio('qa-portal');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await navegador();

  // 1 · Página: estrutura e layout
  for (const [nome, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await novoContexto(browser, vp);
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    // a faixa da System Advisor não aparece na própria página de destino
    r.check(!(await page.$('[data-sa-bloco="faixa"]')), `${nome}: sem faixa na própria /ajuda-para-escolher`);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    r.check(ov <= 0, `${nome} ${vp.width}px: sem rolagem horizontal (${ov}px)`);
    r.check(erros.length === 0, `${nome}: sem erro de JavaScript ${erros.join(' | ')}`);
    const cta = await page.locator('[data-cta="hero"]').boundingBox();
    r.check(cta && cta.y + cta.height <= vp.height, `${nome}: botão do hero na primeira dobra (${cta && Math.round(cta.y + cta.height)}px de ${vp.height})`);
    await page.screenshot({ path: path.join(OUT, `lp-${nome}-dobra.png`) });
    if (nome !== 'mini') await page.screenshot({ path: path.join(OUT, `lp-${nome}-inteira.png`), fullPage: true });
    await ctx.close();
  }

  {
    const ctx = await novoContexto(browser, VIEWPORTS.desktop);
    const page = await ctx.newPage();
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    const d = await page.evaluate(() => ({
      erros: document.querySelectorAll('#dar-errado li').length,
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
      robots: document.querySelector('meta[name=robots]')?.content,
      canonical: document.querySelector('link[rel=canonical]')?.href,
      title: document.title,
      ordem: [...document.querySelectorAll('[data-secao]')].map((s) => s.dataset.secao),
      parceira: (document.body.innerText.match(/consultoria parceira independente/gi) || []).length,
      equipe: /equipe do portal|nossa equipe|nossos consultores/i.test(document.body.innerText),
      ctas: [...document.querySelectorAll('[data-cta]')].map((a) => a.getAttribute('href')),
      semLabel: [...document.querySelectorAll('form input:not([type=hidden]):not([tabindex="-1"]), form select')].filter((c) => !document.querySelector(`label[for="${c.id}"]`)).length,
      lgpd: !!document.getElementById('sa-lgpd') && /System Advisor/.test(document.getElementById('sa-lgpd').textContent),
      agencia: !!document.querySelector('footer a[href*="agenciamaximum.com"]'),
    }));
    r.check(d.h1.length === 1 && d.h1[0] === 'Precisa de ajuda para escolher um sistema de gestão?', `H1 único do card: ${d.h1.join(' | ')}`);
    r.check(/noindex/.test(d.robots || ''), `noindex durante a aprovação (${d.robots})`);
    r.check(d.canonical === 'https://portalsoftware.com.br/ajuda-para-escolher', `canonical ${d.canonical}`);
    r.check(/ERP/.test(d.title) && /Portal Software/.test(d.title), `title: ${d.title}`);
    r.check(JSON.stringify(d.ordem) === JSON.stringify(['hero', 'dar-errado', 'trocar-ou-ajustar', 'passo-a-passo', 'quem-atende', 'conversar']), `ordem das dobras: ${d.ordem.join(' → ')}`);
    r.check(d.parceira >= 4, `"consultoria parceira independente" ${d.parceira}x`);
    r.check(!d.equipe, 'System Advisor nunca como equipe do Portal');
    r.check(d.ctas.every((h) => /#conversar$/.test(h)), `CTAs levam ao formulário (${d.ctas.length})`);
    r.check(d.semLabel === 0, 'todo campo com label');
    r.check(d.erros === 7, `dobra 2 com as 7 dores do Alexandre (${d.erros})`);
    r.check(d.lgpd, 'aviso de LGPD junto do botão, citando a System Advisor');
    r.check(d.agencia, 'link para agenciamaximum.com no rodapé do Portal');
    for (const s of ['dar-errado', 'trocar-ou-ajustar', 'passo-a-passo', 'quem-atende', 'conversar']) {
      await page.locator(`[data-secao="${s}"]`).screenshot({ path: path.join(OUT, `secao-desktop-${s}.png`) });
    }
    await ctx.close();
  }

  // 2 · Validação
  {
    const ctx = await novoContexto(browser, VIEWPORTS.mobile);
    const page = await ctx.newPage();
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    await page.click('form button[type=submit]');
    const inval = await page.$$eval('form [aria-invalid="true"]', (e) => e.length);
    r.check(inval === 8, `envio vazio marca os 8 campos (${inval})`);
    r.check(await page.evaluate(() => document.activeElement.id) === 'sa-faturamento', 'foco no primeiro campo com erro');
    await page.locator('#sa-telefone').pressSequentially('1198');
    r.check(await page.inputValue('#sa-telefone') === '(11) 98', 'máscara de telefone');
    await page.locator('[data-secao="conversar"]').screenshot({ path: path.join(OUT, 'form-erros-mobile.png') });
    await ctx.close();
  }

  // 3 · Lead qualificado vindo do Google Ads → grava, obrigado do especialista, conversão única
  let qualificadoId = null;
  {
    const ctx = await novoContexto(browser, VIEWPORTS.desktop);
    const page = await ctx.newPage();
    await page.goto(PAGINA + '?utm_source=google&utm_medium=cpc&utm_campaign=sa_pesquisa&utm_term=como%20escolher%20erp&gclid=QA-GCLID&gbraid=QA-GBRAID', { waitUntil: 'networkidle' });
    await page.click('[data-cta="hero"]');
    await preencher(page, '50_100');
    const resp = page.waitForResponse((res) => res.url().includes('/api/leads/system-advisor'));
    await page.click('form button[type=submit]');
    const json = await (await resp).json();
    qualificadoId = json.leadId;
    r.check(json.success && json.qualificado === true, `API: qualificado=true (lead ${json.leadId})`);
    await page.waitForURL('**/ajuda-para-escolher/obrigado');
    await page.waitForTimeout(500);
    const ev = await dl(page);
    const conv = ev.filter((e) => e.event === 'lead_qualificado');
    r.check(conv.length === 1 && conv[0].event_id, `lead_qualificado 1x (event_id ${conv[0] && conv[0].event_id})`);
    r.check(conv[0] && conv[0].utm_source === 'google', 'conversão com utm_source=google');
    r.check(ev.some((e) => e.event === 'form_submit' && e.qualificado === true), 'form_submit com qualificado=true');
    r.check(ev.some((e) => e.event === 'cta_click' && e.cta_position === 'hero'), 'cta_click do hero');
    r.check(!PII.test(JSON.stringify(ev)), 'dataLayer sem nome, e-mail, telefone, empresa ou sistema');
    await page.screenshot({ path: path.join(OUT, 'obrigado-especialista-desktop.png'), fullPage: true });
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    r.check(!(await dl(page)).some((e) => e.event === 'lead_qualificado'), 'recarregar não dispara a conversão de novo');
    // quem enviou não vê faixa nem pop-up nos blocos
    await page.goto(BASE + '/categorias/erp-completo', { waitUntil: 'networkidle' });
    r.check(!(await page.$('[data-sa-bloco="faixa"]')), 'quem enviou o formulário não vê a faixa');
    await ctx.close();
  }

  // 4 · Lead não qualificado vindo de um bloco → obrigado do guia, sem conversão
  let naoQualificadoId = null;
  {
    const ctx = await novoContexto(browser, VIEWPORTS.mobile);
    const page = await ctx.newPage();
    await page.goto(PAGINA + '?utm_source=portal&utm_content=comparador', { waitUntil: 'networkidle' });
    await preencher(page, '20_50', '51_150');
    const resp = page.waitForResponse((res) => res.url().includes('/api/leads/system-advisor'));
    await page.click('form button[type=submit]');
    const json = await (await resp).json();
    naoQualificadoId = json.leadId;
    r.check(json.success && json.qualificado === false, `API: qualificado=false (lead ${json.leadId})`);
    await page.waitForURL('**/ajuda-para-escolher/guia');
    await page.waitForTimeout(500);
    const ev = await dl(page);
    r.check(ev.filter((e) => e.event === 'lead_nao_qualificado').length === 1, 'lead_nao_qualificado 1x');
    r.check(!ev.some((e) => e.event === 'lead_qualificado'), 'nenhuma conversão de Ads');
    r.check(ev.find((e) => e.event === 'lead_nao_qualificado')?.utm_content === 'comparador', 'utm_content=comparador no evento');
    await page.screenshot({ path: path.join(OUT, 'obrigado-guia-mobile.png'), fullPage: true });
    await page.goto(BASE + '/ajuda-para-escolher/obrigado', { waitUntil: 'networkidle' });
    await page.waitForURL('**/ajuda-para-escolher/guia', { timeout: 5000 }).catch(() => {});
    r.check(page.url().endsWith('/ajuda-para-escolher/guia'), 'não qualificado no obrigado do especialista volta para o do guia');
    await ctx.close();
  }

  // 4b · Qualificado só pelo número de funcionários (mais de 150), com faturamento baixo
  {
    const ctx = await novoContexto(browser, VIEWPORTS.desktop);
    const page = await ctx.newPage();
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    await preencher(page, 'ate_20', '151_500');
    const resp = page.waitForResponse((res) => res.url().includes('/api/leads/system-advisor'));
    await page.click('form button[type=submit]');
    const json = await (await resp).json();
    r.check(json.qualificado === true, 'faturamento até R$ 20 mi + 151 a 500 funcionários → qualificado');
    await page.waitForURL('**/ajuda-para-escolher/obrigado');
    r.ok('… e vai para o obrigado do especialista');
    const lim = await ctx.request.post(BASE + '/api/leads/system-advisor', {
      data: { faturamento: '20_50', funcionarios: '51_150', sistema_atual: 'x QA', prazo: 'pesquisando', nome: 'Maria QA', empresa: 'ACME QA', email: 'qa.portal@empresa.com.br', telefone: '11987654321' },
    });
    r.check((await lim.json()).qualificado === false, 'R$ 20 a 49 mi + 51 a 150 funcionários → não qualificado');
    await ctx.close();
  }

  // 5 · Servidor não confia no navegador: forja qualificado com faixa baixa
  {
    const ctx = await novoContexto(browser, VIEWPORTS.desktop);
    const res = await ctx.request.post(BASE + '/api/leads/system-advisor', {
      data: { faturamento: 'ate_20', funcionarios: 'ate_50', sistema_atual: 'x QA', prazo: 'pesquisando', nome: 'Maria QA', empresa: 'ACME QA', email: 'qa.portal@empresa.com.br', telefone: '11987654321', qualificado: true },
    });
    const j = await res.json();
    r.check(j.qualificado === false, 'API refaz o filtro e ignora "qualificado" vindo do navegador');
    const bad = await ctx.request.post(BASE + '/api/leads/system-advisor', { data: { faturamento: 'xx', email: 'a' } });
    r.check(bad.status() === 400, `API recusa dado inválido (${bad.status()})`);
    await ctx.close();
  }

  // 6 · Blocos fixos
  {
    const ctx = await novoContexto(browser, VIEWPORTS.desktop);
    const page = await ctx.newPage();
    await page.goto(BASE + '/categorias/erp-completo', { waitUntil: 'networkidle' });
    const erp = await page.$('[data-sa-bloco="erp"]');
    r.check(!!erp, 'bloco na categoria ERP completo');
    if (erp) {
      const txt = await erp.textContent();
      r.check(/São [\d.]+ sistemas aqui/.test(txt), `número dinâmico: "${txt.match(/São [\d.]+ sistemas/)?.[0]}"`);
      r.check(await erp.$eval('a', (a) => a.getAttribute('href')) === '/ajuda-para-escolher?utm_source=portal&utm_content=erp', 'link utm_content=erp');
      await erp.screenshot({ path: path.join(OUT, 'bloco-erp.png') });
    }
    r.check(!!(await page.$('[data-sa-bloco="faixa"]')), 'faixa aparece no topo');
    await page.screenshot({ path: path.join(OUT, 'categoria-erp-desktop.png') });
    await page.goto(BASE + '/categorias/erp-varejo', { waitUntil: 'networkidle' });
    r.check(!(await page.$('[data-sa-bloco="erp"]')), 'bloco ERP não aparece em outra categoria');

    await page.goto(BASE + '/alternativas-a/rd-station-crm', { waitUntil: 'networkidle' });
    const alt = await page.$('[data-sa-bloco="alternativas"]');
    r.check(!!alt && (await alt.$eval('a', (a) => a.getAttribute('href'))).endsWith('utm_content=alternativas'), 'bloco nas alternativas, acima da lista');
    if (alt) await alt.screenshot({ path: path.join(OUT, 'bloco-alternativas.png') });

    await page.goto(BASE + '/comparar/rd-station-crm-vs-ploomes', { waitUntil: 'networkidle' });
    const cmp = await page.$('[data-sa-bloco="comparador"]');
    const depoisTabela = await page.evaluate(() => {
      const t = document.querySelector('table'); const b = document.querySelector('[data-sa-bloco="comparador"]');
      return !!(t && b && (t.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    r.check(!!cmp && depoisTabela, 'bloco no comparador, depois da tabela');
    if (cmp) await cmp.screenshot({ path: path.join(OUT, 'bloco-comparador.png') });
    const rodapes = await page.$$eval('[data-sa-bloco]', (bs) => bs.every((b) => /System Advisor, consultoria parceira independente/.test(b.textContent)));
    r.check(rodapes, 'todo bloco com o rodapé da System Advisor');
    await ctx.close();
  }

  // 7 · Faixa × pop-up × newsletter
  {
    const ctx = await novoContexto(browser, VIEWPORTS.desktop);
    // isola do pop-up da newsletter (testado no bloco seguinte)
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('qa_nl')) { localStorage.setItem('ps_newsletter_subscribed', '1'); sessionStorage.setItem('qa_nl', '1'); } } catch {} });
    let page = await ctx.newPage();
    const url = BASE + '/alternativas-a/rd-station-crm';
    const rolar = async (p) => { await p.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.6)); await p.waitForTimeout(800); };
    await page.goto(url, { waitUntil: 'networkidle' });
    r.check(!!(await page.$('[data-sa-bloco="faixa"]')), 'visita 1: faixa');
    await rolar(page);
    r.check(!(await page.$('dialog[data-sa-bloco="popup"][open]')), 'visita 1: com faixa, sem pop-up da System Advisor');
    await page.click('[data-sa-bloco="faixa"] button');
    await page.close();
    // nova visita (nova aba = nova sessão), sem o pop-up da newsletter atrapalhar o teste
    page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    r.check(!(await page.$('[data-sa-bloco="faixa"]')), 'visita 2: faixa fechada não volta');
    await rolar(page);
    const abriu = await page.waitForSelector('dialog[data-sa-bloco="popup"][open]', { timeout: 4000 }).then(() => true).catch(() => false);
    r.check(abriu, 'visita 2: pop-up em 50% da rolagem');
    if (abriu) {
      r.check((await page.getAttribute('dialog[data-sa-bloco="popup"] a', 'href')).endsWith('utm_content=popup'), 'pop-up com utm_content=popup');
      await page.screenshot({ path: path.join(OUT, 'popup-desktop.png') });
      await page.keyboard.press('Escape');
      r.check(!(await page.$('dialog[open]')), 'Esc fecha o pop-up');
      // a newsletter não abre na mesma visita
      await page.evaluate(() => localStorage.removeItem('ps_newsletter_subscribed'));
    }
    await page.reload({ waitUntil: 'networkidle' }); await rolar(page);
    r.check(!(await page.$('dialog[data-sa-bloco="popup"][open]')), 'pop-up fechado não volta (30 dias)');
    const ev = await dl(page);
    r.check(!PII.test(JSON.stringify(ev)), 'dataLayer dos blocos sem dado pessoal');
    await ctx.close();
  }

  {
    // newsletter não abre depois do pop-up da System Advisor na mesma visita
    const ctx = await novoContexto(browser, VIEWPORTS.desktop);
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('ps_sa_faixa_fechada_em', String(Date.now())); } catch {} });
    await page.goto(BASE + '/alternativas-a/rd-station-crm', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.52));
    await page.waitForSelector('dialog[data-sa-bloco="popup"][open]', { timeout: 4000 }).catch(() => {});
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1200);
    const dialogs = await page.$$eval('dialog[open]', (d) => d.length);
    r.check(dialogs === 0, 'pop-up da newsletter não abre na mesma visita do pop-up da System Advisor');
    await ctx.close();
  }

  // 8 · Mobile 360: blocos sem rolagem horizontal
  {
    const ctx = await novoContexto(browser, VIEWPORTS.mini);
    const page = await ctx.newPage();
    await page.goto(BASE + '/categorias/erp-completo', { waitUntil: 'networkidle' });
    r.check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'categoria ERP com bloco e faixa sem rolagem horizontal em 360px');
    await page.screenshot({ path: path.join(OUT, 'categoria-erp-mini.png') });
    await ctx.close();
  }

  fs.writeFileSync(path.join(OUT, 'leads-teste.json'), JSON.stringify({ qualificadoId, naoQualificadoId }));
  await browser.close();
  r.fim();
})();
