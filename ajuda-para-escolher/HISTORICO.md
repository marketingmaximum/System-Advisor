# Histórico · /ajuda-para-escolher (Portal Software × System Advisor)

## 02/10/2026 · F1 · Plano da página
- Lidos os cards 81895f55, d41b15bf, 7e7712ad, 28ee3e84, 338deb1d e 106be851, o DESIGN.md e o PRODUCT.md do Portal, portalsoftware.com.br e systemadvisor.com.br.
- Sem acesso ao documento claude.ai/artifact/N3cTLP7mnmyQjv9gMrff3h.
- Não há planejamentos (tráfego, público, quarter, SWOT), onboarding nem transcrição de 11/09 no Drive ou no Dados para este projeto.
- Decisão: H1 do card, identidade do DESIGN.md do Portal (Archivo, fichas, sem foto), filtro só por faturamento com o mínimo numa constante (R$ 50 mi até a confirmação).
- Plano em PLANO-F1.md. Aguardando aprovação do Pedro antes de qualquer HTML.

## 02/10/2026 · F2 · Direções visuais
- F1 aprovado pelo Pedro ("pode seguir, vai para revisão depois").
- Archivo hospedada localmente (assets/fonts, subconjunto latin, OFL): fonte do DESIGN.md, sem licença paga.
- Logo: logo-horizontal.webp baixado de portalsoftware.com.br (falta gerar versão no tamanho de uso na F3).
- Direção A "Ficha do guia" e Direção B "Régua do roteiro" em direcoes/, screenshots em assets/screens/f2/. Aguardando escolha.

## 02/10/2026 · F2 → escolha
- Pedro: direção A (ficha do guia) + linha da System Advisor no hero + dobra "Quem atende" completa antes do formulário.

## 02/10/2026 · F3 · Construção
- index.html (6 dobras), obrigado-especialista.html (qualificado) e obrigado-guia.html (não qualificado), css/lp.css, js/lp.js.
- Filtro: só faturamento, mínimo em `CONFIG.MIN_FATURAMENTO_MI = 50` (js/lp.js). Funcionários e prazo não filtram.
- Material do não qualificado: usei o guia que já existe no Portal, "Guia: Como escolher um ERP em 2026" (/materiais/guia-escolher-erp-2026, 18 págs). O card 338deb1d fala de um material novo, "Como escolher um ERP sem se arrepender": se ele sair, trocar o link e o texto. **Confirmar com o João.**
- Archivo hospedada localmente; logo redimensionado para 220 px (9,8 KB). Peso da página ~117 KB transferidos (90 KB são a fonte, que o Portal já carrega).
- Trechos com fonte pendente marcados com `data-pendente` no HTML: `textos-marketing` (dobras 2 e 3, etapas 4 e 6), `autorizacao-nome` (dobra 5), `confirmar-alexandre` ("Não" vende software, "Mais de 25 anos"), `autorizacao-cases` (SLC Agrícola e CIEE, bloco com `hidden`), `confirmar-material` (guia do obrigado).
- Blocos do site (card d41b15bf) em blocos/: blocos.js + blocos.css + demo.html, como referência para o Next.js do Portal. Decisões minhas: faixa fechada também some por 30 dias (o card não diz); quem enviou o formulário não vê faixa nem pop-up; bloco do blog entra no fim da seção do 2º subtítulo (antes do 3º h2), não colado no título; bloco ERP não aparece se o número não vier.
- Textos completos dos blocos 2, 3, 4, 5 e 6 estão truncados no card: completei com rascunho marcado [WD] no blocos.js.

## 02/10/2026 · F4 · Rastreamento
- js/rastreamento.js: captura UTMs/gclid/gbraid/wbraid/fbclid na sessão, eventos sem dado pessoal, conversão `lead_qualificado` única por event_id no obrigado. Detalhes e GTM em RASTREAMENTO.md. IDs de GTM, GA4, Ads e o ENDPOINT ficam TODO.

## 02/10/2026 · F5 · QA
- qa-lp.js 44/44 · qa-secoes.js 24/24 · qa-fluxo.js 27/27 · qa-blocos.js 15/15 (Chromium do Playwright).
- LCP mobile 800 ms em 4G lenta + CPU 4x (servidor local). Sem rolagem horizontal em 360, 390 e 1440. Contraste AA em todos os textos medidos.
- Corrigido no QA: legenda oculta do formulário vazava 690 px à direita; títulos "Ajustar/Trocar" se separavam do texto no celular; faixa dos blocos alta demais no celular.

### Conferência das regras do card 81895f55
| Regra | Situação |
|---|---|
| Não é página de venda, nada de oferta ou preço | OK (qa-lp: nenhum preço/oferta; "sem oferta e sem preço" dito explicitamente) |
| System Advisor sempre "consultoria parceira independente", com o nome, nunca equipe do portal | OK (6 ocorrências; qa-lp procura "equipe do portal/nossa equipe/nossos consultores": 0) |
| Qualificado → obrigado "um especialista vai falar com você" + CRM | Página OK. CRM depende do ENDPOINT/webhook (TODO) |
| Não qualificado → material gratuito, nunca chega ao Alexandre | Página OK. Garantia final é do servidor (RASTREAMENTO.md, "O que o servidor precisa fazer") |
| Campos ocultos utm_source, utm_medium, utm_campaign, utm_content, gclid | OK (+ utm_term, gbraid, wbraid, fbclid) |
| Conversão do Google Ads só no envio qualificado | OK no dataLayer (qa-fluxo). Tag do Ads no GTM: TODO |
| Página indexável, leve e mobile first | Leve e mobile first OK. `noindex` só durante a aprovação: trocar para `index, follow` na publicação |
| Estrutura 1 a 6 do card | OK, na ordem |
| Cases SLC e CIEE só depois da autorização | OK (bloco com `hidden`) |

### Conferência das regras do card d41b15bf
| Regra | Situação |
|---|---|
| Uma interrupção por visita (faixa exclui o pop-up) | OK (qa-blocos) |
| Rodapé "System Advisor, consultoria parceira independente" em todo bloco | OK |
| Fora desses pontos nada muda | OK (o script só age nos marcadores `data-sa-slot`, no artigo marcado e na faixa/pop-up; nunca roda na /ajuda-para-escolher) |
| Botões com utm_source=portal e utm_content por bloco | OK |
| Pop-up em 50%, 1 vez, fechou = 30 dias, enviou = nunca | OK |
