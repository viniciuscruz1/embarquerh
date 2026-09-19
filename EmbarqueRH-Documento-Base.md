# EmbarqueRH — Documento Base do Projeto

> Documento vivo de referência. Toda decisão nova sobre escopo, regras ou arquitetura deve ser refletida aqui antes de virar código. Última atualização: 2026-09-19.

## 1. Visão geral

O **EmbarqueRH** é um agente de IA para a EMAP com dois módulos:

1. **Integração/Onboarding** — chatbot conversacional para tirar dúvidas institucionais (cultura, benefícios, políticas, contatos). Sem fluxo formal de etapas nem coleta de documentos admissionais nesta fase — é conversa livre baseada em FAQ. **Fora do MVP — ver seção 10.**
2. **Prestação de contas de benefícios** — canal pelo qual o colaborador envia comprovantes (foto ou PDF), o agente extrai e valida os dados automaticamente contra as regras de cada benefício, e o RH controla tudo isso por trás através de relatórios e um painel administrativo. **Este é o único módulo do MVP.**

**Premissa central de UX:** o colaborador não deve perceber a complexidade de processamento por trás — para ele, é só "mandar a nota e pronto". Toda a lógica de extração, validação de regras, aceite/recusa e geração de relatório é invisível ao colaborador e controlada exclusivamente pelo RH.

**Objetivo do MVP:** demonstração executiva para a diretoria da EMAP, evidenciando de ponta a ponta o poder do agente — do envio do comprovante pelo WhatsApp até o relatório pronto para a folha de pagamento. Por isso o MVP é propositalmente enxuto em canais e módulos, priorizando profundidade e polimento no fluxo de prestação de contas em vez de amplitude de funcionalidades.

## 2. Módulo 1 — Integração/Onboarding (fase futura, fora do MVP)

- Formato: chatbot de perguntas e respostas (FAQ institucional).
- Sem checklist de etapas, sem coleta de documentos admissionais nesta fase (pode virar fase futura — ver seção 10).
- Base de conhecimento: documentos institucionais que o RH fornecer (políticas, manual do colaborador, etc.) — **pendência:** RH precisa consolidar/fornecer esse material.

## 3. Módulo 2 — Prestação de contas de benefícios (MVP)

### 3.1 Benefícios cobertos (fase 1) — regras reais, implementadas

As regras abaixo foram fornecidas diretamente pelo responsável do projeto (via chat, não em PDF formal) e já estão implementadas no motor de regras, lendo da tabela `regras` do banco de dados.

**Auxílio-creche**
- Elegibilidade: filho(a) do colaborador com **no máximo 7 anos de idade** na data da prestação de contas (a partir de 7 anos e 1 dia, reprovado). Requer que a data de nascimento do filho esteja cadastrada no perfil do colaborador (cadastro feito pelo RH).
- Teto de reembolso: **R$800/mês**. Se a nota for maior que o teto, aprova mas reembolsa apenas R$800 (o valor que vai para o relatório da folha é o teto, não o valor da nota). Se a nota for menor, reembolsa o valor da nota.
- Documentos exigidos: documento de cobrança (nota fiscal ou boleto) **e** comprovante de pagamento — os dois, obrigatoriamente.
- Deve ser possível identificar o nome ou CNPJ da escola em algum dos documentos.
- O código de validação do documento (chave de acesso da NF-e ou linha digitável do boleto) é extraído e fica disponível para o RH conferir manualmente — sem verificação automática contra sistemas externos no MVP.

**Auxílio ocular**
- Saldo anual: 80% de R$3.800 = **R$3.040/ano por colaborador**, renovado todo dia **1º de junho**.
- Reembolso: **80% do valor da nota**, respeitando o saldo restante do ciclo anual vigente. Se o valor calculado ultrapassar o saldo restante, **aprova parcialmente** (reembolsa só o que resta do saldo).
- Documentos exigidos: receita médica (oftalmológica) **+** documento de cobrança **+** comprovante de pagamento — os três, obrigatoriamente.

**Subsídio educacional**
- Reembolso: **70% do menor valor** entre o documento de cobrança (boleto) e o comprovante de pagamento.
- Documentos exigidos: documento de cobrança **e** comprovante de pagamento — os dois, obrigatoriamente.

**Regra comum aos 3 benefícios:** ao extrair o valor de qualquer documento, usar sempre o valor nominal/de face (ex: "Valor do Documento"), nunca incluindo multa ou juros por atraso.

**Observação sobre o fluxo:** como cada benefício agora exige mais de um documento, o colaborador pode enviar todos juntos ou um de cada vez — o agente acumula os documentos recebidos e só valida quando tiver todos os obrigatórios daquele benefício.

### 3.2 Fluxo de prestação de contas

1. Colaborador inicia a conversa pelo **WhatsApp** (único canal do MVP; Teams fica para fase futura — ver seção 10).
2. Agente identifica o colaborador (ver seção 5).
3. **Antes de pedir o documento, o agente pergunta a qual benefício aquela prestação de contas se refere** (ex: "Essa prestação de contas é referente a qual benefício? 1) Auxílio-creche 2) Auxílio ocular 3) Subsídio educacional") — o colaborador declara explicitamente, em vez do agente tentar adivinhar.
4. Colaborador envia a foto ou PDF do comprovante.
5. Agente processa o documento (extração estruturada via IA): tipo de documento, valor, data, CNPJ/prestador, beneficiário, e também sua própria estimativa de qual benefício o documento parece ser.
6. Agente valida automaticamente contra as regras do benefício **declarado no passo 3** — incluindo conferir se a estimativa da IA sobre o documento bate com o que o colaborador declarou (se não bater, é motivo de recusa automática, como uma checagem extra contra erro/uso indevido).
7. **Se dentro das regras:** o agente **confirma ao colaborador, no próprio chat, que a prestação de contas foi validada/aprovada**, e registra para o relatório do RH.
8. **Se fora das regras** (valor acima do limite, documento não bate com o benefício declarado, tipo de documento não aceito, colaborador não elegível): o agente **notifica o colaborador, no próprio chat, que a prestação de contas foi reprovada e justifica o motivo específico da reprovação**, sem intervenção humana nesse momento. Não há fila de revisão manual no MVP.
9. RH acompanha tudo pelo painel administrativo e gera relatórios quando precisar.

### 3.3 Geração de relatórios para a folha de pagamento

- Sistema de destino: **TOTVS RM** (confirmado).
- Periodicidade: **sob demanda + fechamento mensal obrigatório**.
- Layout: precisa ser **exatamente** o formato que a equipe de folha de pagamento já usa para importar no TOTVS RM — **pendência crítica:** levantar com a equipe de folha de pagamento o layout exato (colunas, formato de arquivo — CSV/XLSX/TXT posicional, codificação, regras de nomenclatura de colunas) antes de implementar o gerador de relatório.
- O painel administrativo do RH deve permitir gerar esse relatório sob demanda, filtrando por período, benefício e colaborador.

## 4. Painel administrativo do RH

- RH deve conseguir, sem depender de TI:
  - Ver todas as prestações de conta recebidas, aceitas e recusadas (com motivo).
  - **Acessar toda a documentação original enviada pelo colaborador** (cada foto/PDF de comprovante), filtrável por mês e ano da prestação de contas — implementado: os arquivos ficam no Supabase Storage, organizados por colaborador/ano-mês/benefício, com link de acesso temporário gerado sob demanda a partir da tela de detalhe de cada prestação.
  - Gerar relatórios no layout do TOTVS, sob demanda ou no fechamento mensal, também filtrável por mês/ano.
  - **Atualizar regras de benefícios** (limites de valor, documentos exigidos, elegibilidade) via interface simples, sem precisar editar código ou pedir a um desenvolvedor.
- Esse painel é de uso exclusivo do RH — colaboradores comuns não têm acesso a ele nem sabem que ele existe. Acesso protegido por senha única (login simples), definida em variável de ambiente.

## 5. Identificação e autenticação

- **Identidade corporativa:** SSO via Azure AD / Microsoft Entra ID (fonte de verdade da identidade do colaborador, mesmo no MVP só-WhatsApp).
- **WhatsApp (canal do MVP):** não há SSO nativo, então o vínculo é feito uma única vez por colaborador:
  1. Na primeira interação no WhatsApp, o agente envia um código/magic-link para o e-mail corporativo do colaborador (validado contra o Azure AD).
  2. Colaborador confirma o código/link.
  3. O número de WhatsApp fica vinculado permanentemente à identidade do colaborador no Entra ID.
- Esse vínculo deve ficar registrado (auditável) para o RH poder rastrear qual colaborador enviou qual comprovante.
- **Teams:** identificação nativa via conta corporativa (já autenticado pelo Entra ID) — só entra quando o canal Teams for implementado, em fase futura (ver seção 10).

## 6. Processamento de documentos

- Entradas aceitas: fotos (JPEG/PNG, tiradas direto da câmera) e PDFs.
- Pipeline: OCR/extração estruturada de documentos → classificação do tipo de comprovante → extração de campos (valor, data, CNPJ/prestador, descrição) → validação de regras de negócio.
- Recomendação técnica: usar um modelo multimodal (ex: Claude com visão) para leitura direta de imagens/PDFs de comprovantes, combinado com validação determinística das regras extraídas dos PDFs de política (não deixar a IA "decidir" limites de valor por conta própria — as regras estruturadas devem ser a fonte de verdade, a IA só extrai dados do comprovante).

## 7. Dados, armazenamento e segurança

- **Retenção de documentos:** indefinida (sem exclusão automática), conforme decisão do time.
  - ⚠️ **Risco de compliance a validar com jurídico:** a LGPD tem princípio de necessidade/finalidade — reter dados pessoais indefinidamente sem justificativa pode ser questionado em auditoria. Recomendo validar com jurídico/compliance um prazo mínimo defensável (geralmente 5 anos para documentos fiscais/trabalhistas), mesmo que a política operacional seja "não apagar por padrão".
- Dados envolvidos são sensíveis (financeiros e, em alguns casos, de saúde — ex.: auxílio ocular pode envolver receita médica). Isso classifica parte dos dados como **dados sensíveis pela LGPD**, exigindo:
  - Criptografia em repouso e em trânsito.
  - Controle de acesso estrito (só RH e sistemas autorizados veem os documentos brutos).
  - Log de auditoria de quem acessou o quê.
  - Base legal de tratamento clara (execução de política de benefícios/contrato de trabalho) e informação ao colaborador sobre o tratamento dos dados (mesmo que o processamento técnico seja invisível, o aviso de privacidade não pode ser omitido — é exigência legal, diferente de "esconder a complexidade técnica").
- Hospedagem: sem restrição declarada de on-premise/Brasil, mas dado o tipo de dado (trabalhista + potencialmente de saúde), recomendo hospedagem em região de nuvem no Brasil (ex.: AWS sa-east-1 ou Azure Brazil South) por prudência de compliance e latência.

## 8. Volume e escala

- ~101 a 500 colaboradores.
- Escala pequena/média — não exige arquitetura de alta concorrência, mas já justifica separar bem processamento assíncrono (fila para OCR/validação) de atendimento em tempo real no chat.

## 9. Arquitetura recomendada (proposta inicial, a validar)

Como não há restrição de stack, esta é uma proposta inicial:

- **Orquestração do agente:** Claude (Anthropic) via API, com tool use para: extração de documentos, consulta de regras estruturadas, registro de prestação de contas, consulta de status.
- **Canais:** 
  - WhatsApp via **Twilio (Sandbox do WhatsApp)** — confirmado após o Meta Cloud API bloquear a criação do app de desenvolvedor por conta nova (restrição comum do Meta for Developers, sem prazo definido para liberar). Twilio Sandbox não exige verificação de negócio nem conta Facebook antiga, e atende bem o cenário de poucos usuários de teste. **Único canal do MVP.** Migrar para a Cloud API oficial da Meta (ou manter Twilio em produção) fica como decisão de fase futura.
  - Microsoft Teams via Bot Framework / Teams Bot (usa Entra ID nativamente) — **fase futura.**
- **Backend:** serviço de aplicação (API) que orquestra o agente, valida regras de negócio de forma determinística (não delegado à IA) e gerencia estado das conversas.
- **Banco de dados:** banco relacional para dados estruturados (colaboradores, prestações de conta, regras de benefícios, vínculos de identidade) + armazenamento de objetos (blob storage) para os documentos originais (fotos/PDFs).
- **Motor de regras de benefícios:** tabela/estrutura de regras versionada, editável pelo painel do RH, não hardcoded — cada mudança de regra gera um novo "efetivo a partir de" para preservar auditabilidade histórica.
- **Painel administrativo do RH:** aplicação web separada, autenticada via Entra ID, com papéis de acesso (RH operacional vs RH admin de regras, por exemplo).
- **Geração de relatórios:** módulo de exportação configurável por template (para acomodar o layout exato do TOTVS assim que for levantado).
- **Infraestrutura:** cloud (região Brasil), com criptografia, backups e logs de auditoria desde o início.

### 9.1 Versão gratuita do MVP (custo zero, poucos usuários de teste)

Decisão: o MVP será construído **sem nenhum custo**, para uma demonstração com poucos usuários de teste para a diretoria. Isso implica versões simplificadas de algumas peças da arquitetura da seção 9:

| Camada | Escolha gratuita para o MVP | Limitação a ter em mente |
|---|---|---|
| WhatsApp | **Twilio Sandbox do WhatsApp** (gratuito, sem exigir cartão para o trial) | Destinatários precisam mandar um código de "join" para o número sandbox da Twilio antes de poder receber mensagens; mensagens saem com prefixo identificando conta de teste — suficiente para os testes com a diretoria, não serve para os colaboradores reais ainda |
| IA (Claude) | Conta de desenvolvedor usando o crédito inicial gratuito da Anthropic | Crédito é limitado e não é uma cota permanente; volume de teste (algumas dezenas de mensagens) cabe tranquilamente dentro dele |
| Backend | Free tier de Render, Railway ou Fly.io | Aplicações em free tier costumam "dormir" após inatividade, gerando alguns segundos de atraso na primeira mensagem depois de um tempo parado — aceitável numa demo, não em produção |
| Banco de dados | Free tier de Supabase ou Neon (Postgres) | Limite de armazenamento/linhas generoso o suficiente para poucos testes |
| Identificação do colaborador | Lista de teste cadastrada manualmente (nome + número de WhatsApp + e-mail), sem integração real com Entra ID nesta fase | Simplifica e acelera a demo; a integração real com Entra ID (seção 5) só é implementada quando o projeto avançar para produção |
| Relatório para o RH | Arquivo gerado já no layout do TOTVS RM, exportável pelo painel simples (sem envio automatizado direto ao TOTVS) | Suficiente para mostrar o resultado final na demonstração |

**Importante:** essa configuração vale só para a fase de demonstração com poucos usuários de teste. Antes de abrir para todos os colaboradores da EMAP, será preciso revisitar as seções 5 (identificação real via Entra ID), 7 (armazenamento e segurança) e 9 (arquitetura de produção), que têm exigências mais rígidas de conformidade e escala — e aí sim entram custos reais (ainda que baixos), como detalhado na conversa sobre estratégia de custos.

## 10. Fases do projeto

**MVP (fase 1) — foco único em prestação de contas, via WhatsApp, custo zero, para demo à diretoria:**
- Custo: **zero**, com poucos usuários de teste — ver detalhamento da stack gratuita na seção 9.1.
- Canal: **apenas WhatsApp** (sem Teams).
- Módulo: **apenas prestação de contas** dos 3 benefícios (creche, ocular, subsídio educacional). Sem módulo de onboarding/FAQ institucional.
- Fluxo completo de aceite/recusa automática, com confirmação ou justificativa de recusa no próprio chat (ver seção 3.2).
- Painel do RH com visualização das prestações de conta + geração de relatório sob demanda no layout do TOTVS RM.
- Identificação: lista de teste cadastrada manualmente (nome + WhatsApp + e-mail), sem integração real com Entra ID nesta fase — ver seção 9.1. A integração real com Entra ID (seção 5) fica para a versão de produção.

**Fases futuras (não bloqueiam o MVP, mas ficam mapeadas):**
- Canal Microsoft Teams (identificação nativa via Entra ID).
- Módulo de Integração/Onboarding: FAQ conversacional institucional.
- Checklist/trilha estruturada de integração (etapas, treinamentos, sistemas).
- Coleta e validação de documentos admissionais.
- Fila de revisão manual para casos "zona cinzenta" (hoje é tudo aceito/recusado automaticamente).
- Novos benefícios além dos 3 iniciais.
- Melhoria visual/UX do painel do RH (hoje funcional mas simples — aprovado como suficiente para o MVP; refinamento visual fica para depois da aprovação do projeto).

## 11. Pendências / decisões em aberto

| # | Pendência | Responsável | Bloqueia o quê |
|---|---|---|---|
| 1 | ~~Fornecer as regras dos 3 benefícios~~ — **resolvido**: regras reais recebidas via chat e implementadas (seção 3.1). Se existir PDF de política formal, vale conferir se bate com o que foi implementado. | RH | — |
| 2 | Levantar o layout exato de importação do TOTVS RM (colunas, formato de arquivo, codificação) — sistema já confirmado como TOTVS RM | Equipe de folha de pagamento | Módulo de geração de relatório |
| 3 | Validar com jurídico/compliance o prazo de retenção de documentos frente à LGPD | Jurídico/Compliance | Política de armazenamento definitiva |
| 4 | Decidir entre manter Twilio ou migrar para a Cloud API oficial da Meta (com verificação formal de negócio) quando o projeto avançar para produção | Técnico | Expansão do MVP para todos os colaboradores |
| 5 | Consolidar material de FAQ institucional para o módulo de onboarding | RH | Base de conhecimento do chatbot (fase futura) |
| 6 | Definir papéis de acesso dentro do painel do RH (quem pode só ver vs quem pode editar regras) | RH | Modelagem de permissões do painel |
| 7 | Definir a lista de números de WhatsApp + e-mails corporativos dos participantes da demo (poucos usuários de teste) | RH/Projeto | Cadastro dos números de "join" no Twilio Sandbox e no agente |
| 8 | Cadastrar a data de nascimento do(s) filho(s) de cada colaborador de teste que for testar o auxílio-creche | RH/Projeto | Elegibilidade do auxílio-creche |
| 9 | Decidir (fase futura) se o código de validação do documento (chave de NF-e / linha digitável do boleto) deve passar a ser validado automaticamente contra sistemas externos, hoje é só extraído para conferência manual do RH | RH/Técnico | Nível de automação da validação de autenticidade |

## 12. Critérios de sucesso (a refinar)

- **Critério do MVP:** demo ao vivo para a diretoria funciona de ponta a ponta sem falhas — envio do comprovante pelo WhatsApp, resposta de aceite/recusa em segundos, e geração do relatório no painel do RH já no layout do TOTVS RM.
- Colaborador consegue enviar um comprovante e receber confirmação/recusa em poucos segundos, sem fricção.
- RH consegue gerar o relatório mensal para a folha de pagamento sem nenhum ajuste manual de formato.
- RH consegue atualizar um limite de benefício sem depender de desenvolvimento.
- Zero acesso de colaboradores comuns ao painel administrativo ou aos dados de outros colaboradores.
