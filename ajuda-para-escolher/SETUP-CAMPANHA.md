# Setup de campanha · /ajuda-para-escolher

Fonte: card 106be851 ([Demandas] Tráfego Pago) e card d41b15bf (blocos do site).

## Google Ads (rede de pesquisa)

- **Destino:** `https://portalsoftware.com.br/ajuda-para-escolher` (nunca o site da System Advisor).
- **Auto-tagging ligado** (gclid). Modelo de URL final sugerido:
  `{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={_campanha}&utm_term={keyword}&utm_content={creative}`
  (`{_campanha}` é parâmetro personalizado; ajustar ao padrão do Gabriel.)
- **Conversão principal:** "Lead qualificado System Advisor", origem site, via GTM no evento `lead_qualificado` (ver RASTREAMENTO.md). Contagem: uma. ID da transação = `event_id`.
- **Não importar como conversão:** `lead_nao_qualificado`, `form_submit`, `cta_click`.
- **Verba:** R$ 300 a 600/mês (R$ 10 a 20/dia), no cartão do Alexandre. **A confirmar com ele.**
- **Palavras-chave do card (a validar com volume):** trocar sistema de gestão · como escolher ERP · consultoria para escolha de ERP · seleção de software de gestão · qual ERP escolher para minha empresa · ERP não atende · implantação de ERP deu errado.
- **Negativas do card:** grátis · download · curso · emprego · vaga · login · suporte de marca específica.
- **Anúncio de referência (card):** "Vai trocar de sistema de gestão? Entenda antes de decidir" · "Guia gratuito para escolher sem se arrepender. Compare mais de 14 mil sistemas e fale com um especialista independente."
- **Coerência anúncio × página:** o H1 ("Precisa de ajuda para escolher um sistema de gestão?") e o subtítulo usam "sistema de gestão", "ERP" e "sem se arrepender". A página cita "mais de 14 mil sistemas" e "consultoria parceira independente".

## Blocos do Portal (tráfego interno)

Todos os botões: `/ajuda-para-escolher?utm_source=portal&utm_content=<bloco>`

| Bloco | utm_content | Onde |
|---|---|---|
| Páginas "alternativas a" | `alternativas` | acima da lista |
| Categoria ERP | `erp` | logo abaixo do título, com o número dinâmico |
| Comparador | `comparador` | logo depois da tabela |
| Pop-up | `popup` | ao rolar 50%; 1 vez; fechou = 30 dias; enviou = nunca mais |
| Faixa no topo | `faixa` | fixa e fechável; se aparece, o pop-up não aparece na visita |
| Blog (gestão/ERP) | `blog` | depois do 2º subtítulo |

`utm_medium` e `utm_campaign` não estão no card. Sugestão: `utm_medium=bloco_site&utm_campaign=system_advisor`, para o GA4 não jogar o tráfego em "(not set)". **Ok do Gabriel pendente.**
