/**
 * Formulário Contratual De Marchi — criação e manutenção.
 *
 * QUAL FUNÇÃO RODAR
 *
 *   Já existe um formulário em uso?  ->  atualizarFormulario()
 *       Acrescenta só as perguntas que faltam, no lugar certo. Mantém a
 *       planilha de respostas, e portanto o gatilho do n8n. Pode rodar
 *       quantas vezes quiser.
 *
 *   Está começando do zero?  ->  criarFormularioContratual()
 *       Cria um formulário novo, completo. Gera uma planilha NOVA, então o
 *       gatilho do n8n precisa ser repontado.
 *
 *   Conferências:
 *       verificarDocumentosOferecidos()  — os 5 tipos com modelo estão lá?
 *       verificarTitulosDuplicados(url)  — algum título repetido?
 *       sincronizarEmpreendimentos()     — atualiza o menu de empreendimentos
 *
 * COMO USAR
 *   1. Acesse script.google.com → Novo projeto
 *   2. Cole este arquivo inteiro
 *   3. Configurações do projeto → Propriedades do script → URL_FORM = URL de
 *      edição do formulário (necessário para tudo menos criar do zero)
 *   4. Selecione a função desejada e clique em Executar
 *   5. Autorize quando o Google pedir e veja o log (Ctrl+Enter)
 *
 * REGRA IMPORTANTE
 *   Cada pergunta tem título ÚNICO. Títulos repetidos viram colunas com o
 *   mesmo cabeçalho na planilha, e o n8n perde dado quando isso acontece.
 *   Os títulos são o contrato com o nó "Extrair Campos" do n8n — mudar um
 *   aqui exige mudar lá.
 */

// Lista inicial, usada só na criação do formulário.
// Para manter o menu em dia depois, NÃO edite aqui e rode de novo — isso
// criaria outro formulário. Use sincronizarEmpreendimentos(), no fim do arquivo.
var EMPREENDIMENTOS = [
  'High Tower Jardins',
  'Reserva Verde'
];

var TIPO_COMPRA_VENDA = 'Contrato de Promessa de Compra e Venda';
var TIPO_ANEXO        = 'Anexo ao Contrato de Promessa de Compra e Venda';
var TIPO_ANUENCIA     = 'Termo de Anuência com Outorga de Poderes';
var TIPO_EMPRESTIMO   = 'Termo de Ciência e Anuência para Empréstimo';
var TIPO_SCP          = 'Termo de Adesão Preliminar SCP';

var ESTADOS_CIVIS = [
  'Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável', 'Outro'
];

var FORMAS_PAGAMENTO = [
  'Dinheiro', 'Transferência/PIX', 'Financiamento', 'Apartamento', 'Permuta', 'Outro'
];

var INDICES = ['INCC', 'IGP-M', 'IPCA', 'Outro'];


function criarFormularioContratual() {
  var form = FormApp.create('Formulário Contratual De Marchi');

  form.setTitle('Formulário Contratual De Marchi');
  form.setDescription(
    'Preenchimento dos dados para geração automática de contratos e termos.\n' +
    'As perguntas variam conforme o tipo de contratante e o documento escolhido.'
  );
  form.setCollectEmail(false);
  form.setProgressBar(true);
  form.setAllowResponseEdits(true);

  // ------------------------------------------------------------------
  // SEÇÃO 1 (inicial) — Dados gerais
  // ------------------------------------------------------------------
  form.addListItem()
    .setTitle('Empreendimento')
    .setHelpText('Empreendimento ao qual esta operação pertence.')
    .setChoiceValues(EMPREENDIMENTOS)
    .setRequired(true);

  form.addTextItem()
    .setTitle('Número da unidade')
    .setHelpText('Somente o número, como aparece no espelho de vendas. Ex: 1002')
    .setRequired(true);

  form.addDateItem()
    .setTitle('Data do documento')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Cidade/UF da assinatura - ex:(Aracruz/ES)')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Responsável interno pelo preenchimento')
    .setRequired(true);

  form.addTextItem()
    .setTitle('E-mail do responsável pelo preenchimento')
    .setHelpText('Para cá vai o aviso de que o contrato ficou pronto.')
    .setRequired(true);

  // ------------------------------------------------------------------
  // SEÇÃO 2 — Tipo de contratante (ramifica)
  // ------------------------------------------------------------------
  form.addPageBreakItem().setTitle('Contratante');
  var perguntaTipoPessoa = form.addMultipleChoiceItem()
    .setTitle('O contratante é pessoa física ou jurídica?')
    .setRequired(true);

  // ------------------------------------------------------------------
  // SEÇÃO 3 — Pessoa física
  // ------------------------------------------------------------------
  var secPF = form.addPageBreakItem().setTitle('Dados do comprador (pessoa física)');
  form.addTextItem().setTitle('Nome completo do comprador').setRequired(true);
  form.addTextItem().setTitle('CPF do comprador').setRequired(true);
  form.addTextItem().setTitle('Nacionalidade do comprador').setRequired(true);
  form.addListItem().setTitle('Estado civil do comprador')
    .setChoiceValues(ESTADOS_CIVIS).setRequired(true);
  form.addTextItem().setTitle('Profissão do comprador').setRequired(true);
  form.addTextItem().setTitle('RG do comprador').setRequired(true);
  form.addTextItem().setTitle('Órgão emissor do RG do comprador').setRequired(true);
  form.addTextItem().setTitle('Endereço completo do comprador').setRequired(true);
  form.addTextItem().setTitle('CEP do comprador').setRequired(true);
  form.addTextItem().setTitle('Telefone com DDD do comprador').setRequired(true);
  form.addTextItem().setTitle('E-mail do comprador').setRequired(true);

  var perguntaConjuge = form.addMultipleChoiceItem()
    .setTitle('O comprador possui cônjuge que deve constar no documento?')
    .setHelpText('Se sim, os dados do cônjuge serão pedidos na etapa seguinte.')
    .setRequired(true);

  // ------------------------------------------------------------------
  // SEÇÃO 4 — Pessoa jurídica
  // ------------------------------------------------------------------
  var secPJ = form.addPageBreakItem().setTitle('Dados do contratante (pessoa jurídica)');
  form.addTextItem().setTitle('Razão social do contratante').setRequired(true);
  form.addTextItem().setTitle('CNPJ do contratante').setRequired(true);
  form.addTextItem().setTitle('Endereço completo do contratante PJ').setRequired(true);
  form.addTextItem().setTitle('CEP do contratante PJ').setRequired(true);
  form.addTextItem().setTitle('Telefone com DDD do contratante PJ').setRequired(true);
  form.addTextItem().setTitle('E-mail do contratante PJ').setRequired(true);

  form.addSectionHeaderItem()
    .setTitle('Representante legal')
    .setHelpText('Quem assina o contrato em nome da empresa.');
  form.addTextItem().setTitle('Nome do representante legal').setRequired(true);
  form.addTextItem().setTitle('CPF do representante legal').setRequired(true);
  form.addTextItem().setTitle('RG do representante legal').setRequired(true);
  form.addTextItem().setTitle('Órgão emissor do RG do representante legal').setRequired(true);
  form.addTextItem().setTitle('Nacionalidade do representante legal').setRequired(true);
  form.addTextItem().setTitle('Profissão do representante legal').setRequired(true);

  // ------------------------------------------------------------------
  // SEÇÃO 5 — Cônjuge
  // ------------------------------------------------------------------
  var secConjuge = form.addPageBreakItem().setTitle('Dados do cônjuge');
  form.addTextItem().setTitle('Nome completo do cônjuge').setRequired(true);
  form.addTextItem().setTitle('CPF do cônjuge').setRequired(true);
  form.addTextItem().setTitle('Nacionalidade do cônjuge').setRequired(true);
  form.addTextItem().setTitle('Profissão do cônjuge').setRequired(true);
  form.addTextItem().setTitle('RG do cônjuge').setRequired(true);
  form.addTextItem().setTitle('Órgão emissor do RG do cônjuge').setRequired(true);

  // ------------------------------------------------------------------
  // SEÇÃO 6 — Unidade (comum a todos) + escolha do documento (ramifica)
  // ------------------------------------------------------------------
  var secUnidade = form.addPageBreakItem().setTitle('Unidade e documento');
  form.addTextItem().setTitle('Tipo da unidade - ex:(apartamento)').setRequired(true);
  form.addTextItem().setTitle('Número da unidade por extenso')
    .setHelpText('Ex: mil e dois').setRequired(true);

  var perguntaDocumento = form.addMultipleChoiceItem()
    .setTitle('Qual documento você deseja gerar?')
    .setRequired(true);

  // ------------------------------------------------------------------
  // SEÇÃO 7 — Compra e venda: detalhes da unidade e preço (ramifica)
  // ------------------------------------------------------------------
  var secCompraVenda = form.addPageBreakItem().setTitle('Detalhes da unidade e preço');
  form.addTextItem().setTitle('Quantidade de vagas de garagem').setRequired(true);
  form.addTextItem().setTitle('Números das vagas')
    .setHelpText('Ex: 12 e 13').setRequired(false);
  form.addTextItem().setTitle('Área privativa (m²)').setRequired(true);
  form.addTextItem().setTitle('Área de construção (m²)').setRequired(true);
  form.addTextItem().setTitle('Fração ideal').setRequired(true);
  form.addParagraphTextItem()
    .setTitle('Descrição da planta - ex:( 3 quartos, 1 suíte, varanda gourmet...)')
    .setRequired(false);
  form.addTextItem().setTitle('Preço total do imóvel (R$)')
    .setHelpText('Ex: R$ 733.000,00').setRequired(true);
  form.addTextItem().setTitle('Preço total por extenso').setRequired(true);

  // Cláusulas 1.4 e 3.2 do contrato de compra e venda: o total aberto em
  // terreno + construção. São valores distintos do total.
  form.addTextItem().setTitle('Valor da fração ideal do terreno (R$)')
    .setHelpText('Cláusula 1.4: quanto do preço corresponde ao terreno.')
    .setRequired(true);
  form.addTextItem().setTitle('Valor da fração ideal do terreno por extenso')
    .setRequired(true);
  form.addTextItem().setTitle('Custo de construção (R$)')
    .setHelpText('Cláusula 3.2: quanto do preço corresponde à construção.')
    .setRequired(true);
  form.addTextItem().setTitle('Custo de construção por extenso')
    .setRequired(true);

  var perguntaFormaAquisicao = form.addMultipleChoiceItem()
    .setTitle('Forma de aquisição')
    .setHelpText('Parcelamento e correção monetária só se aplicam à compra parcelada.')
    .setRequired(true);

  // ------------------------------------------------------------------
  // SEÇÃO 8 — Parcelamento
  // ------------------------------------------------------------------
  var secParcelas = form.addPageBreakItem().setTitle('Parcelamento');
  form.addListItem()
    .setTitle('Quantos tipos de parcelas existem nesta negociação?')
    .setHelpText('Preencha abaixo apenas a quantidade informada aqui.')
    .setChoiceValues(['1', '2', '3', '4', '5'])
    .setRequired(true);

  for (var n = 1; n <= 5; n++) {
    form.addSectionHeaderItem().setTitle('Parcela ' + n);
    form.addTextItem().setTitle('Tipo da parcela ' + n)
      .setHelpText('Ex: Sinal, Mensais, Intermediária, Chaves').setRequired(n === 1);
    form.addTextItem().setTitle('Data inicial de vencimento da parcela ' + n)
      .setHelpText('Formato DD/MM/AAAA').setRequired(false);
    form.addTextItem().setTitle('Valor unitário da parcela ' + n)
      .setHelpText('Valor de UMA parcela. Ex: R$ 10.000,00').setRequired(false);
    form.addTextItem().setTitle('Quantidade da parcela ' + n)
      .setHelpText('Quantas vezes esta parcela se repete. Ex: 08').setRequired(false);
    form.addTextItem().setTitle('Percentual da parcela ' + n).setRequired(false);
    form.addMultipleChoiceItem().setTitle('A parcela ' + n + ' é reajustável?')
      .setChoiceValues(['Sim', 'Não']).setRequired(false);
    form.addListItem().setTitle('Índice da parcela ' + n)
      .setHelpText('Preencher somente se a parcela for reajustável.')
      .setChoiceValues(INDICES).setRequired(false);
    form.addListItem().setTitle('Forma de pagamento da parcela ' + n)
      .setChoiceValues(FORMAS_PAGAMENTO).setRequired(false);
  }

  // ------------------------------------------------------------------
  // SEÇÃO 9 — Empréstimo
  // ------------------------------------------------------------------
  var secEmprestimo = form.addPageBreakItem().setTitle('Dados do empréstimo');
  form.addTextItem().setTitle('Data do compromisso de compra e venda')
    .setHelpText('Formato DD/MM/AAAA').setRequired(true);
  form.addSectionHeaderItem().setTitle('Instituição credora');
  form.addTextItem().setTitle('Nome da Pessoa Jurídica').setRequired(true);
  form.addTextItem().setTitle('CNPJ da Pessoa Jurídica').setRequired(true);
  form.addTextItem().setTitle('Endereço completo da Pessoa Jurídica').setRequired(true);
  form.addTextItem().setTitle('CEP da Pessoa Jurídica').setRequired(true);
  form.addTextItem().setTitle('Endereço do imóvel').setRequired(true);
  form.addMultipleChoiceItem().setTitle('Residência?')
    .setChoiceValues(['Sim', 'Não']).setRequired(false);

  // ------------------------------------------------------------------
  // SEÇÃO 10 — SCP
  // ------------------------------------------------------------------
  var secScp = form.addPageBreakItem().setTitle('Dados da SCP');
  form.addTextItem().setTitle('Razão social do empreendimento').setRequired(true);
  form.addTextItem().setTitle('CNPJ do empreendimento').setRequired(true);
  form.addTextItem().setTitle('Endereço completo da empresa').setRequired(true);
  form.addTextItem().setTitle('CEP da empresa').setRequired(true);
  form.addTextItem().setTitle('Valor da Entrada').setRequired(true);
  form.addTextItem().setTitle('Número de Unidades').setRequired(true);

  // ------------------------------------------------------------------
  // SEÇÃO 11 — Intermediação (ramifica)
  // ------------------------------------------------------------------
  var secIntermediadora = form.addPageBreakItem().setTitle('Intermediação');
  var perguntaIntermediadora = form.addMultipleChoiceItem()
    .setTitle('Existe construtora intermediadora nesta operação?')
    .setRequired(true);

  // ------------------------------------------------------------------
  // SEÇÃO 12 — Dados da intermediadora
  // ------------------------------------------------------------------
  var secIntermediadoraDados = form.addPageBreakItem().setTitle('Dados da intermediadora');
  form.addTextItem().setTitle('Razão social da intermediadora').setRequired(true);
  form.addTextItem().setTitle('CNPJ da intermediadora').setRequired(true);
  form.addTextItem().setTitle('CRECI da intermediadora').setRequired(false);
  form.addTextItem().setTitle('Endereço completo da intermediadora').setRequired(false);
  form.addTextItem().setTitle('Nome do representante da intermediadora').setRequired(false);

  // ------------------------------------------------------------------
  // SEÇÃO 13 — Testemunhas
  // ------------------------------------------------------------------
  var secTestemunhas = form.addPageBreakItem().setTitle('Testemunhas');
  form.addTextItem().setTitle('Nome da testemunha 1').setRequired(false);
  form.addTextItem().setTitle('CPF da testemunha 1').setRequired(false);
  form.addTextItem().setTitle('Nome da testemunha 2').setRequired(false);
  form.addTextItem().setTitle('CPF da testemunha 2').setRequired(false);

  // ------------------------------------------------------------------
  // SEÇÃO 14 — Observações
  // ------------------------------------------------------------------
  var secObservacoes = form.addPageBreakItem().setTitle('Observações finais');
  form.addMultipleChoiceItem()
    .setTitle('Existe alguma observação especial na negociação?')
    .setChoiceValues(['Sim', 'Não']).setRequired(false);
  form.addParagraphTextItem()
    .setTitle('Descreva a observação especial').setRequired(false);
  form.addMultipleChoiceItem()
    .setTitle('Existe personalização de unidade / ajuste comercial que precisa constar?')
    .setChoiceValues(['Sim', 'Não']).setRequired(false);
  form.addParagraphTextItem()
    .setTitle('Descreva a personalização / ajuste').setRequired(false);

  // ==================================================================
  // Roteamento — feito no fim, quando todas as seções já existem
  // ==================================================================
  perguntaTipoPessoa.setChoices([
    perguntaTipoPessoa.createChoice('Pessoa física', secPF),
    perguntaTipoPessoa.createChoice('Pessoa jurídica (CNPJ)', secPJ)
  ]);

  perguntaConjuge.setChoices([
    perguntaConjuge.createChoice('Sim', secConjuge),
    perguntaConjuge.createChoice('Não', secUnidade)
  ]);

  // Pessoa jurídica não tem cônjuge
  secPJ.setGoToPage(secUnidade);
  secConjuge.setGoToPage(secUnidade);

  // Anexo e Anuência não pedem preço nem parcelas: vão direto à intermediação
  perguntaDocumento.setChoices([
    perguntaDocumento.createChoice(TIPO_COMPRA_VENDA, secCompraVenda),
    perguntaDocumento.createChoice(TIPO_ANEXO, secIntermediadora),
    perguntaDocumento.createChoice(TIPO_ANUENCIA, secIntermediadora),
    perguntaDocumento.createChoice(TIPO_EMPRESTIMO, secEmprestimo),
    perguntaDocumento.createChoice(TIPO_SCP, secScp)
  ]);

  perguntaFormaAquisicao.setChoices([
    perguntaFormaAquisicao.createChoice('À vista', secIntermediadora),
    perguntaFormaAquisicao.createChoice('Parcelado', secParcelas)
  ]);

  secParcelas.setGoToPage(secIntermediadora);
  secEmprestimo.setGoToPage(secIntermediadora);
  secScp.setGoToPage(secIntermediadora);

  perguntaIntermediadora.setChoices([
    perguntaIntermediadora.createChoice('Sim', secIntermediadoraDados),
    perguntaIntermediadora.createChoice('Não', secTestemunhas)
  ]);

  secIntermediadoraDados.setGoToPage(secTestemunhas);
  secTestemunhas.setGoToPage(secObservacoes);
  secObservacoes.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  Logger.log('Formulario criado com sucesso.');
  Logger.log('Editar   : ' + form.getEditUrl());
  Logger.log('Responder: ' + form.getPublishedUrl());
  Logger.log('');
  Logger.log('PROXIMO PASSO: no formulario, aba Respostas -> vincular a uma');
  Logger.log('planilha. Depois aponte o gatilho do n8n para essa planilha nova.');
}


// ============================================================================
// ATUALIZAR O FORMULÁRIO QUE JÁ EXISTE
// ============================================================================
//
// Use esta função, e NÃO criarFormularioContratual(), quando o formulário já
// está em uso. Criar outro geraria uma planilha nova, e o gatilho do n8n
// aponta para a planilha atual — trocar isso é retrabalho sem motivo.
//
// Ela acrescenta só o que está faltando, na posição certa, e pode ser rodada
// quantas vezes quiser: o que já existe é deixado como está.
//
// CONFIGURAÇÃO
//   Configurações do projeto -> Propriedades do script -> URL_FORM = URL de edição
//   (a mesma propriedade que sincronizarEmpreendimentos já usa)

// Cada campo diz depois de qual pergunta ele entra. A ordem aqui importa:
// os quatro valores se encadeiam, cada um depois do anterior.
var CAMPOS_A_ACRESCENTAR = [
  {
    titulo: 'E-mail do responsável pelo preenchimento',
    ajuda: 'Para cá vai o aviso de que o contrato ficou pronto.',
    obrigatorio: true,
    depoisDe: 'Responsável interno pelo preenchimento'
  },
  {
    titulo: 'Valor da fração ideal do terreno (R$)',
    ajuda: 'Cláusula 1.4: quanto do preço corresponde ao terreno.',
    obrigatorio: true,
    depoisDe: 'Preço total por extenso'
  },
  {
    titulo: 'Valor da fração ideal do terreno por extenso',
    ajuda: '',
    obrigatorio: true,
    depoisDe: 'Valor da fração ideal do terreno (R$)'
  },
  {
    titulo: 'Custo de construção (R$)',
    ajuda: 'Cláusula 3.2: quanto do preço corresponde à construção.',
    obrigatorio: true,
    depoisDe: 'Valor da fração ideal do terreno por extenso'
  },
  {
    titulo: 'Custo de construção por extenso',
    ajuda: '',
    obrigatorio: true,
    depoisDe: 'Custo de construção (R$)'
  }
];

function atualizarFormulario() {
  var form = abrirFormulario();
  Logger.log('Formulario: ' + form.getTitle());
  Logger.log('');

  // Antes de mexer, confere se todas as âncoras existem. Se alguma não estiver
  // lá, o formulário não é o que este script espera — melhor parar sem gravar
  // do que espalhar perguntas em lugar errado.
  var faltandoAncora = [];
  CAMPOS_A_ACRESCENTAR.forEach(function (campo) {
    var ehNovo = CAMPOS_A_ACRESCENTAR.some(function (c) { return c.titulo === campo.depoisDe; });
    if (!ehNovo && !acharItem(form, campo.depoisDe)) faltandoAncora.push(campo.depoisDe);
  });

  if (faltandoAncora.length) {
    throw new Error('Nada foi alterado. Não achei estas perguntas no formulário: ' +
                    faltandoAncora.join(' | '));
  }

  var criados = [];
  var jaExistiam = [];

  CAMPOS_A_ACRESCENTAR.forEach(function (campo) {
    if (acharItem(form, campo.titulo)) {
      jaExistiam.push(campo.titulo);
      return;
    }

    var novo = form.addTextItem().setTitle(campo.titulo).setRequired(campo.obrigatorio);
    if (campo.ajuda) novo.setHelpText(campo.ajuda);

    // addTextItem joga no fim; move para logo depois da âncora.
    var ancora = acharItem(form, campo.depoisDe);
    if (ancora) form.moveItem(novo.getIndex(), ancora.getIndex() + 1);

    criados.push(campo.titulo);
  });

  Logger.log('Perguntas acrescentadas: ' + (criados.join(' | ') || 'nenhuma'));
  Logger.log('Ja existiam            : ' + (jaExistiam.join(' | ') || 'nenhuma'));
  Logger.log('');

  if (criados.length) {
    Logger.log('ATENCAO: cada pergunta nova vira uma COLUNA NOVA no fim da planilha');
    Logger.log('de respostas. O n8n procura pelo titulo da coluna, nao pela posicao,');
    Logger.log('entao nada quebra — mas o no "Extrair Campos" precisa estar');
    Logger.log('atualizado (reimporte o producao-render.json).');
  }

  return { criados: criados, jaExistiam: jaExistiam };
}

/**
 * Abre o formulário a partir da propriedade URL_FORM.
 *
 * Aceita o que a pessoa tiver em mãos — a URL de edição, a mesma sem o
 * "/edit", ou só o identificador — porque essa é a parte da configuração em
 * que é mais fácil errar, e o erro do FormApp não explica nada.
 *
 * O único endereço que NÃO serve é o público ("/forms/d/e/.../viewform"):
 * ele identifica o formulário para quem responde, não o documento.
 */
function abrirFormulario() {
  var valor = (PropertiesService.getScriptProperties().getProperty('URL_FORM') || '').trim();

  if (!valor) {
    throw new Error(
      'URL_FORM nao esta configurada.\n' +
      'Configuracoes do projeto -> Propriedades do script -> URL_FORM = ' +
      'https://docs.google.com/forms/d/SEU_ID/edit'
    );
  }

  if (valor.indexOf('/forms/d/e/') !== -1) {
    throw new Error(
      'URL_FORM tem o endereco PUBLICO (o de "/forms/d/e/.../viewform"), que serve\n' +
      'para responder, nao para editar. Abra o formulario no modo de edicao e copie\n' +
      'o endereco da barra: https://docs.google.com/forms/d/SEU_ID/edit'
    );
  }

  // Tanto ".../forms/d/<id>/edit" quanto ".../forms/d/<id>" quanto só o <id>.
  var casou = valor.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  var id = casou ? casou[1] : (/^[a-zA-Z0-9_-]{20,}$/.test(valor) ? valor : null);

  if (!id) {
    throw new Error(
      'Nao reconheci "' + valor + '" como formulario.\n' +
      'Esperado: https://docs.google.com/forms/d/SEU_ID/edit'
    );
  }

  try {
    return FormApp.openById(id);
  } catch (e) {
    throw new Error(
      'Achei o identificador "' + id + '", mas nao consegui abrir o formulario.\n' +
      'Confira se ele existe e se esta na conta que roda este script.\n' +
      'Mensagem original: ' + e.message
    );
  }
}


/** Acha um item pelo título exato, ignorando espaço nas pontas. */
function acharItem(form, titulo) {
  var alvo = String(titulo).trim();
  var achado = null;
  form.getItems().forEach(function (item) {
    if (item.getTitle().trim() === alvo) achado = item;
  });
  return achado;
}


/**
 * Confere se o formulário oferece os cinco documentos que têm modelo no
 * sistema. Documento oferecido sem modelo gera contrato que nunca fica pronto.
 */
function verificarDocumentosOferecidos() {
  var esperados = [TIPO_COMPRA_VENDA, TIPO_ANEXO, TIPO_ANUENCIA, TIPO_EMPRESTIMO, TIPO_SCP];
  var pergunta = acharItem(abrirFormulario(), 'Qual documento você deseja gerar?');
  if (!pergunta) throw new Error('Não achei a pergunta "Qual documento você deseja gerar?".');

  var oferecidos = pergunta.asMultipleChoiceItem().getChoices().map(function (c) { return c.getValue(); });

  var faltando = esperados.filter(function (t) { return oferecidos.indexOf(t) === -1; });
  var sobrando = oferecidos.filter(function (t) { return esperados.indexOf(t) === -1; });

  Logger.log('Oferecidos no formulario: ' + oferecidos.join(' | '));
  Logger.log('Faltando (tem modelo, nao e oferecido): ' + (faltando.join(' | ') || 'nenhum'));
  Logger.log('Sobrando (oferecido, SEM modelo): ' + (sobrando.join(' | ') || 'nenhum'));

  if (sobrando.length) {
    Logger.log('');
    Logger.log('ATENCAO: os "sobrando" geram contrato que o sistema nunca consegue');
    Logger.log('montar, porque nao existe .docx correspondente.');
  }

  return { oferecidos: oferecidos, faltando: faltando, sobrando: sobrando };
}


/**
 * Confere se algum título de pergunta ficou repetido — títulos repetidos
 * viram colunas iguais na planilha e o n8n perde dado.
 * Rode depois de criar, passando a URL de edição.
 */
function verificarTitulosDuplicados(urlEdicao) {
  var form = FormApp.openByUrl(urlEdicao);
  var vistos = {};
  var duplicados = [];

  form.getItems().forEach(function (item) {
    var tipo = item.getType();
    if (tipo === FormApp.ItemType.PAGE_BREAK || tipo === FormApp.ItemType.SECTION_HEADER) return;

    var titulo = item.getTitle().trim();
    if (vistos[titulo]) {
      duplicados.push(titulo);
    }
    vistos[titulo] = true;
  });

  if (duplicados.length) {
    Logger.log('TITULOS DUPLICADOS encontrados:');
    duplicados.forEach(function (t) { Logger.log('  - ' + t); });
  } else {
    Logger.log('Nenhum titulo duplicado. Formulario ok.');
  }
}


// ============================================================================
// SINCRONIZAR EMPREENDIMENTOS
// ============================================================================
//
// Cadastrou um empreendimento novo no sistema? Rode esta função para o menu
// suspenso do formulário passar a oferecê-lo. Ela ATUALIZA o formulário que já
// existe — não cria outro, não mexe na planilha, não afeta o n8n.
//
// CONFIGURAÇÃO (uma vez só)
//   No editor do Apps Script: Configurações do projeto → Propriedades do script
//   Adicione:
//     URL_APP    = https://seu-endereco-do-sistema   (sem barra no final)
//     TOKEN_APP  = o mesmo valor de WEBHOOK_SECRET no .env
//     URL_FORM   = a URL de edição do formulário
//
// Para não precisar lembrar de rodar, dá para criar um acionador por tempo:
//   Acionadores → Adicionar acionador → sincronizarEmpreendimentos → Por tempo

function sincronizarEmpreendimentos() {
  var prop = PropertiesService.getScriptProperties();
  var urlApp = prop.getProperty('URL_APP');
  var token = prop.getProperty('TOKEN_APP');
  var urlForm = prop.getProperty('URL_FORM');

  if (!urlApp || !token || !urlForm) {
    throw new Error('Configure URL_APP, TOKEN_APP e URL_FORM nas Propriedades do script.');
  }

  var resposta = UrlFetchApp.fetch(urlApp.replace(/\/$/, '') + '/webhook/empreendimentos', {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });

  if (resposta.getResponseCode() !== 200) {
    throw new Error('O sistema respondeu ' + resposta.getResponseCode() +
                    '. Verifique se está no ar e se o token confere. Nada foi alterado.');
  }

  var dados = JSON.parse(resposta.getContentText());
  var nomes = (dados.empreendimentos || []).map(function (e) { return e.nome; });

  // Sem nomes, sair sem tocar no formulário: um menu vazio quebraria o
  // preenchimento para todo mundo.
  if (!nomes.length) {
    throw new Error('O sistema não devolveu nenhum empreendimento. Nada foi alterado.');
  }

  var form = FormApp.openByUrl(urlForm);
  var pergunta = null;

  form.getItems().forEach(function (item) {
    if (item.getTitle().trim() === 'Empreendimento') pergunta = item;
  });

  if (!pergunta) {
    throw new Error('Não achei a pergunta "Empreendimento" no formulário.');
  }

  var antes = pergunta.asListItem().getChoices().map(function (c) { return c.getValue(); });
  pergunta.asListItem().setChoiceValues(nomes);

  var novos = nomes.filter(function (n) { return antes.indexOf(n) === -1; });
  var removidos = antes.filter(function (n) { return nomes.indexOf(n) === -1; });

  Logger.log('Menu atualizado: ' + nomes.join(', '));
  Logger.log('Acrescentados: ' + (novos.join(', ') || 'nenhum'));
  Logger.log('Removidos    : ' + (removidos.join(', ') || 'nenhum'));

  return { total: nomes.length, novos: novos, removidos: removidos };
}
