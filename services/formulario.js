const db = require('../database');
const emissao = require('./emissao');
const exclusao = require('./exclusao');
const unidadesSvc = require('./unidades');
const formato = require('./formato');
const v = require('./validacao');
const { reaisPorExtenso, inteiroPorExtenso } = require('./extenso');

/**
 * Formulário interno de contrato.
 *
 * Substitui o formulário do Google. A ideia é uma só: o sistema já sabe quem é
 * o cliente, qual é a unidade e o que o empreendimento diz de si — então o
 * formulário só pergunta o que é da NEGOCIAÇÃO (preço, parcelas, datas) e
 * confere o que vem do cadastro.
 *
 * É por OPERAÇÃO (cliente + unidade), não por documento: as seções que
 * aparecem dependem de quais documentos a operação tem para gerar, do mesmo
 * jeito que o formulário do Google ramificava pelo tipo escolhido.
 */

// ------------------------------------------------------------------ catálogo
// O que cada documento pede além do que vem do cadastro. Quem escreve esta
// tabela é quem leu os placeholders de cada modelo — ver templates/README.md.
const DOCS = {
  'Contrato de Promessa de Compra e Venda': {
    chave: 'cv', conjuge: true, qualificacao: 'completa', unidade: 'completa', preco: true, testemunhas: true
  },
  'Anexo ao Contrato de Promessa de Compra e Venda': {
    chave: 'anexo', conjuge: true, qualificacao: 'completa', unidade: 'numero'
  },
  'Termo de Anuência com Outorga de Poderes': {
    chave: 'anuencia', conjuge: true, qualificacao: 'completa', unidade: 'numero'
  },
  'Termo de Ciência e Anuência para Empréstimo': {
    chave: 'emprestimo', conjuge: true, qualificacao: 'completa', unidade: 'numero', emprestimo: true
  },
  'Termo de Adesão Preliminar SCP': {
    chave: 'scp', conjuge: false, qualificacao: 'simples', unidade: 'numero', scp: true
  }
};

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável', 'Outro'];
const FORMAS_PAGAMENTO = ['Dinheiro', 'Transferência/PIX', 'Financiamento', 'Apartamento', 'Permuta', 'Outro'];
const INDICES = ['INCC', 'IGP-M', 'IPCA', 'Outro'];
const TIPOS_PARCELA_SUGERIDOS = ['Sinal', 'Entrada', 'Mensais', 'Intermediárias', 'Anuais', 'Balão', 'Chaves', 'Financiamento'];
// A tabela do SCP tem cinco linhas fixas; aqui o tipo é escolhido, não digitado,
// para a parcela cair na linha certa em vez de depender de um regex no texto.
const TIPOS_PARCELA_SCP = ['Entrada', 'Mensal', 'Intermediária', 'Anual', 'Chaves'];

const CAMPOS_COMPRADOR = ['nome', 'cpfCnpj', 'nacionalidade', 'estadoCivil', 'profissao', 'rg',
  'orgaoEmissorRg', 'endereco', 'cep', 'telefone', 'email'];
const CAMPOS_CONJUGE = ['conjugeNome', 'conjugeCpf', 'conjugeRg', 'conjugeOrgaoEmissorRg',
  'conjugeNacionalidade', 'conjugeProfissao', 'conjugeEstadoCivil', 'conjugeEmail'];
const CAMPOS_NEGOCIACAO = ['precoTotal', 'valorFracaoIdeal', 'valorCustoConstrucao', 'formaAquisicao',
  'dataPagamentoAVista', 'formaPagamentoAVista', 'testemunha1Nome', 'testemunha1Cpf',
  'testemunha2Nome', 'testemunha2Cpf', 'dataCompromisso', 'valorAporte'];

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function tipoDoContrato(nome) {
  return String(nome || '').split(' - ')[0].trim();
}

/** Quais seções o formulário precisa, somando os documentos escolhidos. */
function exigencias(tipos) {
  const e = { conjuge: false, qualificacao: null, unidade: null, preco: false, testemunhas: false,
    emprestimo: false, scp: false, chaves: [] };

  tipos.forEach((t) => {
    const d = DOCS[t];
    if (!d) return;
    e.chaves.push(d.chave);
    e.conjuge = e.conjuge || d.conjuge;
    e.preco = e.preco || Boolean(d.preco);
    e.testemunhas = e.testemunhas || Boolean(d.testemunhas);
    e.emprestimo = e.emprestimo || Boolean(d.emprestimo);
    e.scp = e.scp || Boolean(d.scp);
    if (d.qualificacao === 'completa' || (d.qualificacao === 'simples' && !e.qualificacao)) {
      e.qualificacao = d.qualificacao;
    }
    if (d.unidade === 'completa' || (d.unidade === 'numero' && !e.unidade)) e.unidade = d.unidade;
  });

  return e;
}

// ------------------------------------------------------------------ contexto
function contexto(clienteId, unidadeId) {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(parseInt(clienteId));
  if (!cliente) throw new Error('Cliente não encontrado.');

  const uid = unidadeId && unidadeId !== 'sem-unidade' ? parseInt(unidadeId) : null;
  const unidade = uid ? db.prepare('SELECT * FROM unidades WHERE id = ?').get(uid) : null;
  const empreendimentoId = (unidade && unidade.empreendimentoId) || cliente.empreendimentoId || null;
  const empreendimento = empreendimentoId
    ? db.prepare('SELECT * FROM empreendimentos WHERE id = ?').get(empreendimentoId)
    : null;

  const condicao = uid ? 'clienteId = ? AND unidadeId = ?' : 'clienteId = ? AND unidadeId IS NULL';
  const params = uid ? [cliente.id, uid] : [cliente.id];

  const contratos = db.prepare(
    `SELECT id, nome, categoria, status FROM contratos WHERE ${condicao} ORDER BY created_at, id`
  ).all(params)
    .map((c) => ({ ...c, tipo: tipoDoContrato(c.nome) }))
    .filter((c) => DOCS[c.tipo]);

  return { cliente, unidade, uid, empreendimento, empreendimentoId, contratos };
}

function ultimaEmissao(ctx) {
  const condicao = ctx.uid ? 'unidadeId = ?' : 'unidadeId IS NULL';
  const params = ctx.uid ? [ctx.cliente.id, ctx.uid] : [ctx.cliente.id];
  const linha = db.prepare(
    `SELECT dados FROM emissoes WHERE clienteId = ? AND ${condicao} ORDER BY id DESC LIMIT 1`
  ).get(params);
  if (!linha) return null;
  try { return JSON.parse(linha.dados); } catch (_) { return null; }
}

/** O que o formulário mostra ao abrir: cadastro, unidade e a última emissão. */
function valoresIniciais(ctx) {
  const c = ctx.cliente;
  const u = ctx.unidade || {};
  const ultima = ultimaEmissao(ctx) || {};

  const valores = {
    tipoPessoa: v.ehPessoaJuridica(c.cpfCnpj) ? 'pj' : 'pf',
    dataDocumento: hojeIso(),
    conjugeConsta: c.conjugeNome ? '1' : '',
    formaAquisicao: 'Parcelado',
    parcelas: []
  };

  CAMPOS_COMPRADOR.forEach((k) => { valores[k] = c[k] ?? ''; });
  CAMPOS_CONJUGE.forEach((k) => { valores[k] = c[k] ?? ''; });
  unidadesSvc.CARACTERISTICAS.forEach((k) => { valores[k] = u[k] ?? ''; });
  if (!valores.tipoImovel) valores.tipoImovel = 'apartamento';

  // O que é da negociação não está no cadastro: reaproveita o que foi
  // digitado da última vez, para corrigir um valor sem redigitar a venda.
  CAMPOS_NEGOCIACAO.forEach((k) => { if (ultima[k] != null) valores[k] = ultima[k]; });
  if (Array.isArray(ultima.parcelas)) valores.parcelas = ultima.parcelas;

  return valores;
}

// ----------------------------------------------------------------- interpretar
function texto(body, k) {
  return String(body[k] ?? '').trim();
}

function lista(body, k) {
  return [].concat(body[k] ?? []).map((x) => String(x ?? '').trim());
}

/** Os campos de parcela chegam como listas paralelas; vira uma lista de linhas. */
function lerParcelasDoEnvio(body) {
  const colunas = {
    tipo: lista(body, 'parcelaTipo'), valor: lista(body, 'parcelaValor'), qtd: lista(body, 'parcelaQtd'),
    vencimento: lista(body, 'parcelaVencimento'), reajustavel: lista(body, 'parcelaReajustavel'),
    indice: lista(body, 'parcelaIndice'), forma: lista(body, 'parcelaForma')
  };
  const n = Math.max(...Object.values(colunas).map((c) => c.length), 0);
  const linhas = [];

  for (let i = 0; i < n; i++) {
    const linha = {};
    Object.keys(colunas).forEach((k) => { linha[k] = colunas[k][i] ?? ''; });
    // Linha que alguém adicionou e deixou toda em branco não é parcela.
    if (Object.values(linha).some((x) => x !== '' && x !== 'Não')) linhas.push(linha);
  }
  return linhas;
}

function interpretar(body, ctx) {
  const valores = { tipoPessoa: texto(body, 'tipoPessoa') === 'pj' ? 'pj' : 'pf' };
  const erros = {};
  const geral = [];
  const avisos = [];

  [...CAMPOS_COMPRADOR, ...CAMPOS_CONJUGE, ...unidadesSvc.CARACTERISTICAS, ...CAMPOS_NEGOCIACAO,
    'dataDocumento', 'conjugeConsta'].forEach((k) => { valores[k] = texto(body, k); });
  valores.parcelas = lerParcelasDoEnvio(body);

  // --- o que se vai gerar
  const escolhidos = lista(body, 'contratoIds').filter(Boolean);
  const selecionados = ctx.contratos.filter((c) => escolhidos.includes(String(c.id)));
  if (!selecionados.length) geral.push('Marque ao menos um documento para gerar.');
  if (!ctx.unidade) geral.push('Esta operação não tem unidade, e os documentos precisam do número dela.');
  if (!ctx.empreendimento) geral.push('A operação não tem empreendimento, e o documento precisa dos dados da vendedora.');

  const exig = exigencias(selecionados.map((c) => c.tipo));
  const pj = valores.tipoPessoa === 'pj';

  const obrigatorio = (campo, rotulo) => { if (!valores[campo]) erros[campo] = `Informe ${rotulo}.`; };

  // --- documento
  if (!v.dataIso(valores.dataDocumento)) erros.dataDocumento = 'Informe a data do documento.';
  else valores.dataDocumento = v.dataIso(valores.dataDocumento);

  // --- comprador
  obrigatorio('nome', pj ? 'a razão social' : 'o nome do comprador');
  obrigatorio('cpfCnpj', pj ? 'o CNPJ' : 'o CPF');
  obrigatorio('endereco', 'o endereço');

  if (valores.cpfCnpj) {
    if (!v.documentoValido(valores.cpfCnpj)) {
      avisos.push(`${pj ? 'O CNPJ' : 'O CPF'} do comprador (${valores.cpfCnpj}) parece inválido — confira os dígitos.`);
    }
    const digitos = formato.somenteDigitos(valores.cpfCnpj);
    const conflito = db.prepare(`
      SELECT nome FROM clientes
      WHERE REPLACE(REPLACE(REPLACE(cpfCnpj, '.', ''), '-', ''), '/', '') = ? AND id <> ?
    `).get([digitos, ctx.cliente.id]);
    if (conflito) erros.cpfCnpj = `Outro cliente já usa este documento: ${conflito.nome}.`;
  }

  if (!pj && exig.qualificacao === 'completa') {
    obrigatorio('nacionalidade', 'a nacionalidade');
    obrigatorio('estadoCivil', 'o estado civil');
    obrigatorio('profissao', 'a profissão');
    obrigatorio('rg', 'o RG');
    obrigatorio('orgaoEmissorRg', 'o órgão emissor do RG');
  } else if (!pj && exig.qualificacao === 'simples') {
    obrigatorio('profissao', 'a profissão');
    obrigatorio('rg', 'o RG');
  }
  if (valores.cep && !v.cepValido(valores.cep)) avisos.push(`O CEP do comprador (${valores.cep}) não tem 8 dígitos.`);

  // --- cônjuge
  if (!pj && exig.conjuge && valores.conjugeConsta) {
    obrigatorio('conjugeNome', 'o nome do cônjuge');
    obrigatorio('conjugeCpf', 'o CPF do cônjuge');
    if (valores.conjugeCpf && !v.cpfValido(valores.conjugeCpf)) {
      avisos.push(`O CPF do cônjuge (${valores.conjugeCpf}) parece inválido — confira os dígitos.`);
    }
  }

  // --- unidade
  if (exig.unidade === 'completa') {
    obrigatorio('tipoImovel', 'o tipo do imóvel');
    obrigatorio('vagasGaragem', 'a quantidade de vagas de garagem');
    obrigatorio('areaPrivativa', 'a área privativa');
    obrigatorio('areaConstrucao', 'a área de construção');
    obrigatorio('fracaoIdeal', 'a fração ideal');
  }

  // --- preço e parcelas (compra e venda) ou aporte e parcelas (SCP)
  const parcelas = [];
  const usaParcelas = exig.preco || exig.scp;
  let preco = null;
  let aporte = null;

  if (exig.preco) {
    preco = v.dinheiro(valores.precoTotal);
    if (!(preco > 0)) erros.precoTotal = 'Informe o preço total do imóvel.';

    const fracao = v.dinheiro(valores.valorFracaoIdeal);
    const custo = v.dinheiro(valores.valorCustoConstrucao);
    if (!(fracao > 0)) erros.valorFracaoIdeal = 'Informe o valor da fração ideal do terreno.';
    if (!(custo > 0)) erros.valorCustoConstrucao = 'Informe o custo de construção.';
    if (fracao > 0 && custo > 0 && preco > 0 && Math.abs(fracao + custo - preco) > 0.01) {
      avisos.push(`Fração ideal (${v.emReais(fracao)}) + custo de construção (${v.emReais(custo)}) somam `
        + `${v.emReais(fracao + custo)}, e o preço total é ${v.emReais(preco)}.`);
    }

    if (!['Parcelado', 'À vista'].includes(valores.formaAquisicao)) erros.formaAquisicao = 'Escolha a forma de aquisição.';
  }

  if (exig.scp) {
    aporte = v.dinheiro(valores.valorAporte);
    if (!(aporte > 0)) erros.valorAporte = 'Informe o valor do aporte.';
  }

  const precisaParcelas = usaParcelas && !(exig.preco && valores.formaAquisicao === 'À vista');
  if (precisaParcelas) {
    if (!valores.parcelas.length) geral.push('Informe ao menos uma parcela.');

    valores.parcelas.forEach((p, i) => {
      const n = i + 1;
      const valor = v.dinheiro(p.valor);
      const qtd = parseInt(p.qtd, 10);
      const venc = v.dataIso(p.vencimento);
      const permitidos = exig.scp && !exig.preco ? TIPOS_PARCELA_SCP : null;

      if (!p.tipo) erros[`parcela_${i}`] = `Parcela ${n}: informe o tipo.`;
      else if (permitidos && !permitidos.includes(p.tipo)) erros[`parcela_${i}`] = `Parcela ${n}: escolha um dos tipos da lista.`;
      else if (!(valor > 0)) erros[`parcela_${i}`] = `Parcela ${n}: informe o valor de UMA parcela.`;
      else if (!(qtd >= 1)) erros[`parcela_${i}`] = `Parcela ${n}: informe a quantidade (1 ou mais).`;
      else if (!venc) erros[`parcela_${i}`] = `Parcela ${n}: informe a data do primeiro vencimento.`;
      else parcelas.push({ tipo: p.tipo, valor, qtd, venc, reajustavel: p.reajustavel === 'Sim' ? 'Sim' : 'Não',
        indice: p.indice, forma: p.forma });
    });

    const soma = parcelas.reduce((acc, p) => acc + p.valor * p.qtd, 0);
    const alvo = exig.preco ? preco : aporte;
    if (!Object.keys(erros).some((k) => k.startsWith('parcela_')) && alvo > 0 && parcelas.length
        && Math.abs(soma - alvo) > 0.01) {
      avisos.push(`As parcelas somam ${v.emReais(soma)}, e ${exig.preco ? 'o preço total' : 'o aporte'} é ${v.emReais(alvo)}.`);
    }
  }

  // --- testemunhas
  if (exig.testemunhas) {
    [['testemunha1Cpf', 1], ['testemunha2Cpf', 2]].forEach(([k, n]) => {
      if (valores[k] && !v.cpfValido(valores[k])) avisos.push(`O CPF da testemunha ${n} parece inválido.`);
    });
  }

  // --- empréstimo
  if (exig.emprestimo) {
    if (!v.dataIso(valores.dataCompromisso)) erros.dataCompromisso = 'Informe a data do compromisso de compra e venda.';
    else valores.dataCompromisso = v.dataIso(valores.dataCompromisso);
  }

  return { valores, erros, geral, avisos, selecionados, exig, parcelas, preco, aporte,
    ok: !Object.keys(erros).length && !geral.length };
}

// ---------------------------------------------------------------- montagem
function pct(parte, total) {
  if (!(total > 0)) return '';
  return `${((parte / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function dataBr(iso) {
  const [a, m, d] = String(iso).split('-');
  return `${d}/${m}/${a}`;
}

function blocoUnidade(ctx, val) {
  const numero = ctx.unidade.numero;
  const n = /^\d+$/.test(String(numero).trim()) ? parseInt(numero, 10) : null;
  return {
    tipo: val.tipoImovel || ctx.unidade.tipoImovel || '',
    numero,
    // O número por extenso era digitado; aqui se deduz dele, sem erro de digitação.
    numeroExtenso: n === null ? '' : inteiroPorExtenso(n),
    vagasGaragem: val.vagasGaragem, numerosVagas: val.numerosVagas,
    areaPrivativa: val.areaPrivativa, areaConstrucao: val.areaConstrucao,
    fracaoIdeal: val.fracaoIdeal, descricaoPlanta: val.descricaoPlanta
  };
}

function linhasDeParcela(parcelas, total) {
  return parcelas.map((p, i) => ({
    numero: i + 1,
    tipo: p.tipo,
    vencimentoInicial: dataBr(p.venc),
    valorUnitario: v.emReais(p.valor),
    quantidade: String(p.qtd),
    percentual: pct(p.valor * p.qtd, total),
    reajustavel: p.reajustavel,
    indice: p.indice,
    formaPagamento: p.forma
  }));
}

/** O mesmo objeto `documento` que o nó "Extrair Campos" do n8n montava. */
function montarDocumento(tipo, interp, ctx, usuario) {
  const val = interp.valores;
  const pj = val.tipoPessoa === 'pj';
  const unidade = blocoUnidade(ctx, val);

  const comprador = {
    nome: val.nome,
    cpf: formato.formatarCpfCnpj(val.cpfCnpj),
    nacionalidade: pj ? '' : val.nacionalidade,
    estadoCivil: pj ? '' : val.estadoCivil,
    profissao: pj ? '' : val.profissao,
    rg: pj ? '' : val.rg,
    orgaoEmissorRg: pj ? '' : val.orgaoEmissorRg,
    endereco: val.endereco, cep: val.cep, telefone: val.telefone, email: val.email
  };

  const conjuge = (!pj && interp.exig.conjuge && val.conjugeConsta) ? {
    nome: val.conjugeNome, cpf: val.conjugeCpf, rg: val.conjugeRg, orgaoEmissorRg: val.conjugeOrgaoEmissorRg,
    nacionalidade: val.conjugeNacionalidade, profissao: val.conjugeProfissao,
    estadoCivil: val.conjugeEstadoCivil, email: val.conjugeEmail
  } : null;

  const testemunhas = [1, 2]
    .map((n) => ({ nome: val[`testemunha${n}Nome`], cpf: val[`testemunha${n}Cpf`] }))
    .filter((t) => t.nome || t.cpf);

  const documento = {
    tipo,
    dadosGerais: { dataDocumento: val.dataDocumento, responsavel: usuario ? usuario.nome : '' },
    comprador, conjuge, testemunhas,
    // O número por extenso da unidade é lido daqui pelos termos que não têm bloco de compra e venda.
    anexo: { tipoUnidade: unidade.tipo, numeroUnidade: unidade.numero, numeroUnidadeExtenso: unidade.numeroExtenso }
  };

  const d = DOCS[tipo];

  if (d.preco) {
    const preco = interp.preco;
    const aVista = val.formaAquisicao === 'À vista';
    const fracao = v.dinheiro(val.valorFracaoIdeal);
    const custo = v.dinheiro(val.valorCustoConstrucao);

    documento.compraVenda = {
      unidade,
      precoTotal: v.emReais(preco), precoExtenso: reaisPorExtenso(preco),
      valorFracaoIdeal: v.emReais(fracao), valorFracaoIdealExtenso: reaisPorExtenso(fracao),
      valorCustoConstrucao: v.emReais(custo), valorCustoConstrucaoExtenso: reaisPorExtenso(custo),
      formaAquisicao: val.formaAquisicao, aVista,
      dataPagamento: aVista && v.dataIso(val.dataPagamentoAVista) ? dataBr(v.dataIso(val.dataPagamentoAVista)) : '',
      formaPagamentoAVista: aVista ? val.formaPagamentoAVista : '',
      parcelas: aVista ? [] : linhasDeParcela(interp.parcelas, preco)
    };
  }

  if (d.scp) {
    documento.scp = { valorEntrada: v.emReais(interp.aporte), numeroUnidades: unidade.numero };
    documento.compraVenda = { unidade, parcelas: linhasDeParcela(interp.parcelas, interp.aporte) };
  }

  if (d.emprestimo) documento.emprestimo = { dataCompromisso: val.dataCompromisso };

  return documento;
}

// ------------------------------------------------------------------ emissão
function salvarNoCadastro(ctx, interp) {
  const val = interp.valores;
  const campos = {
    nome: val.nome,
    cpfCnpj: formato.formatarCpfCnpj(val.cpfCnpj),
    telefone: val.telefone || null, email: val.email || null,
    nacionalidade: val.nacionalidade || null, estadoCivil: val.estadoCivil || null,
    profissao: val.profissao || null, rg: val.rg || null, orgaoEmissorRg: val.orgaoEmissorRg || null,
    endereco: val.endereco || null, cep: val.cep || null
  };

  // Cônjuge: o formulário é a fonte. Desmarcar "consta cônjuge" não apaga o
  // cadastro dele — só deixa de entrar neste documento.
  if (val.tipoPessoa === 'pf' && val.conjugeConsta) {
    CAMPOS_CONJUGE.forEach((k) => { campos[k] = val[k] || null; });
  }

  const colunas = Object.keys(campos);
  db.prepare(`UPDATE clientes SET ${colunas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run([...colunas.map((c) => campos[c]), ctx.cliente.id]);

  if (interp.exig.unidade === 'completa' && ctx.unidade) {
    const dados = {};
    unidadesSvc.CARACTERISTICAS.forEach((k) => { dados[k] = val[k]; });
    unidadesSvc.salvarCaracteristicas(ctx.unidade.id, dados);
  }
}

/**
 * Gera os documentos escolhidos. Toda validação já aconteceu antes de chamar:
 * daqui para a frente só se escreve.
 */
async function emitirOperacao(ctx, interp, usuario) {
  salvarNoCadastro(ctx, interp);

  const registro = db.prepare(
    'INSERT INTO emissoes (clienteId, unidadeId, usuarioId, dados) VALUES (?, ?, ?, ?)'
  ).run([ctx.cliente.id, ctx.uid, usuario ? usuario.id : null, JSON.stringify(interp.valores)]);
  const emissaoId = Number(registro.lastInsertRowid);

  // Se a operação já tem compra e venda, o SCP não duplica o cronograma
  // financeiro — são parcelas do mesmo dinheiro.
  const temCompraVenda = ctx.contratos.some((c) => DOCS[c.tipo].preco);

  const gerados = [];
  const falhas = [];

  for (const contrato of interp.selecionados) {
    try {
      // Gerar de novo: o arquivo anterior sai, para não acumular versões
      // soltas que ninguém sabe qual vale.
      db.prepare('SELECT id FROM documentos WHERE contratoId = ?').all(contrato.id)
        .forEach((d) => exclusao.excluirDocumento(d.id));

      const documento = montarDocumento(contrato.tipo, interp, ctx, usuario);
      const r = await emissao.emitir({
        documento, empreendimentoId: ctx.empreendimentoId, unidadeId: ctx.uid,
        unidadeNumero: ctx.unidade.numero, clienteId: ctx.cliente.id, contratoId: contrato.id,
        comRecebiveis: !(DOCS[contrato.tipo].scp && temCompraVenda)
      });
      gerados.push({ contratoId: contrato.id, tipo: contrato.tipo, arquivo: r.arquivo,
        camposSemValor: r.camposSemValor, recebiveis: r.recebiveis });
    } catch (e) {
      falhas.push({ contratoId: contrato.id, tipo: contrato.tipo, erro: e.message });
    }
  }

  const resultado = { gerados, falhas, avisos: interp.avisos };
  db.prepare('UPDATE emissoes SET resultado = ? WHERE id = ?').run([JSON.stringify(resultado), emissaoId]);

  return { emissaoId, ...resultado };
}

module.exports = {
  DOCS, ESTADOS_CIVIS, FORMAS_PAGAMENTO, INDICES, TIPOS_PARCELA_SUGERIDOS, TIPOS_PARCELA_SCP,
  tipoDoContrato, exigencias, contexto, valoresIniciais, interpretar, montarDocumento, emitirOperacao
};
