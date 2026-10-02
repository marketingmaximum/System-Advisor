// QA do funil: UTMs na entrada → validação → envio qualificado e não qualificado → conversão única por event_id
const path = require('path');
const { SHOTS, servidor, navegador, VIEWPORTS, relatorio } = require('./_util');

const PII = /maria|teste@empresa|11987654321|987654321|ACME|Planilhas Antigas/i;

async function preencher(page, faixa) {
  await page.selectOption('#faturamento', faixa);
  await page.selectOption('#funcionarios', '201_500');
  await page.fill('#sistema_atual', 'Planilhas Antigas');
  await page.selectOption('#prazo', '3_6m');
  await page.fill('#nome', 'Maria Teste');
  await page.fill('#empresa', 'ACME Indústria');
  await page.fill('#email', 'maria.teste@empresa.com.br');
  await page.type('#telefone', '11987654321');
}

const dl = (page) => page.evaluate(() => (window.dataLayer || []).map((e) => ({ ...e })));

(async () => {
  const r = relatorio('qa-fluxo');
  const { srv, base } = await servidor(4175);
  const browser = await navegador();

  // 1 · Validação: envio vazio
  {
    const page = await browser.newPage({ viewport: VIEWPORTS.mobile });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.click('#form-submit');
    const invalidos = await page.$$eval('.field.invalid', (f) => f.length);
    r.check(invalidos === 8, `envio vazio marca os 8 campos (${invalidos})`);
    const st = await page.textContent('#form-status');
    r.check(/8 campos/.test(st), `mensagem geral de erro: "${st}"`);
    const foco = await page.evaluate(() => document.activeElement.id);
    r.check(foco === 'faturamento', `foco vai para o primeiro campo com erro (${foco})`);
    await page.fill('#email', 'maria@');
    await page.locator('#email').blur();
    r.check(await page.locator('#email').getAttribute('aria-invalid') === 'true', 'e-mail inválido sinalizado com aria-invalid');
    await page.type('#telefone', '1198');
    r.check(await page.inputValue('#telefone') === '(11) 98', `máscara de telefone (${await page.inputValue('#telefone')})`);
    await page.screenshot({ path: path.join(SHOTS, 'qa', 'fluxo-erros-mobile.png'), fullPage: false });
    await page.locator('#conversar').screenshot({ path: path.join(SHOTS, 'qa', 'fluxo-erros-form.png') });
    await page.close();
  }

  // 2 · Lead qualificado vindo do Google Ads
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const page = await ctx.newPage();
    await page.goto(base + '/?utm_source=google&utm_medium=cpc&utm_campaign=sa_pesquisa&utm_term=como%20escolher%20erp&gclid=TESTE-GCLID-123', { waitUntil: 'networkidle' });
    const ocultos = await page.$$eval('#form-lead input[type=hidden]', (is) => Object.fromEntries(is.map((i) => [i.name, i.value])));
    r.check(ocultos.utm_source === 'google' && ocultos.gclid === 'TESTE-GCLID-123' && ocultos.utm_term === 'como escolher erp', 'UTMs e gclid capturados nos campos ocultos');

    // a origem continua depois de navegar sem parâmetros (sessão)
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    r.check(await page.inputValue('input[name=gclid]') === 'TESTE-GCLID-123', 'gclid guardado na sessão após recarregar sem parâmetros');

    await page.click('[data-cta="hero"]');
    await preencher(page, '50_100');
    await page.click('#form-submit');
    await page.waitForURL('**/obrigado-especialista.html');
    r.ok('faturamento R$ 50 a 100 mi → obrigado-especialista.html');

    const ev = await dl(page);
    const conv = ev.filter((e) => e.event === 'lead_qualificado');
    r.check(conv.length === 1 && conv[0].event_id, `lead_qualificado disparou 1x com event_id ${conv[0] && conv[0].event_id}`);
    r.check(conv[0] && conv[0].utm_source === 'google', 'conversão carrega utm_source=google');
    r.check(!ev.some((e) => e.event === 'lead_nao_qualificado'), 'sem evento de não qualificado');
    r.check(!PII.test(JSON.stringify(ev)), 'dataLayer da página de obrigado sem nome, e-mail, telefone, empresa ou sistema');

    await page.reload({ waitUntil: 'networkidle' });
    const conv2 = (await dl(page)).filter((e) => e.event === 'lead_qualificado');
    r.check(conv2.length === 0, 'recarregar o obrigado não dispara a conversão de novo');
    await page.goBack(); await page.goForward({ waitUntil: 'networkidle' });
    r.check((await dl(page)).filter((e) => e.event === 'lead_qualificado').length === 0, 'voltar e avançar não dispara de novo');
    r.check(await page.evaluate(() => localStorage.getItem('ps_sa_form_enviado')) === '1', 'marca "já enviou" para o pop-up dos blocos');
    await page.screenshot({ path: path.join(SHOTS, 'qa', 'fluxo-obrigado-especialista-desktop.png') });
    await ctx.close();
  }

  // 3 · Lead não qualificado vindo de um bloco do Portal + conferência do payload e do dataLayer da LP
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.mobile });
    const page = await ctx.newPage();
    await page.goto(base + '/?utm_source=portal&utm_content=comparador', { waitUntil: 'networkidle' });
    await preencher(page, '20_50');
    await page.click('#form-submit');
    await page.waitForURL('**/obrigado-guia.html');
    r.ok('faturamento R$ 20 a 50 mi → obrigado-guia.html');
    const ev = await dl(page);
    r.check(ev.filter((e) => e.event === 'lead_nao_qualificado').length === 1, 'lead_nao_qualificado disparou 1x');
    r.check(!ev.some((e) => e.event === 'lead_qualificado'), 'nenhuma conversão de Ads no não qualificado');
    const nq = ev.find((e) => e.event === 'lead_nao_qualificado');
    r.check(nq && nq.utm_content === 'comparador', 'utm_content=comparador chega ao evento');
    await page.screenshot({ path: path.join(SHOTS, 'qa', 'fluxo-obrigado-guia-mobile.png'), fullPage: true });

    // acesso direto ao obrigado-especialista com lead não qualificado é redirecionado e não converte
    await page.goto(base + '/obrigado-especialista.html', { waitUntil: 'networkidle' });
    r.check(page.url().endsWith('obrigado-guia.html'), 'não qualificado que abre o obrigado-especialista volta para o obrigado-guia');
    r.check(!(await dl(page)).some((e) => e.event === 'lead_qualificado'), 'e não dispara conversão');
    await ctx.close();
  }

  // 4 · Payload e eventos da LP (sem sair da página)
  {
    const page = await browser.newPage({ viewport: VIEWPORTS.desktop });
    await page.goto(base + '/?utm_source=portal&utm_content=erp', { waitUntil: 'networkidle' });
    // 204 segura a navegação e mantém a LP aberta para ler o payload
    await page.route('**/obrigado-*.html', (route) => route.fulfill({ status: 204, body: '' }));
    await preencher(page, 'acima_500');
    await page.click('#form-submit').catch(() => {});
    await page.waitForFunction(() => window.__psLeadPreview);
    const p = await page.evaluate(() => window.__psLeadPreview);
    const campos = ['nome', 'email', 'telefone', 'empresa', 'faturamento', 'funcionarios', 'sistema_atual', 'prazo', 'origem', 'bloco_origem', 'data', 'event_id', 'utm_source', 'utm_content', 'gclid'];
    r.check(campos.every((c) => c in p), 'payload tem os campos do card de integração + UTMs e event_id');
    r.check(p.origem === 'Portal Software' && p.bloco_origem === 'erp' && p.qualificado === true, `origem=${p.origem}, bloco_origem=${p.bloco_origem}, qualificado=${p.qualificado}`);
    r.check(p.telefone === '11987654321', 'telefone só com números no payload');
    const ev = await dl(page);
    const nomes = ev.map((e) => e.event).filter(Boolean);
    r.check(['form_start', 'form_submit'].every((n) => nomes.includes(n)), `eventos da LP: ${nomes.join(', ')}`);
    r.check(!PII.test(JSON.stringify(ev)), 'dataLayer da LP sem dado pessoal');
    await page.close();
  }

  // 5 · Acesso direto ao obrigado, sem envio: nenhum evento
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(base + '/obrigado-especialista.html', { waitUntil: 'networkidle' });
    r.check(!(await dl(page)).some((e) => /^lead_/.test(e.event || '')), 'abrir o obrigado direto (sem envio) não dispara conversão');
    await ctx.close();
  }

  await browser.close();
  srv.close();
  r.fim();
})();
