/* Rastreamento · /ajuda-para-escolher
   A página só empurra eventos para o dataLayer. Nenhuma tag de fornecedor (GTM, GA4, Ads, Pixel)
   fica no HTML: o container do GTM do Portal lê estes eventos. Ver RASTREAMENTO.md.
   Nunca envia nome, e-mail, telefone ou empresa para o dataLayer. */
(function () {
  'use strict';

  var CHAVES = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid', 'fbclid'];
  var CHAVE_ATRIBUICAO = 'ps_sa_atribuicao';   // sessionStorage: origem da visita
  var CHAVE_LEAD = 'ps_sa_lead';               // sessionStorage: resumo do envio (sem dado pessoal)
  var PREFIXO_TRAVA = 'ps_sa_conv_';           // localStorage: conversão já disparada para este event_id
  var PII = /^(nome|name|first_name|last_name|email|e_mail|telefone|phone|tel|empresa|company|sistema_atual)$/i;

  window.dataLayer = window.dataLayer || [];

  function ler(storage, chave) { try { return window[storage].getItem(chave); } catch (e) { return null; } }
  function gravar(storage, chave, valor) { try { window[storage].setItem(chave, valor); } catch (e) { /* modo privado */ } }
  function lerJSON(storage, chave) { try { return JSON.parse(ler(storage, chave) || 'null'); } catch (e) { return null; } }

  /* Captura na entrada. Se a URL traz qualquer parâmetro de campanha, ele substitui o conjunto
     guardado (último clique de campanha da sessão). Sem parâmetro, vale o que já estava na sessão. */
  function capturarAtribuicao() {
    var params = new URLSearchParams(window.location.search);
    var novo = {};
    var temParametro = false;
    CHAVES.forEach(function (k) {
      var v = params.get(k);
      if (v) { novo[k] = v.slice(0, 200); temParametro = true; }
    });
    if (temParametro) {
      novo.landing_page = window.location.pathname;
      gravar('sessionStorage', CHAVE_ATRIBUICAO, JSON.stringify(novo));
      return novo;
    }
    return lerJSON('sessionStorage', CHAVE_ATRIBUICAO) || {};
  }

  function semPII(params) {
    var limpo = {};
    Object.keys(params || {}).forEach(function (k) {
      if (!PII.test(k)) limpo[k] = params[k];
    });
    return limpo;
  }

  function track(evento, params) {
    var dados = semPII(params);
    dados.event = evento;
    window.dataLayer.push(dados);
  }

  function novoEventId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'ev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  var atribuicao = capturarAtribuicao();

  /* Cliques nos botões "Quero ajuda para escolher" */
  document.addEventListener('click', function (e) {
    var alvo = e.target.closest ? e.target.closest('[data-cta]') : null;
    if (alvo) track('cta_click', { cta_position: alvo.getAttribute('data-cta'), utm_content: atribuicao.utm_content || '' });
    var guia = e.target.closest ? e.target.closest('[data-track="guia_download"]') : null;
    if (guia) track('guia_download', { utm_content: atribuicao.utm_content || '' });
  });

  /* Páginas de obrigado: a conversão dispara uma vez só, travada por event_id */
  function processarObrigado(tipo) {
    var lead = lerJSON('sessionStorage', CHAVE_LEAD);
    if (!lead || !lead.event_id) return; // acesso direto à página: nenhum evento

    var qualificado = lead.qualificado === true;
    // Guarda: cada tipo de lead só dispara na página certa
    if (tipo === 'qualificado' && !qualificado) { window.location.replace('obrigado-guia.html'); return; }
    if (tipo === 'guia' && qualificado) { window.location.replace('obrigado-especialista.html'); return; }

    var trava = PREFIXO_TRAVA + lead.event_id;
    if (ler('localStorage', trava)) return; // recarga ou volta: não dispara de novo

    track(qualificado ? 'lead_qualificado' : 'lead_nao_qualificado', {
      event_id: lead.event_id,
      faixa_faturamento: lead.faixa_faturamento || '',
      utm_source: lead.utm_source || '',
      utm_content: lead.utm_content || ''
    });
    gravar('localStorage', trava, String(Date.now()));
  }

  var pagina = document.body ? document.body.getAttribute('data-pagina') : '';
  if (pagina === 'obrigado-qualificado') processarObrigado('qualificado');
  if (pagina === 'obrigado-guia') processarObrigado('guia');

  window.PSRastreamento = {
    CHAVES: CHAVES,
    CHAVE_LEAD: CHAVE_LEAD,
    atribuicao: atribuicao,
    track: track,
    novoEventId: novoEventId,
    gravar: gravar
  };
})();
