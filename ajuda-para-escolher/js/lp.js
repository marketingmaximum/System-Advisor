/* Formulário de filtro · /ajuda-para-escolher
   Qualificado (faturamento >= mínimo) → obrigado-especialista.html (conversão do Google Ads lá).
   Não qualificado → obrigado-guia.html. Ver RASTREAMENTO.md. */
(function () {
  'use strict';

  var CONFIG = {
    // TODO: endpoint do Portal que recebe o lead. Vazio = modo de teste (não envia nada).
    // O servidor precisa refazer a conta do filtro e só repassar à System Advisor o lead qualificado
    // (card 81895f55: o não qualificado "nunca chega ao Alexandre"). Card 28ee3e84 tem o plano B (e-mail + planilha).
    ENDPOINT: '',
    // Faturamento mínimo em R$ milhões/ano. Alexandre falou em 50 a 60 (reunião de 11/09). TODO: confirmar.
    // Se virar 60, trocar aqui e ajustar as faixas do <select id="faturamento"> no index.html.
    MIN_FATURAMENTO_MI: 50,
    PAGINA_QUALIFICADO: 'obrigado-especialista.html',
    PAGINA_GUIA: 'obrigado-guia.html',
    TIMEOUT_MS: 12000
  };

  // Piso de cada faixa do select, em R$ milhões/ano
  var PISO_FAIXA = { ate_20: 0, '20_50': 20, '50_100': 50, '100_500': 100, acima_500: 500 };

  var R = window.PSRastreamento;
  var form = document.getElementById('form-lead');
  if (!form || !R) return;

  var botao = document.getElementById('form-submit');
  var status = document.getElementById('form-status');
  var TEXTO_BOTAO = botao.textContent;

  /* Campos ocultos com a origem da visita */
  R.CHAVES.forEach(function (k) {
    var campo = form.elements[k];
    if (campo) campo.value = R.atribuicao[k] || '';
  });

  /* form_start: primeira interação com o formulário */
  var iniciou = false;
  form.addEventListener('focusin', function () {
    if (iniciou) return;
    iniciou = true;
    R.track('form_start', { utm_content: R.atribuicao.utm_content || '' });
  });

  /* Máscara de telefone BR: (11) 91234-5678 */
  var tel = form.elements.telefone;
  tel.addEventListener('input', function () {
    var d = tel.value.replace(/\D/g, '').slice(0, 11);
    var f = d;
    if (d.length > 2) f = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 6) f = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length === 11 ? 7 : 6) + '-' + d.slice(d.length === 11 ? 7 : 6);
    tel.value = f;
  });

  /* Validação */
  var REGRAS = {
    faturamento: function (v) { return v in PISO_FAIXA; },
    funcionarios: function (v) { return v !== ''; },
    sistema_atual: function (v) { return v.trim().length >= 2; },
    prazo: function (v) { return v !== ''; },
    nome: function (v) { return v.trim().length >= 2; },
    empresa: function (v) { return v.trim().length >= 2; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    telefone: function (v) { var n = v.replace(/\D/g, '').length; return n === 10 || n === 11; }
  };

  function validarCampo(nome) {
    var campo = form.elements[nome];
    var ok = REGRAS[nome](campo.value);
    var caixa = campo.closest('.field');
    caixa.classList.toggle('invalid', !ok);
    campo.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  }

  Object.keys(REGRAS).forEach(function (nome) {
    var campo = form.elements[nome];
    // Depois do primeiro erro, o campo revalida enquanto a pessoa corrige
    campo.addEventListener(campo.tagName === 'SELECT' ? 'change' : 'input', function () {
      if (campo.closest('.field').classList.contains('invalid')) validarCampo(nome);
    });
    campo.addEventListener('blur', function () { if (campo.value) validarCampo(nome); });
  });

  function textoOpcao(nome) {
    var s = form.elements[nome];
    return s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : '';
  }

  function enviar(payload) {
    if (!CONFIG.ENDPOINT) {
      // Modo de teste: nada sai da página. Remover quando o endpoint existir.
      window.__psLeadPreview = payload;
      if (window.console) console.warn('[ajuda-para-escolher] ENDPOINT vazio: lead não enviado (modo de teste).');
      return Promise.resolve();
    }
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, CONFIG.TIMEOUT_MS) : null;
    return fetch(CONFIG.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';

    if (form.elements.website.value) return; // robô

    var invalidos = Object.keys(REGRAS).filter(function (n) { return !validarCampo(n); });
    if (invalidos.length) {
      status.textContent = invalidos.length === 1 ? 'Falta corrigir 1 campo.' : 'Faltam corrigir ' + invalidos.length + ' campos.';
      form.elements[invalidos[0]].focus();
      return;
    }

    var faixa = form.elements.faturamento.value;
    var qualificado = PISO_FAIXA[faixa] >= CONFIG.MIN_FATURAMENTO_MI;
    var eventId = R.novoEventId();
    var a = R.atribuicao;

    var payload = {
      event_id: eventId,
      data: new Date().toISOString(),
      origem: 'Portal Software',
      pagina: window.location.origin + window.location.pathname,
      qualificado: qualificado,
      faturamento: faixa,
      faturamento_texto: textoOpcao('faturamento'),
      funcionarios: form.elements.funcionarios.value,
      funcionarios_texto: textoOpcao('funcionarios'),
      sistema_atual: form.elements.sistema_atual.value.trim(),
      prazo: form.elements.prazo.value,
      prazo_texto: textoOpcao('prazo'),
      nome: form.elements.nome.value.trim(),
      empresa: form.elements.empresa.value.trim(),
      email: form.elements.email.value.trim().toLowerCase(),
      telefone: form.elements.telefone.value.replace(/\D/g, ''),
      bloco_origem: a.utm_content || ''
    };
    R.CHAVES.forEach(function (k) { payload[k] = form.elements[k].value; });

    botao.disabled = true;
    botao.textContent = 'Enviando…';

    enviar(payload).then(function () {
      R.track('form_submit', {
        qualificado: qualificado,
        faixa_faturamento: faixa,
        faixa_funcionarios: payload.funcionarios,
        prazo: payload.prazo,
        utm_source: a.utm_source || '',
        utm_content: a.utm_content || ''
      });
      R.gravar('sessionStorage', R.CHAVE_LEAD, JSON.stringify({
        event_id: eventId,
        qualificado: qualificado,
        faixa_faturamento: faixa,
        utm_source: a.utm_source || '',
        utm_content: a.utm_content || ''
      }));
      // Usado pelo pop-up dos blocos do site: quem já enviou nunca mais vê
      R.gravar('localStorage', 'ps_sa_form_enviado', '1');
      window.location.assign(qualificado ? CONFIG.PAGINA_QUALIFICADO : CONFIG.PAGINA_GUIA);
    }).catch(function () {
      botao.disabled = false;
      botao.textContent = TEXTO_BOTAO;
      status.textContent = 'Não conseguimos enviar agora. Confira a conexão e tente de novo em instantes.';
      R.track('form_error', { utm_content: a.utm_content || '' });
    });
  });
})();
