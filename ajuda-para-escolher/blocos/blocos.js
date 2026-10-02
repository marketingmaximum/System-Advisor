/* Blocos do Portal → /ajuda-para-escolher (card d41b15bf)
   Referência para portar ao Next.js do Portal. Regras do card:
   - todo botão leva a /ajuda-para-escolher?utm_source=portal&utm_content=<bloco>
   - rodapé de todo bloco: "System Advisor, consultoria parceira independente"
   - uma interrupção por visita: se a faixa aparecer, o pop-up não aparece
   - pop-up em 50% da rolagem, 1 vez; fechou = 30 dias sem ver; enviou o formulário = nunca mais
   - fora destes pontos, nada muda no site
   Textos marcados [WD] completam frases que o card traz truncadas: trocar pelos do documento N3cTLP7. */
(function () {
  'use strict';

  var DESTINO = '/ajuda-para-escolher';
  var RODAPE = 'System Advisor, consultoria parceira independente';
  var DIA = 24 * 60 * 60 * 1000;
  var K = {
    enviado: 'ps_sa_form_enviado',          // gravado pela página /ajuda-para-escolher após o envio
    popupFechado: 'ps_sa_popup_fechado_em', // localStorage, timestamp
    faixaFechada: 'ps_sa_faixa_fechada_em', // localStorage, timestamp
    interrupcao: 'ps_sa_interrupcao'        // sessionStorage: 'faixa' ou 'popup' já mostrado nesta visita
  };

  function ler(s, k) { try { return window[s].getItem(k); } catch (e) { return null; } }
  function gravar(s, k, v) { try { window[s].setItem(k, v); } catch (e) {} }
  function recente(k, dias) { var t = +ler('localStorage', k); return t && Date.now() - t < dias * DIA; }
  function jaEnviou() { return ler('localStorage', K.enviado) === '1'; }
  function track(evento, bloco) { (window.dataLayer = window.dataLayer || []).push({ event: evento, bloco: bloco }); }

  function link(bloco) { return DESTINO + '?utm_source=portal&utm_content=' + encodeURIComponent(bloco); }

  var TEXTOS = {
    alternativas: { texto: '<strong>Antes de trocar, vale saber se o problema é o sistema ou o processo.</strong>', botao: 'Quero conversar' },
    erp: { texto: '<strong>São {n} sistemas aqui.</strong> Se a lista ficou longa demais, um especialista independente ajuda a chegar aos finalistas.', botao: 'Quero ajuda para escolher' }, // [WD] 2ª frase
    comparador: { texto: '<strong>Comparou e continua na dúvida?</strong> Um especialista independente ajuda a decidir com critério escrito.', botao: 'Falar com um especialista' }, // [WD] 2ª frase
    blog: { texto: '<strong>Vai escolher ou trocar de ERP?</strong> Veja o passo a passo de uma escolha bem feita e, se precisar, converse com um especialista.', botao: 'Quero ajuda para escolher' } // [WD]
  };

  function montarBloco(tipo, n) {
    var t = TEXTOS[tipo];
    var el = document.createElement('aside');
    el.className = 'sa-bloco';
    el.setAttribute('aria-label', 'Ajuda para escolher um sistema de gestão');
    el.setAttribute('data-sa-bloco', tipo);
    el.innerHTML =
      '<div class="sa-bloco-corpo"><p class="sa-bloco-texto">' + t.texto.replace('{n}', n || '') + '</p>' +
      '<a class="sa-bloco-btn" href="' + link(tipo) + '">' + t.botao + '</a></div>' +
      '<span class="sa-rodape">' + RODAPE + '</span>';
    el.querySelector('a').addEventListener('click', function () { track('sa_bloco_click', tipo); });
    return el;
  }

  /* Blocos fixos: o Next.js renderiza um marcador <div data-sa-slot="alternativas|erp|comparador"> no lugar certo:
     alternativas → acima da lista · erp → logo abaixo do título (data-sa-total="1343", número dinâmico) · comparador → depois da tabela */
  function blocosFixos() {
    var slots = document.querySelectorAll('[data-sa-slot]');
    Array.prototype.forEach.call(slots, function (slot) {
      var tipo = slot.getAttribute('data-sa-slot');
      if (!TEXTOS[tipo] || tipo === 'blog') return;
      var total = slot.getAttribute('data-sa-total');
      var n = total ? Number(total).toLocaleString('pt-BR') : '';
      if (tipo === 'erp' && !n) return; // sem número, não mostra (nada inventado)
      slot.replaceWith(montarBloco(tipo, n));
    });
  }

  /* Blog: depois do 2º subtítulo (h2), só em artigos de gestão/ERP (o artigo marca data-sa-tema="gestao") */
  function blocoBlog() {
    var artigo = document.querySelector('article[data-sa-tema="gestao"]');
    if (!artigo) return;
    var h2 = artigo.querySelectorAll('h2');
    if (h2.length < 2) return;
    // o bloco entra antes do 3º h2, ou seja, ao fim da seção aberta pelo 2º subtítulo
    var alvo = h2[2] || null;
    var bloco = montarBloco('blog');
    if (alvo) alvo.parentNode.insertBefore(bloco, alvo); else artigo.appendChild(bloco);
  }

  function svgFechar() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  }

  /* Faixa no topo. Decide primeiro: se ela aparece, o pop-up não aparece nesta visita. */
  function faixa() {
    if (jaEnviou() || recente(K.faixaFechada, 30)) return false;
    var vez = ler('sessionStorage', K.interrupcao);
    if (vez && vez !== 'faixa') return false;
    var el = document.createElement('div');
    el.className = 'sa-faixa';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Aviso');
    el.innerHTML = '<span>Escolher sistema de gestão é difícil.<span class="sa-extra"> Veja o guia do Portal e, se precisar, fale com um especialista.</span></span>' + // [WD] 2ª frase
      '<a href="' + link('faixa') + '">Saber mais</a><span class="sa-rodape-inline">' + RODAPE + '</span>' +
      '<button class="sa-fechar" type="button" aria-label="Fechar aviso">' + svgFechar() + '</button>';
    el.querySelector('a').addEventListener('click', function () { track('sa_bloco_click', 'faixa'); });
    el.querySelector('button').addEventListener('click', function () {
      gravar('localStorage', K.faixaFechada, String(Date.now()));
      el.remove();
      track('sa_faixa_fechada', 'faixa');
    });
    document.body.insertBefore(el, document.body.firstChild);
    gravar('sessionStorage', K.interrupcao, 'faixa');
    track('sa_bloco_view', 'faixa');
    return true;
  }

  function popup() {
    if (jaEnviou() || recente(K.popupFechado, 30)) return;
    if (ler('sessionStorage', K.interrupcao)) return; // faixa ou pop-up já interrompeu esta visita
    if (typeof HTMLDialogElement !== 'function') return;

    function aoRolar() {
      var doc = document.documentElement;
      var rolavel = doc.scrollHeight - window.innerHeight;
      if (rolavel <= 0 || window.scrollY / rolavel < 0.5) return;
      window.removeEventListener('scroll', aoRolar);
      if (ler('sessionStorage', K.interrupcao)) return;
      var d = document.createElement('dialog');
      d.className = 'sa-popup';
      d.setAttribute('aria-labelledby', 'sa-popup-titulo');
      d.innerHTML = '<div class="sa-popup-corpo">' +
        '<h2 id="sa-popup-titulo">Precisa de ajuda para escolher um sistema de gestão?</h2>' +
        '<p>Um guia curto para escolher sem se arrepender e, se a empresa tiver o porte, uma conversa com uma consultoria independente.</p>' + // [WD]
        '<a class="sa-bloco-btn" href="' + link('popup') + '">Quero ajuda para escolher</a>' +
        '<button class="sa-fechar" type="button" aria-label="Fechar">' + svgFechar() + '</button></div>' +
        '<span class="sa-rodape">' + RODAPE + '</span>';
      document.body.appendChild(d);
      function fechar() { gravar('localStorage', K.popupFechado, String(Date.now())); track('sa_popup_fechado', 'popup'); }
      d.querySelector('button').addEventListener('click', function () { d.close(); });
      d.addEventListener('close', fechar);
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); // clique fora
      d.querySelector('a').addEventListener('click', function () { track('sa_bloco_click', 'popup'); });
      d.showModal();
      gravar('sessionStorage', K.interrupcao, 'popup');
      track('sa_bloco_view', 'popup');
    }
    window.addEventListener('scroll', aoRolar, { passive: true });
  }

  function iniciar() {
    if (location.pathname.indexOf(DESTINO) === 0) return; // nunca na própria página de destino
    blocosFixos();
    blocoBlog();
    if (!faixa()) popup();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.SABlocos = { chaves: K, link: link };
})();
