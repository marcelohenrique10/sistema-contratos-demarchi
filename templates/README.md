# Modelos de documento

Cópias padronizadas dos arquivos de `modelo-contratos/`. Os originais não foram
alterados. Estes aqui é que a aplicação usa para gerar os documentos.

Se um modelo precisar de ajuste de texto, edite **este** arquivo (é ele que vale)
e mantenha os placeholders com o nome exato da tabela abaixo.

## Regra dos placeholders

Formato `[BLOCO_CAMPO]`, sempre em maiúsculas com underscore. Um nome, um
significado — nenhum placeholder pode ser ambíguo dentro do documento.

## Vocabulário

### Comprador — vem do formulário

| Placeholder | Campo no formulário |
|---|---|
| `[COMPRADOR_NOME]` | Nome completo do comprador |
| `[COMPRADOR_CPF]` | CPF do comprador |
| `[COMPRADOR_NACIONALIDADE]` | Nacionalidade do comprador |
| `[COMPRADOR_ESTADO_CIVIL]` | Estado civil do comprador |
| `[COMPRADOR_PROFISSAO]` | Profissão do comprador |
| `[COMPRADOR_RG]` | RG do comprador |
| `[COMPRADOR_ORGAO_EMISSOR]` | Órgão emissor do RG do comprador |
| `[COMPRADOR_ENDERECO]` | Endereço completo + CEP |
| `[COMPRADOR_TELEFONE]` | Telefone com DDD |
| `[COMPRADOR_EMAIL]` | E-mail do comprador |

### Cônjuge — vem do formulário, só quando informado

`[CONJUGE_NOME]` · `[CONJUGE_CPF]` · `[CONJUGE_NACIONALIDADE]` ·
`[CONJUGE_PROFISSAO]` · `[CONJUGE_RG]` · `[CONJUGE_ORGAO_EMISSOR]`

O cônjuge não tem estado civil próprio no formulário — é o mesmo do comprador.

### Empreendimento — vem do banco, não do formulário

Cada empreendimento é uma SPE (sociedade própria, CNPJ próprio) e entra nos
contratos como VENDEDORA. Cadastrados na tela de Empreendimentos.

| Placeholder | Coluna em `empreendimentos` |
|---|---|
| `[EMPREENDIMENTO_NOME]` | `nome` — nome comercial ("High Tower Jardins") |
| `[EMPREENDIMENTO_RAZAO_SOCIAL]` | `razaoSocial` — a SPE, que assina como VENDEDORA |
| `[EMPREENDIMENTO_CNPJ]` | `cnpj` |
| `[EMPREENDIMENTO_ENDERECO]` | `endereco` |
| `[EMPREENDIMENTO_CEP]` | `cep` |
| `[EMPREENDIMENTO_SOCIO_ADMIN]` | `socioAdmin` |
| `[EMPREENDIMENTO_EMAIL]` | `email` |

Onde o contrato fala da parte contratante, use `RAZAO_SOCIAL` (é a pessoa
jurídica). Onde fala do empreendimento como obra, use `NOME`.

### Incorporação — vem do banco (cadastro do empreendimento)

Item II do Quadro Resumo e cláusula 3 do Contrato de Promessa. Valem para todas
as unidades do empreendimento. O administrador edita na tela do empreendimento
ou no formulário de contrato; o corretor só vê. A lista fica em
`services/incorporacao.js`.

| Placeholder | Coluna em `empreendimentos` |
|---|---|
| `[INCORPORACAO_REGISTRO]` | `registroIncorporacao` |
| `[INCORPORACAO_PATRIMONIO_AFETACAO]` | `patrimonioAfetacao` |
| `[IMOVEL_ENDERECO]` | `enderecoImovel` — endereço do terreno, como na matrícula |
| `[ALVARA_CONSTRUCAO]` | `alvaraConstrucao` |
| `[DATA_PREVISTA_ENTREGA]` | `dataEntrega` — sai dd/mm/aaaa |
| `[ORCAMENTO_DATA]` | `dataOrcamento` — cláusula 3.2, "aos preços vigentes em" |
| `[TIPO_PADRONIZADO]` | `tipoPadronizado` — "101" sai "101 (Cento e um)" |
| `[AREAS_SUB_ROGADAS]` | `areasSubRogadas` — cláusula 3.3, com o artigo ("das Lojas...") |

As áreas sub-rogadas **não são a unidade comprada**: são as unidades cuja
construção o comprador paga na proporção da fração ideal, por conta do contrato
de incorporação com o dono do terreno (a cláusula 1.4 cita "o custo de
construção das áreas sub-rogadas enumeradas na cláusula terceira").

### Intermediadora — opcional, vem do formulário

Sem intermediadora, o bloco inteiro (título e texto) **sai do documento**:
`gerarDocumento` remove os parágrafos com placeholder `INTERMEDIADORA_`.

| Placeholder | Campo |
|---|---|
| `[INTERMEDIADORA_TITULO]` | "INTERMEDIADORA" quando há; marca o título para sair junto |
| `[INTERMEDIADORA_RAZAO_SOCIAL]` | Razão social |
| `[INTERMEDIADORA_CNPJ]` | CNPJ |
| `[INTERMEDIADORA_CRECI]` | CRECI jurídico |
| `[INTERMEDIADORA_ENDERECO]` | Endereço da sede, com CEP e cidade |
| `[INTERMEDIADORA_REPRESENTANTE]` | Nome do representante |
| `[INTERMEDIADORA_REPRESENTANTE_QUALIFICACAO]` | ", sócia, brasileira, ..." — a vírgula vem junto |

### Observações do quadro de pagamento

`[OBS_PAGAMENTO]` é um parágrafo repetido: uma cópia por linha do campo
"Observações" do formulário, numeradas a partir de 2) (a 1) é fixa no modelo).
Sem observação, o parágrafo sai.

### Unidade

| Placeholder | Campo no formulário |
|---|---|
| `[UNIDADE_NUMERO]` | Número da unidade |
| `[UNIDADE_NUMERO_EXTENSO]` | Número da unidade por extenso |
| `[UNIDADE_TIPO]` | Tipo da unidade |
| `[UNIDADE_VAGAS]` | Quantidade de vagas de garagem |
| `[UNIDADE_NUMEROS_VAGAS]` | Números das vagas |
| `[UNIDADE_AREA_PRIVATIVA]` | Área privativa (m²) |
| `[UNIDADE_AREA_CONSTRUCAO]` | Área de construção (m²) |
| `[UNIDADE_FRACAO_IDEAL]` | Fração ideal |
| `[UNIDADE_DESCRICAO_PLANTA]` | Descrição da planta |

### Preço, documento e testemunhas

| Placeholder | Origem |
|---|---|
| `[PRECO_TOTAL]` | Preço total do imóvel — o "R$ " é acrescentado se faltar |
| `[PRECO_TOTAL_EXTENSO]` | Preço total por extenso |
| `[VALOR_FRACAO_IDEAL]` | Valor da fração ideal do terreno — cláusula 1.4 |
| `[VALOR_FRACAO_IDEAL_EXTENSO]` | O mesmo por extenso |
| `[VALOR_CUSTO_CONSTRUCAO]` | Custo de construção — cláusula 3.2 |
| `[VALOR_CUSTO_CONSTRUCAO_EXTENSO]` | O mesmo por extenso |
| `[FORMA_AQUISICAO]` | Vira "parcelada" ou "à vista" para caber na frase |
| `[DOC_DATA]` | Data do documento |
| `[DOC_DIA]` / `[DOC_MES]` / `[DOC_ANO]` | Data quebrada (usado só no SCP) |
| `[DATA_COMPROMISSO_COMPRA_VENDA]` | Data do compromisso (termo de empréstimo) |
| `[SCP_VALOR_ENTRADA]` | Valor da entrada (SCP) |
| `[TESTEMUNHA_1_NOME]` / `[TESTEMUNHA_2_NOME]` | Nome das testemunhas 1 e 2 |
| `[TESTEMUNHA_1_CPF]` / `[TESTEMUNHA_2_CPF]` | CPF das testemunhas 1 e 2 |

## Modelos disponíveis

| Arquivo | Tipo escolhido no formulário |
|---|---|
| `contrato-promessa-compra-venda.docx` | Contrato de Promessa de Compra e Venda |
| `anexo-promessa-compra-venda.docx` | Anexo ao Contrato de Promessa de Compra e Venda |
| `termo-anuencia-outorga-poderes.docx` | Termo de Anuência com Outorga de Poderes |
| `termo-ciencia-anuencia-emprestimo.docx` | Termo de Ciência e Anuência para Empréstimo |
| `termo-adesao-preliminar-scp.docx` | Termo de Adesão Preliminar SCP |

## Divergências encontradas nos modelos originais

Estas vieram dos arquivos que o cliente enviou e **precisam de validação do
jurídico** — não são decisões de código:

- **Três CNPJs para o mesmo empreendimento**: `46.625.994/0001-32` (anuência e
  compra e venda) e `62.255.242/0001-83` (empréstimo, ainda fixo no texto).
- **Dois endereços**: `Rua Flor do Guarujá, nº 47` (compra e venda) e
  `Rua Flor de Noiva, nº 47` (anuência).
- **Contaminação entre empreendimentos**: o contrato do High Tower trazia
  `EDIFÍCIO FLOR DO GUARUJÁ` e a conta bancária em nome da Flor do Guarujá com
  o CNPJ do High Tower. Os nomes viraram placeholder, o que resolve; os dados
  bancários (banco, agência, conta) seguem fixos por decisão do projeto —
  então gerar contrato de outro empreendimento sai com a conta do High Tower.

## Pendências conhecidas

- **Contrato de permuta de terreno** ainda não padronizado: tem `[PORCENTAGEM]`
  9× e `[a completar]` 4×, cada um com significado distinto, dentro de cláusulas
  jurídicas. Precisa de mapeamento manual validado.
- **Permuta de concreto e de materiais** não têm origem de dados: o formulário
  nunca coletou esses campos.
- No contrato de compra e venda, o campo rotulado `CPF:` usava o placeholder
  `[CNPJ]` por engano do documento original. Mapeado para `[COMPRADOR_CPF]`.
  **Confirmar com o jurídico.**
- **Os dados que o modelo trazia no item II e na cláusula 3** (matrícula
  22.074, alvará 224/2021, entrega 23/01/2025, orçamento de 13/06/2022, tipo
  101, Lojas 01 a 04) viraram campos do empreendimento em 26/10/2026, sem
  aproveitar esses valores: pelas datas, parecem ser de um empreendimento
  anterior ao High Tower (a SPE dele foi aberta em 08/2025). O cliente precisa
  informar os do High Tower.
- A **cláusula 1.3** ainda descreve o terreno por escrito fixo (lotes 6 e 8,
  quadra 10, Rua Flor do Guarujá nº 47, matrícula 22.074). Se os dados do item
  II mudarem, ela precisa acompanhar.
- O bloco do **cônjuge** sai com os rótulos vazios quando não há cônjuge. Para
  sumir como a intermediadora, falta separar o nome do cônjuge da linha de
  assinatura, que divide o parágrafo com o nome do comprador.
- Os blocos de assinatura trazem só o **nome** do comprador e do cônjuge, sem
  linha de CPF — as testemunhas têm. Se o jurídico quiser CPF ali também,
  é alteração no modelo (há 15 blocos de rubrica no documento).


## De onde vêm os dados de cada modelo

Os modelos se dividem em dois grupos, e a diferença não é cosmética.

| Origem | Quando nasce | Quem preenche |
|---|---|---|
| `formulario` | no início da venda | o Google Forms, via n8n |
| `sistema` | no fim da operação | o próprio sistema, do cadastro e do financeiro |

Os dois documentos de encerramento — **Termo de Quitação** e **Cancelamento do
Termo de Adesão** — não passam pelo formulário. Ninguém vai redigitar nome,
CPF e endereço meses depois de fechar a venda; o sistema já tem esses dados.
Eles são emitidos por um botão na tela de Contratos.

Por isso também não aparecem nas caixas de seleção ao abrir uma operação:
marcá-los no começo criaria um pendente esperando um formulário que nunca vem.

### Placeholders do encerramento

| Placeholder | Origem |
|---|---|
| `[QUITACAO_TOTAL]` / `[QUITACAO_TOTAL_EXTENSO]` | soma dos lançamentos recebidos |
| `[QUITACAO_SALDO]` | sempre zero: o termo só sai com tudo quitado |
| `[QUITACAO_DATA]` | data do último recebimento confirmado |
| `[DISTRATO_VALOR]` / `[DISTRATO_VALOR_EXTENSO]` | o que já havia sido recebido, a devolver |
| `[UNIDADE_ANDAR]` | `pavimento` da unidade, por extenso ("10º" → "décimo andar") |

O valor por extenso é gerado por `services/extenso.js` — não vem do
formulário, porque não há formulário nesse momento.

### Quadro de pagamentos do Termo de Quitação

A tabela é montada a partir do **financeiro** daquele cliente e unidade:

| Coluna do documento | Campo em `financeiro` |
|---|---|
| Parcela | `categoria`, numerada por ordem |
| Vencimento | `data` |
| Valor (R$) | `valor` |
| Recebimento | `dataRecebimento` |
| Situação | `status` |

Isso tem uma consequência que precisa ficar dita: **confirmar um recebimento no
sistema deixou de ser controle interno e passou a ter efeito num documento
assinado.** Erro de lançamento vira erro em termo de quitação.

### Campos do empreendimento usados nos termos

Estes dados viviam escritos dentro dos modelos e agora vêm do cadastro. É o
que permite um segundo empreendimento sem herdar a conta bancária do primeiro.

| Placeholder | Campo |
|---|---|
| `[EMPREENDIMENTO_NOME_FANTASIA]` | `nomeFantasia` (cai para `nome` se vazio) |
| `[EMPREENDIMENTO_TELEFONE]` | `telefone` |
| `[EMPREENDIMENTO_SITE]` | `site` |
| `[EMPREENDIMENTO_BANCO]` / `[EMPREENDIMENTO_AGENCIA]` | `banco` / `agencia` |
| `[EMPREENDIMENTO_CONTA]` / `[EMPREENDIMENTO_PIX]` | `conta` / `pix` |
| `[SOCIO_ADMIN_CPF]` / `[SOCIO_ADMIN_RG]` / `[SOCIO_ADMIN_ENDERECO]` | qualificação de quem assina |
