const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const docx = require('./docx');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const caminhos = require('../caminhos');
const STORAGE_DIR = path.join(caminhos.STORAGE, 'documentos');

// Nome do tipo escolhido no formulário -> arquivo de modelo
const MODELOS = {
  'Contrato de Promessa de Compra e Venda': 'contrato-promessa-compra-venda.docx',
  'Anexo ao Contrato de Promessa de Compra e Venda': 'anexo-promessa-compra-venda.docx',
  'Termo de Anuência com Outorga de Poderes': 'termo-anuencia-outorga-poderes.docx',
  'Termo de Ciência e Anuência para Empréstimo': 'termo-ciencia-anuencia-emprestimo.docx',
  'Termo de Adesão Preliminar SCP': 'termo-adesao-preliminar-scp.docx',
  'Termo de Quitação de Obrigações': 'termo-quitacao.docx',
  'Cancelamento do Termo de Adesão Preliminar': 'distrato-adesao-scp.docx'
};

/**
 * De onde vêm os dados de cada documento.
 *
 *   formulario — nasce no INÍCIO da venda. Alguém preenche o Google Forms, o
 *                n8n traz a resposta e o sistema monta o arquivo.
 *   sistema    — nasce no FIM da operação (quitação, distrato). Ninguém vai
 *                redigitar nome, CPF e endereço meses depois: o sistema já
 *                tem esses dados, e gera a partir deles.
 *
 * A diferença não é cosmética. Documento de origem `sistema` não pode ser
 * oferecido ao abrir a operação — viraria um pendente esperando um formulário
 * que nunca chega.
 */
const ORIGEM = { FORMULARIO: 'formulario', SISTEMA: 'sistema' };

/**
 * Os mesmos modelos, com o que a tela de contratos precisa mostrar.
 *
 * A tela já teve uma lista própria, escrita à mão, e ela divergiu: oferecia
 * "Contrato de Permuta" e "Termo de Reserva", que não têm modelo, e um
 * "Termo de Ciência e Anuência" cujo nome não batia com o daqui. Os contratos
 * criados assim nasciam impossíveis de gerar. Por isso agora é uma lista só.
 */
const CATALOGO = [
  {
    tipo: 'Contrato de Promessa de Compra e Venda',
    categoria: 'Compra e Venda',
    origem: ORIGEM.FORMULARIO,
    resumo: 'O contrato principal da venda: preço, parcelas e unidade.'
  },
  {
    tipo: 'Anexo ao Contrato de Promessa de Compra e Venda',
    categoria: 'Anexo',
    origem: ORIGEM.FORMULARIO,
    resumo: 'Complementa o contrato principal com o detalhamento da unidade.'
  },
  {
    tipo: 'Termo de Anuência com Outorga de Poderes',
    categoria: 'Termo',
    origem: ORIGEM.FORMULARIO,
    resumo: 'Autoriza a incorporadora a representar o comprador nos atos da obra.'
  },
  {
    tipo: 'Termo de Ciência e Anuência para Empréstimo',
    categoria: 'Termo',
    origem: ORIGEM.FORMULARIO,
    resumo: 'Para quando há instituição credora financiando a operação.'
  },
  {
    tipo: 'Termo de Adesão Preliminar SCP',
    categoria: 'Termo',
    origem: ORIGEM.FORMULARIO,
    resumo: 'Adesão à Sociedade em Conta de Participação do empreendimento.'
  },
  {
    tipo: 'Termo de Quitação de Obrigações',
    categoria: 'Encerramento',
    origem: ORIGEM.SISTEMA,
    resumo: 'Declara o pagamento integral. O quadro de parcelas vem do Financeiro.'
  },
  {
    tipo: 'Cancelamento do Termo de Adesão Preliminar',
    categoria: 'Encerramento',
    origem: ORIGEM.SISTEMA,
    resumo: 'Distrato da adesão à SCP, com devolução do aporte ao investidor.'
  }
];

// Divergir de novo custaria contrato impossível de gerar, e só apareceria
// semanas depois. Falhar ao subir é mais barato.
(() => {
  const noCatalogo = CATALOGO.map((m) => m.tipo).sort();
  const nosModelos = Object.keys(MODELOS).sort();
  const diferenca = noCatalogo.filter((t) => !nosModelos.includes(t))
    .concat(nosModelos.filter((t) => !noCatalogo.includes(t)));

  if (diferenca.length) {
    throw new Error(`CATALOGO e MODELOS divergem em: ${diferenca.join(', ')}`);
  }
})();

/**
 * Conjuntos que a equipe pede junto no dia a dia. São atalho, não regra: a
 * tela deixa marcar qualquer combinação. Só podem citar tipos do CATALOGO.
 */
const OPERACOES = {
  compra_venda: {
    nome: 'Compra e Venda',
    tipos: [
      'Contrato de Promessa de Compra e Venda',
      'Anexo ao Contrato de Promessa de Compra e Venda',
      'Termo de Anuência com Outorga de Poderes'
    ]
  },
  compra_venda_financiada: {
    nome: 'Compra e Venda com financiamento',
    tipos: [
      'Contrato de Promessa de Compra e Venda',
      'Anexo ao Contrato de Promessa de Compra e Venda',
      'Termo de Anuência com Outorga de Poderes',
      'Termo de Ciência e Anuência para Empréstimo'
    ]
  },
  scp: {
    nome: 'Adesão à SCP',
    tipos: ['Termo de Adesão Preliminar SCP']
  }
};

(() => {
  const conhecidos = CATALOGO.map((m) => m.tipo);
  Object.entries(OPERACOES).forEach(([chave, op]) => {
    const orfaos = op.tipos.filter((t) => !conhecidos.includes(t));
    if (orfaos.length) {
      throw new Error(`A operação "${chave}" cita tipo sem modelo: ${orfaos.join(', ')}`);
    }
  });
})();

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

function juntar(...partes) {
  return partes.filter((p) => p && String(p).trim()).join(', ');
}

// O formulário aceita "733.000,00" ou "R$ 733.000,00"; o contrato precisa
// sempre do prefixo.
function comReal(valor) {
  const texto = String(valor ?? '').trim();
  if (!texto) return '';
  return /^r\$/i.test(texto) ? texto : `R$ ${texto}`;
}

/**
 * A tabela "CONDIÇÕES E PRAZOS" do SCP tem cinco linhas fixas, mas o
 * formulário coleta parcelas em cinco espaços genéricos, cada uma com o tipo
 * escrito à mão ("Sinal", "Mensais", "Balão"...). Casamos uma coisa na outra
 * pelo que a pessoa escreveu.
 *
 * Linha sem parcela correspondente fica em branco — e o aviso de campo em
 * branco denuncia, que é melhor do que inventar número em contrato.
 */
const LINHAS_SCP = [
  { chave: 'ENTRADA', reconhece: /entrada|sinal/i },
  { chave: 'MENSAL', reconhece: /mensal|mensais/i },
  { chave: 'INTERMEDIARIA', reconhece: /intermedi/i },
  { chave: 'ANUAL', reconhece: /anual|anuais|bal[ãa]o/i },
  { chave: 'CHAVE', reconhece: /chave/i }
];

/** "1.234,56" e "R$ 1.234,56" viram 1234.56. Devolve null se não der. */
function numeroDeTexto(texto) {
  const limpo = String(texto ?? '').replace(/[^\d,.-]/g, '').trim();
  if (!limpo) return null;
  const n = Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
  return Number.isFinite(n) ? n : null;
}

function emReal(numero) {
  return `R$ ${numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function valoresDaTabelaScp(compraVenda) {
  const parcelas = (compraVenda && compraVenda.parcelas) || [];
  const valores = {};

  LINHAS_SCP.forEach(({ chave, reconhece }) => {
    const parcela = parcelas.find((p) => reconhece.test(String(p.tipo || '')));

    if (!parcela) {
      valores[`SCP_${chave}_QNTD`] = '';
      valores[`SCP_${chave}_VALOR`] = '';
      valores[`SCP_${chave}_TOTAL`] = '';
      return;
    }

    const unitario = numeroDeTexto(parcela.valorUnitario);
    const quantidade = parseInt(String(parcela.quantidade || '1').replace(/\D/g, ''), 10) || 1;

    valores[`SCP_${chave}_QNTD`] = String(quantidade);
    valores[`SCP_${chave}_VALOR`] = unitario === null ? '' : emReal(unitario);
    valores[`SCP_${chave}_TOTAL`] = unitario === null ? '' : emReal(unitario * quantidade);
  });

  return valores;
}

/**
 * A tabela "CONDIÇÕES E PRAZOS" do Termo de Quitação, montada a partir dos
 * lançamentos do financeiro daquele contrato.
 *
 * É o primeiro documento que LÊ o financeiro em vez de alimentá-lo: a partir
 * daqui, confirmar um recebimento no sistema deixa de ser controle interno e
 * passa a ter efeito num documento assinado.
 *
 * A tabela de pagamentos é a SEGUNDA do modelo — a primeira é o cabeçalho.
 */
const TABELA_PAGAMENTOS_QUITACAO = 1;

function montarTabelaQuitacao(xml, lancamentos) {
  const tabelas = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
  const tabela = tabelas[TABELA_PAGAMENTOS_QUITACAO];
  if (!tabela) return xml;

  const linhas = docx.extrairLinhas(tabela);
  if (linhas.length < 3) return xml;

  const moldeCabecalho = linhas[0];
  const moldeLinha = linhas[1];
  const moldeTotal = linhas[linhas.length - 1];

  // "1ª Entrada", "2ª Parcela Mensal" — a ordem é por categoria, como o
  // documento original escrevia à mão.
  const contagem = {};
  const novas = [moldeCabecalho];

  lancamentos.forEach((l) => {
    const categoria = l.categoria || 'Parcela';
    contagem[categoria] = (contagem[categoria] || 0) + 1;
    const quitado = l.status === 'recebido';

    novas.push(docx.definirTextosLinha(moldeLinha, [
      `${contagem[categoria]}ª ${categoria}`,
      formatarData(parsearData(l.data)) || l.data || '',
      comReal(formatarMoeda(l.valor)),
      quitado ? (formatarData(parsearData(l.dataRecebimento)) || l.dataRecebimento || '') : '',
      quitado ? 'QUITADO' : 'EM ABERTO'
    ]));
  });

  // A linha de total já virou placeholder na conversão do modelo.
  novas.push(moldeTotal);

  return docx.substituirLinhasDaTabela(xml, TABELA_PAGAMENTOS_QUITACAO, novas);
}

function formatarMoeda(numero) {
  const n = Number(numero);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "Parcelado" / "À vista" -> como a frase do contrato pede: "de forma ..."
function textoFormaAquisicao(forma) {
  const texto = String(forma ?? '').trim().toLowerCase();
  if (!texto) return 'parcelada';
  return texto.includes('vista') ? 'à vista' : 'parcelada';
}

// Aceita dd/mm/aaaa e aaaa-mm-dd, que são os dois formatos que o Google Forms
// devolve dependendo de como a pergunta foi configurada.
function parsearData(valor) {
  const texto = String(valor || '').trim();

  let m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  return null;
}

function formatarData(data) {
  if (!data) return '';
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${data.getFullYear()}`;
}

function adicionarMeses(data, meses) {
  const nova = new Date(data.getTime());
  const diaOriginal = nova.getDate();
  nova.setMonth(nova.getMonth() + meses);
  // Evita 31/01 + 1 mês virar 03/03 em fevereiro
  if (nova.getDate() < diaOriginal) nova.setDate(0);
  return nova;
}

function montarValores(documento, empreendimento, extras = {}) {
  const geral = documento.dadosGerais || {};
  const comprador = documento.comprador || {};
  const conjuge = documento.conjuge || {};
  const testemunhas = documento.testemunhas || [];
  const compraVenda = documento.compraVenda || {};
  const unidade = compraVenda.unidade || {};
  const anexo = documento.anexo || {};
  const scp = documento.scp || {};
  const emp = empreendimento || {};
  // Termo de Quitação e Distrato nascem no fim da operação, com dados que o
  // sistema já tem — não vêm do formulário.
  const encerramento = documento.encerramento || {};

  const data = parsearData(geral.dataDocumento) || parsearData(geral.dataHora);

  return {
    COMPRADOR_NOME: comprador.nome,
    COMPRADOR_CPF: comprador.cpf,
    COMPRADOR_NACIONALIDADE: comprador.nacionalidade,
    COMPRADOR_ESTADO_CIVIL: comprador.estadoCivil,
    COMPRADOR_PROFISSAO: comprador.profissao,
    COMPRADOR_RG: comprador.rg,
    COMPRADOR_ORGAO_EMISSOR: comprador.orgaoEmissorRg,
    COMPRADOR_ENDERECO: juntar(comprador.endereco, comprador.cep),
    COMPRADOR_TELEFONE: comprador.telefone,
    COMPRADOR_EMAIL: comprador.email,

    CONJUGE_NOME: conjuge.nome,
    CONJUGE_CPF: conjuge.cpf,
    CONJUGE_NACIONALIDADE: conjuge.nacionalidade,
    CONJUGE_PROFISSAO: conjuge.profissao,
    CONJUGE_RG: conjuge.rg,
    CONJUGE_ORGAO_EMISSOR: conjuge.orgaoEmissorRg,
    // No Distrato o cônjuge assina como parte, não como anuente — por isso
    // precisa de estado civil e e-mail próprios.
    CONJUGE_ESTADO_CIVIL: conjuge.estadoCivil,
    CONJUGE_EMAIL: conjuge.email,

    EMPREENDIMENTO_NOME: emp.nome,
    EMPREENDIMENTO_RAZAO_SOCIAL: emp.razaoSocial || scp.razaoSocial,
    EMPREENDIMENTO_CNPJ: emp.cnpj || scp.cnpj,
    EMPREENDIMENTO_ENDERECO: emp.endereco,
    EMPREENDIMENTO_CEP: emp.cep,
    EMPREENDIMENTO_SOCIO_ADMIN: emp.socioAdmin,
    EMPREENDIMENTO_EMAIL: emp.email,
    EMPREENDIMENTO_NOME_FANTASIA: emp.nomeFantasia || emp.nome,
    EMPREENDIMENTO_TELEFONE: emp.telefone,
    EMPREENDIMENTO_SITE: emp.site,

    // Conta vinculada ao empreendimento, citada no Distrato
    EMPREENDIMENTO_BANCO: emp.banco,
    EMPREENDIMENTO_AGENCIA: emp.agencia,
    EMPREENDIMENTO_CONTA: emp.conta,
    EMPREENDIMENTO_PIX: emp.pix,

    // Qualificação de quem assina pela SPE
    SOCIO_ADMIN_CPF: emp.socioAdminCpf,
    SOCIO_ADMIN_RG: emp.socioAdminRg,
    SOCIO_ADMIN_ENDERECO: emp.socioAdminEndereco,

    UNIDADE_NUMERO_EXTENSO: unidade.numeroExtenso || anexo.numeroUnidadeExtenso,
    UNIDADE_VAGAS: unidade.vagasGaragem,
    UNIDADE_NUMEROS_VAGAS: unidade.numerosVagas,
    UNIDADE_AREA_PRIVATIVA: unidade.areaPrivativa,
    UNIDADE_AREA_CONSTRUCAO: unidade.areaConstrucao,
    UNIDADE_FRACAO_IDEAL: unidade.fracaoIdeal,
    UNIDADE_DESCRICAO_PLANTA: unidade.descricaoPlanta,

    PRECO_TOTAL: comReal(compraVenda.precoTotal),
    PRECO_TOTAL_EXTENSO: compraVenda.precoExtenso,
    FORMA_AQUISICAO: textoFormaAquisicao(compraVenda.formaAquisicao),

    // As cláusulas 1.4 e 3.2 abrem o preço total em duas parcelas: o que se
    // paga pela fração ideal do terreno e o que se paga pela construção. São
    // valores distintos do total, então vêm do formulário, não daqui.
    VALOR_FRACAO_IDEAL: comReal(compraVenda.valorFracaoIdeal),
    VALOR_FRACAO_IDEAL_EXTENSO: compraVenda.valorFracaoIdealExtenso,
    VALOR_CUSTO_CONSTRUCAO: comReal(compraVenda.valorCustoConstrucao),
    VALOR_CUSTO_CONSTRUCAO_EXTENSO: compraVenda.valorCustoConstrucaoExtenso,

    // Nem todo tipo de documento traz bloco de unidade (o Termo de Anuência,
    // por exemplo), mas o número sempre chega junto do payload.
    UNIDADE_NUMERO: unidade.numero || anexo.numeroUnidade || scp.numeroUnidades || extras.unidadeNumero,
    UNIDADE_TIPO: unidade.tipo || anexo.tipoUnidade || extras.unidadeTipo,

    // Encerramento da operação: quitação ou distrato
    UNIDADE_ANDAR: encerramento.unidadeAndar,
    QUITACAO_TOTAL: encerramento.total,
    QUITACAO_TOTAL_EXTENSO: encerramento.totalExtenso,
    QUITACAO_SALDO: encerramento.saldo,
    QUITACAO_DATA: encerramento.dataQuitacao,
    DISTRATO_VALOR: encerramento.valorDevolvido,
    DISTRATO_VALOR_EXTENSO: encerramento.valorDevolvidoExtenso,

    DOC_CIDADE_UF: geral.cidadeUf,
    DOC_DATA: formatarData(data),
    DOC_DIA: data ? String(data.getDate()).padStart(2, '0') : '',
    DOC_MES: data ? MESES[data.getMonth()] : '',
    DOC_ANO: data ? String(data.getFullYear()) : '',

    DATA_COMPROMISSO_COMPRA_VENDA: formatarData(parsearData(geral.dataDocumento)),
    SCP_VALOR_ENTRADA: scp.valorEntrada,

    // Tabela "CONDIÇÕES E PRAZOS" do SCP, montada a partir das parcelas.
    ...valoresDaTabelaScp(compraVenda),

    TESTEMUNHA_1_NOME: testemunhas[0] ? testemunhas[0].nome : '',
    TESTEMUNHA_1_CPF: testemunhas[0] ? testemunhas[0].cpf : '',
    TESTEMUNHA_2_NOME: testemunhas[1] ? testemunhas[1].nome : '',
    TESTEMUNHA_2_CPF: testemunhas[1] ? testemunhas[1].cpf : ''
  };
}

// ---------- Tabela de parcelas ----------

function textoReajuste(parcela) {
  const reajustavel = String(parcela.reajustavel || '').trim().toLowerCase();
  if (!reajustavel.startsWith('s')) return 'Não';
  return parcela.indice ? `Sim – ${parcela.indice}` : 'Sim';
}

/**
 * Reconstrói a tabela de parcelas a partir das respostas do formulário.
 *
 * O modelo traz três formatos de linha, que são reaproveitados como molde:
 *  - linha 1: parcela única (uma data só)
 *  - linhas 2+3: parcela repetida (célula mesclada com "De ..." / "Até ...")
 *  - última linha: total
 */
function montarTabelaParcelas(xml, compraVenda) {
  const parcelas = (compraVenda.parcelas || []).filter((p) => p.tipo);

  // Compra à vista não tem parcelas, mas a tabela do modelo precisa ser
  // substituída mesmo assim — senão o contrato sai com o exemplo do modelo.
  const aVista = compraVenda.aVista || (!parcelas.length && compraVenda.precoTotal);

  if (!parcelas.length && !aVista) return xml;

  const tabela = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
  if (!tabela) return xml;

  const linhas = docx.extrairLinhas(tabela[0]);
  if (linhas.length < 11) return xml;

  const moldeCabecalho = linhas[0];
  const moldeSimples = linhas[1];
  const moldeIntervaloInicio = linhas[2];
  const moldeIntervaloFim = linhas[3];
  const moldeTotal = linhas[linhas.length - 1];

  const novas = [moldeCabecalho];

  if (!parcelas.length) {
    novas.push(docx.definirTextosLinha(moldeSimples, [
      'À vista',
      compraVenda.dataPagamento || '',
      compraVenda.precoTotal || '',
      '01',
      '100%',
      'Não',
      compraVenda.formaPagamentoAVista || ''
    ]));
    novas.push(docx.definirTextosLinha(moldeTotal, [
      'Total', null, compraVenda.precoTotal || '', null, '100%', null, null
    ]));
    return docx.substituirLinhasDaPrimeiraTabela(xml, novas);
  }

  parcelas.forEach((parcela) => {
    const quantidade = parseInt(String(parcela.quantidade || '1').replace(/\D/g, ''), 10) || 1;
    const inicio = parsearData(parcela.vencimentoInicial);
    const colunas = [
      parcela.tipo,
      null, // data: tratada abaixo
      parcela.valorUnitario,
      String(parcela.quantidade || quantidade).padStart(2, '0'),
      parcela.percentual,
      textoReajuste(parcela),
      parcela.formaPagamento
    ];

    if (quantidade > 1 && inicio) {
      const fim = adicionarMeses(inicio, quantidade - 1);
      colunas[1] = `De ${formatarData(inicio)}`;
      novas.push(docx.definirTextosLinha(moldeIntervaloInicio, colunas));
      // Na linha de continuação só a coluna de data tem conteúdo próprio
      novas.push(docx.definirTextosLinha(moldeIntervaloFim, [null, `Até ${formatarData(fim)}`]));
    } else {
      colunas[1] = inicio ? formatarData(inicio) : (parcela.vencimentoInicial || '');
      novas.push(docx.definirTextosLinha(moldeSimples, colunas));
    }
  });

  novas.push(docx.definirTextosLinha(moldeTotal, [
    'Total', null, compraVenda.precoTotal || '', null, '100%', null, null
  ]));

  return docx.substituirLinhasDaPrimeiraTabela(xml, novas);
}

// ---------- Geração ----------

function nomeArquivo(tipo, comprador, extensao) {
  const base = `${tipo} - ${comprador || 'sem-nome'}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${base}-${Date.now()}.${extensao}`;
}

function converterParaPdf(caminhoDocx) {
  return new Promise((resolve, reject) => {
    const soffice = process.env.LIBREOFFICE_PATH || 'soffice';
    const perfil = `-env:UserInstallation=file:///${path.join(require('os').tmpdir(), 'lo_contratos').replace(/\\/g, '/')}`;

    execFile(
      soffice,
      [perfil, '--headless', '--convert-to', 'pdf', '--outdir', path.dirname(caminhoDocx), caminhoDocx],
      { timeout: 120000 },
      (erro) => {
        if (erro) return reject(erro);
        resolve(caminhoDocx.replace(/\.docx$/, '.pdf'));
      }
    );
  });
}

/**
 * Gera o documento a partir do payload do formulário.
 * Devolve { caminhoAbsoluto, caminhoPublico, nome, placeholdersSemValor }.
 */
// Alguns blocos do documento são condicionais: sem cônjuge, os campos dele
// saem vazios de propósito. Avisar sobre eles afogaria o buraco de verdade.
const BLOCOS_CONDICIONAIS = [
  { prefixo: 'CONJUGE_', presente: (d) => Boolean(d.conjuge && d.conjuge.nome) },
  { prefixo: 'TESTEMUNHA_1_', presente: (d) => Boolean((d.testemunhas || [])[0]) },
  { prefixo: 'TESTEMUNHA_2_', presente: (d) => Boolean((d.testemunhas || [])[1]) }
];

/**
 * Empresa não tem nacionalidade, estado civil, profissão nem RG — quem tem
 * é o representante legal, que ocupa um bloco à parte do documento. Cobrar
 * esses campos num contrato de pessoa jurídica é alarme falso, e alarme
 * falso ensina a ignorar o aviso.
 */
const CAMPOS_SO_DE_PESSOA_FISICA = [
  'COMPRADOR_NACIONALIDADE', 'COMPRADOR_ESTADO_CIVIL', 'COMPRADOR_PROFISSAO',
  'COMPRADOR_RG', 'COMPRADOR_ORGAO_EMISSOR'
];

/** O formulário só monta `representante` quando o contratante é PJ. */
function ehPessoaJuridica(documento) {
  return Boolean(documento && documento.representante && documento.representante.nome);
}

/**
 * Separa o que ficou em branco em duas listas: o que falta mesmo e o que
 * não se aplica a este documento.
 *
 * Só entram campos que ESTE modelo usa — o `valores` traz os 45 possíveis,
 * mas cada modelo usa uma fatia. Cobrar o valor da SCP num Anexo é ruído.
 */
function conferirPreenchimento(valores, xml, documento) {
  const noModelo = new Set(docx.listarPlaceholders(xml).map((p) => p.slice(1, -1)));

  const vazios = Object.entries(valores)
    .filter(([chave, v]) => noModelo.has(chave) && (v === undefined || v === null || String(v).trim() === ''))
    .map(([chave]) => chave);

  const ausentes = BLOCOS_CONDICIONAIS
    .filter((b) => !b.presente(documento))
    .map((b) => b.prefixo);

  const pj = ehPessoaJuridica(documento);

  const condicional = (chave) =>
    ausentes.some((prefixo) => chave.startsWith(prefixo))
    || (pj && CAMPOS_SO_DE_PESSOA_FISICA.includes(chave));

  return {
    faltando: vazios.filter((c) => !condicional(c)),
    naoSeAplica: vazios.filter(condicional)
  };
}

async function gerarDocumento({ documento, empreendimento, empreendimentoId, unidadeNumero, unidadeTipo }) {
  const tipo = documento.tipo;
  const modelo = MODELOS[tipo];

  if (!modelo) {
    throw new Error(`Não existe modelo cadastrado para o tipo "${tipo}"`);
  }

  const caminhoModelo = path.join(TEMPLATES_DIR, modelo);
  if (!fs.existsSync(caminhoModelo)) {
    throw new Error(`Modelo não encontrado no disco: ${modelo}`);
  }

  const { zip, xml } = docx.lerDocumentoXml(caminhoModelo);
  const valores = montarValores(documento, empreendimento, { unidadeNumero, unidadeTipo });

  let novoXml = xml;
  // A quitação tem tabela própria, vinda do financeiro. Sempre reconstruída:
  // deixar as linhas do modelo passaria o exemplo real para o cliente.
  if (tipo === 'Termo de Quitação de Obrigações') {
    novoXml = montarTabelaQuitacao(novoXml, (documento.encerramento || {}).lancamentos || []);
  } else if (documento.compraVenda) {
    novoXml = montarTabelaParcelas(novoXml, documento.compraVenda);
  }
  novoXml = docx.substituirPlaceholders(novoXml, valores);

  const pasta = path.join(STORAGE_DIR, empreendimentoId || 'sem-empreendimento', 'contratos');
  fs.mkdirSync(pasta, { recursive: true });

  const nome = nomeArquivo(tipo, (documento.comprador || {}).nome, 'docx');
  const caminhoAbsoluto = path.join(pasta, nome);
  docx.gravarDocumentoXml(zip, novoXml, caminhoAbsoluto);

  let caminhoFinal = caminhoAbsoluto;
  let nomeFinal = nome;

  if (String(process.env.GERAR_PDF).toLowerCase() === 'true') {
    caminhoFinal = await converterParaPdf(caminhoAbsoluto);
    nomeFinal = path.basename(caminhoFinal);
  }

  const relativo = path
    .relative(caminhos.STORAGE, caminhoFinal)
    .replace(/\\/g, '/');

  const { faltando, naoSeAplica } = conferirPreenchimento(valores, xml, documento);

  return {
    caminhoAbsoluto: caminhoFinal,
    caminhoPublico: `/storage/${relativo}`,
    nome: nomeFinal,
    placeholdersSemValor: faltando,
    placeholdersNaoAplicaveis: naoSeAplica
  };
}

module.exports = {
  gerarDocumento, MODELOS, CATALOGO, OPERACOES, montarValores, conferirPreenchimento,
  parsearData, formatarData, adicionarMeses
};
