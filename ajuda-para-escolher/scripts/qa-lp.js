// QA da página: estrutura, SEO, acessibilidade básica, rastreamento sem vendor, overflow, LCP e screenshots
const fs = require('fs');
const path = require('path');
const { SHOTS, servidor, navegador, VIEWPORTS, relatorio } = require('./_util');

(async () => {
  const r = relatorio('qa-lp');
  const { srv, base } = await servidor();
  const browser = await navegador();
  fs.mkdirSync(path.join(SHOTS, 'qa'), { recursive: true });

  for (const [nome, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    r.check(overflow <= 0, `${nome} ${vp.width}px: sem rolagem horizontal (${overflow}px)`);
    r.check(erros.length === 0, `${nome}: sem erro de JavaScript ${erros.length ? '→ ' + erros.join(' | ') : ''}`);

    // CTA principal visível na primeira dobra
    const cta = await page.locator('[data-cta="hero"]').boundingBox();
    r.check(cta && cta.y + cta.height <= vp.height, `${nome}: botão do hero na primeira dobra (base em ${cta && Math.round(cta.y + cta.height)}px de ${vp.height})`);

    await page.screenshot({ path: path.join(SHOTS, 'qa', `lp-${nome}-dobra.png`) });
    if (nome !== 'mini') await page.screenshot({ path: path.join(SHOTS, 'qa', `lp-${nome}-inteira.png`), fullPage: true });

    if (nome === 'mobile') {
      // LCP no celular com rede 4G lenta e CPU 4x (aproximação local, sem CDN)
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(base + '/', { waitUntil: 'load' });
      const lcp = await page.evaluate(() => new Promise((res) => {
        let v = 0;
        new PerformanceObserver((l) => { const e = l.getEntries(); v = e[e.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => res(Math.round(v)), 2500);
      }));
      r.check(lcp > 0 && lcp <= 2500, `mobile: LCP ${lcp} ms com 4G lenta + CPU 4x (meta ≤ 2500)`);
    }
    await ctx.close();
  }

  // Checagens de estrutura (desktop)
  const page = await browser.newPage({ viewport: VIEWPORTS.desktop });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const d = await page.evaluate(() => {
    const txt = (s) => (document.querySelector(s) || {}).textContent || '';
    const campos = [...document.querySelectorAll('#form-lead input:not([type=hidden]):not([name=website]), #form-lead select')];
    return {
      h1s: document.querySelectorAll('h1').length,
      h1: txt('h1').trim(),
      robots: (document.querySelector('meta[name=robots]') || {}).content,
      canonical: (document.querySelector('link[rel=canonical]') || {}).href,
      title: document.title,
      descr: (document.querySelector('meta[name=description]') || {}).content || '',
      semLabel: campos.filter((c) => !document.querySelector(`label[for="${c.id}"]`)).map((c) => c.name),
      semErro: campos.filter((c) => !document.getElementById(c.getAttribute('aria-describedby') || '-')).map((c) => c.name),
      imgsSemAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      ocultos: [...document.querySelectorAll('#form-lead input[type=hidden]')].map((i) => i.name),
      scripts: [...document.querySelectorAll('script')].map((s) => s.src || s.textContent.slice(0, 80)),
      html: document.documentElement.outerHTML,
      linkAgencia: !!document.querySelector('footer a[href^="https://agenciamaximum.com"]'),
      lgpdPerto: (() => { const b = document.getElementById('form-submit'); const l = document.getElementById('lgpd'); return !!(b && l && b.parentElement === l.parentElement); })(),
      ctaHrefs: [...document.querySelectorAll('[data-cta]')].map((a) => a.getAttribute('href')),
      ctaTextos: [...document.querySelectorAll('.btn-primary')].map((a) => a.textContent.trim()),
      parceira: (document.body.innerText.match(/consultoria parceira independente/gi) || []).length,
      equipePortal: /equipe do portal|nossa equipe|nossos consultores/i.test(document.body.innerText),
      preco: /R\$\s?\d[\d.,]*\s?(\/m[eê]s|por m[eê]s)|pre[cç]o|desconto|oferta especial|gr[aá]tis por/i.test(
        [...document.querySelectorAll('main section:not(#conversar)')].map((s) => s.innerText).join(' ')),
      pendentes: [...document.querySelectorAll('[data-pendente]')].map((e) => e.getAttribute('data-pendente'))
    };
  });

  r.check(d.h1s === 1, `um único H1 (${d.h1s})`);
  r.check(d.h1 === 'Precisa de ajuda para escolher um sistema de gestão?', `H1 do card: "${d.h1}"`);
  r.check(/sistema de gestão/i.test(d.h1), 'H1 tem a palavra buscada ("sistema de gestão") e não é o nome da empresa');
  r.check(/noindex/.test(d.robots), `noindex durante a aprovação (${d.robots})`);
  r.check(d.canonical === 'https://portalsoftware.com.br/ajuda-para-escolher', 'canonical para portalsoftware.com.br/ajuda-para-escolher');
  r.check(d.title.length <= 95 && /ERP/.test(d.title), `title com ERP (${d.title.length} caracteres)`);
  r.check(d.descr.length >= 110 && d.descr.length <= 170, `meta description com ${d.descr.length} caracteres`);
  r.check(d.semLabel.length === 0, `todo campo com label ${d.semLabel.join(',')}`);
  r.check(d.semErro.length === 0, `todo campo com mensagem de erro ligada ${d.semErro.join(',')}`);
  r.check(d.imgsSemAlt === 0, 'toda imagem com alt');
  const esperados = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid', 'fbclid'];
  r.check(esperados.every((k) => d.ocultos.includes(k)), `campos ocultos: ${d.ocultos.join(', ')}`);
  const vendor = /googletagmanager|gtag\(|fbq\(|connect\.facebook|google-analytics|googleadservices|clarity\.ms|hotjar/i;
  r.check(!vendor.test(d.html), 'nenhuma tag de fornecedor no HTML (GTM, gtag, Pixel, Ads, Clarity, Hotjar)');
  r.check(d.scripts.every((s) => /js\/(rastreamento|lp)\.js$/.test(s)), `só scripts próprios: ${d.scripts.map((s) => s.split('/').pop()).join(', ')}`);
  r.check(d.linkAgencia, 'link para agenciamaximum.com no rodapé');
  r.check(d.lgpdPerto, 'aviso de LGPD junto do botão de envio');
  r.check(d.ctaHrefs.every((h) => h === '#conversar'), `todos os CTAs levam ao formulário (${d.ctaHrefs.length})`);
  r.check(new Set(d.ctaTextos).size === 1, `um CTA dominante com texto único: "${[...new Set(d.ctaTextos)].join('" / "')}"`);
  r.check(d.parceira >= 3, `"consultoria parceira independente" aparece ${d.parceira}x`);
  r.check(!d.equipePortal, 'System Advisor nunca aparece como equipe do Portal');
  r.check(!d.preco, 'nenhum preço ou oferta no conteúdo');
  r.aviso(`trechos marcados como pendentes: ${[...new Set(d.pendentes)].join(', ')} (${d.pendentes.length})`);

  // Contraste AA dos pares de cor usados em texto
  const pares = await page.evaluate(() => {
    function rgb(c) { const m = c.match(/[\d.]+/g).map(Number); return m.slice(0, 3); }
    function lum([r, g, b]) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
    function bg(el) { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; el = el.parentElement; } return 'rgb(255,255,255)'; }
    const amostras = ['.lead', '.label', '.partner-note', '.hero-context', '.lgpd', '.toc .d', '.errors-list p', '.step-row p', '.btn-primary', '.field input', '.crumb', '.site-footer p'];
    // converte qualquer cor CSS (inclusive oklch) em RGB pintando 1 pixel no canvas
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    function norm(c) { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#fff'; cx.fillRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); }
    return amostras.map((s) => { const el = document.querySelector(s); if (!el) return null; const fg = norm(getComputedStyle(el).color); const b = norm(bg(el)); const L1 = lum(fg), L2 = lum(b); return { s, ratio: +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2)) }; }).filter(Boolean);
  });
  pares.forEach((p) => r.check(p.ratio >= 4.5, `contraste ${p.s}: ${p.ratio}:1`));

  // Foco visível
  await page.keyboard.press('Tab');
  const foco = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  r.check(foco !== 'none', `foco visível no primeiro Tab (${foco})`);

  await browser.close();
  srv.close();
  r.fim();
})();
