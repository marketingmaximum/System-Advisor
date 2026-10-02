// Utilitários de QA: servidor estático local + navegador (Chromium do Playwright, com Edge de reserva)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'assets', 'screens');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

function servidor(porta = 4173) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let url = decodeURIComponent(req.url.split('?')[0]);
      if (url === '/' || url === '/ajuda-para-escolher') url = '/index.html';
      const arq = path.join(ROOT, path.normalize(url));
      if (!arq.startsWith(ROOT) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404 (rota do Portal, fora deste protótipo)');
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
      fs.createReadStream(arq).pipe(res);
    });
    srv.listen(porta, () => resolve({ srv, base: `http://localhost:${porta}` }));
  });
}

async function navegador() {
  const { chromium } = require('playwright');
  try { return await chromium.launch(); }
  catch (e) {
    console.warn('Chromium do Playwright falhou, tentando o Edge:', e.message.split('\n')[0]);
    return chromium.launch({ channel: 'msedge' });
  }
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
  mini: { width: 360, height: 740 }
};

function relatorio(nome) {
  const itens = [];
  return {
    ok: (msg) => itens.push(['OK  ', msg]),
    falha: (msg) => itens.push(['FALHA', msg]),
    aviso: (msg) => itens.push(['AVISO', msg]),
    check: (cond, msg) => itens.push([cond ? 'OK  ' : 'FALHA', msg]),
    fim: () => {
      console.log(`\n== ${nome} ==`);
      itens.forEach(([s, m]) => console.log(`${s}  ${m}`));
      const falhas = itens.filter(([s]) => s === 'FALHA').length;
      console.log(`-- ${itens.length} checagens, ${falhas} falha(s)`);
      process.exitCode = falhas ? 1 : 0;
    }
  };
}

module.exports = { ROOT, SHOTS, servidor, navegador, VIEWPORTS, relatorio };
