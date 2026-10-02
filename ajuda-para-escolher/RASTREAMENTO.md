# Rastreamento · /ajuda-para-escolher

A página **não carrega nenhuma tag de fornecedor**. Ela só empurra eventos para `window.dataLayer`, e o container do GTM do Portal lê esses eventos. Nome, e-mail, telefone, empresa e sistema atual **nunca** vão para o dataLayer (o `track()` de `js/rastreamento.js` filtra essas chaves, e o `scripts/qa-fluxo.js` confere).

## IDs (nenhum está em fonte nenhuma, ficam vazios)

| Item | Valor | Onde conseguir |
|---|---|---|
| Container GTM do Portal | **TODO** | Gabriel / conta do Portal |
| GA4 (ID de medição) | **TODO** | Gabriel |
| Google Ads: ID da conta (AW-…) e rótulo da conversão "Lead qualificado" | **TODO** | Conta do Google Ads com o cartão do Alexandre (card 106be851) |
| ENDPOINT do lead (`CONFIG.ENDPOINT` em `js/lp.js`) | **TODO** | Back-end do Portal. Zoho sem webhook ainda (card 7e7712ad) |
| Meta Pixel | não se aplica | Campanha é só Google, rede de pesquisa (card 106be851) |

## Origem da visita

Na entrada, `js/rastreamento.js` lê da URL e guarda em `sessionStorage['ps_sa_atribuicao']`:
`utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, gbraid, wbraid, fbclid` + `landing_page`.
Se a URL trouxer qualquer parâmetro de campanha, ele substitui o conjunto guardado (último clique da sessão). Os valores vão para os campos ocultos do formulário e seguem com o lead.

## Eventos

| Evento | Quando dispara | Parâmetros | Uso no GTM |
|---|---|---|---|
| `cta_click` | clique em "Quero ajuda para escolher" (hero, índice, passo a passo) | `cta_position`, `utm_content` | GA4 evento |
| `form_start` | primeiro foco no formulário | `utm_content` | GA4 evento |
| `form_submit` | envio válido aceito pelo endpoint | `qualificado`, `faixa_faturamento`, `faixa_funcionarios`, `prazo`, `utm_source`, `utm_content` | GA4 evento (não é a conversão) |
| `form_error` | endpoint falhou | `utm_content` | GA4 evento (alerta) |
| **`lead_qualificado`** | load do `obrigado-especialista.html`, **1 vez por `event_id`** | `event_id`, `faixa_faturamento`, `utm_source`, `utm_content` | **Conversão do Google Ads** + GA4 `generate_lead` (key event) |
| `lead_nao_qualificado` | load do `obrigado-guia.html`, 1 vez por `event_id` | `event_id`, `faixa_faturamento`, `utm_source`, `utm_content` | GA4 evento. **Nunca** conversão de Ads |
| `guia_download` | clique em "Baixar o guia" no obrigado-guia | `utm_content` | GA4 evento |
| `sa_bloco_view` / `sa_bloco_click` / `sa_popup_fechado` / `sa_faixa_fechada` | blocos do site (`blocos/blocos.js`) | `bloco` | GA4 evento |

Os nomes são proposta da Web Design: não havia plano de tráfego com nomes definidos. **Ok do Gabriel pendente.**

## Trava da conversão

1. O envio grava em `sessionStorage['ps_sa_lead']` só o resumo: `event_id`, `qualificado`, `faixa_faturamento`, `utm_source`, `utm_content`.
2. A página de obrigado lê esse resumo. Sem resumo (acesso direto), não dispara nada.
3. Antes de disparar, procura `localStorage['ps_sa_conv_<event_id>']`. Se existe, não dispara (recarga, voltar/avançar).
4. Guarda: lead não qualificado que abre o obrigado-especialista é mandado para o obrigado-guia, e vice-versa.
5. No GTM, usar `event_id` como **ID da transação** da tag de conversão do Ads (o Ads deduplica do lado dele também).

## Configuração do GTM (fazer quando houver os IDs)

- **Variáveis da camada de dados:** `event_id`, `qualificado`, `faixa_faturamento`, `utm_source`, `utm_content`, `cta_position`, `bloco`.
- **Acionadores (evento personalizado):** `lead_qualificado`, `lead_nao_qualificado`, `form_submit`, `form_start`, `cta_click`, `guia_download`, `sa_bloco_click`.
- **Tags:**
  - Google Ads · Conversão "Lead qualificado System Advisor" → acionador `lead_qualificado`, ID da transação = `{{DLV event_id}}`.
  - GA4 · evento `generate_lead` → acionador `lead_qualificado` (marcar como key event).
  - GA4 · eventos dos demais acionadores, com os parâmetros da tabela.
  - Vinculador de conversões do Google Ads em todas as páginas (para o gclid em cookie), respeitando o Consent Mode do Portal.
- **Conversões otimizadas (enhanced conversions):** não ligar pelo dataLayer (regra: nada de e-mail cru). Se forem desejadas, fazer pelo servidor com e-mail em hash SHA-256.

## O que o servidor (ENDPOINT) precisa fazer

O navegador decide só para qual obrigado a pessoa vai. **Quem decide para onde o dado vai é o servidor:**
1. Recebe o JSON (campos em `js/lp.js`: dados do formulário, `origem = "Portal Software"`, `bloco_origem = utm_content`, `data`, `event_id`, UTMs, gclid, gbraid, wbraid, fbclid).
2. **Refaz o filtro** (faixa de faturamento ≥ mínimo) sem confiar no campo `qualificado` do navegador.
3. Qualificado → CRM da System Advisor (Zoho, webhook a configurar; enquanto não existir, e-mail ao Alexandre + planilha, card 28ee3e84).
4. Não qualificado → fica só na base do Portal. **Nunca chega ao Alexandre.**
5. Registra cada envio (data, conteúdo, confirmação de entrega) e alerta em caso de falha (card 28ee3e84).
6. Responde 2xx só depois de gravar. Se responder erro, a página mostra "Não conseguimos enviar agora…" e não redireciona.

## QA do funil

```
npm i -D playwright      # ou use o global
node scripts/qa-lp.js      # estrutura, SEO, contraste, sem vendor, LCP, screenshots
node scripts/qa-secoes.js  # ordem e largura das dobras, screenshot por seção
node scripts/qa-fluxo.js   # UTMs → validação → qualificado/não qualificado → conversão única
node scripts/qa-blocos.js  # blocos do site: UTMs, rodapé, pop-up 50%/30 dias, faixa
```
Se o Chromium do Playwright falhar, os scripts tentam o Edge (`channel: 'msedge'`).

**Teste com envio real (antes de publicar):** com GTM em modo de visualização e o endpoint ligado, enviar 1 lead qualificado (faixa ≥ R$ 50 mi) e 1 não qualificado. Conferir: conversão do Ads só no primeiro; o não qualificado não chegou ao CRM nem ao e-mail do Alexandre; recarregar o obrigado não gera segunda conversão.
