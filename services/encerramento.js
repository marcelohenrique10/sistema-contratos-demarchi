const db = require('../database');
const { gerarDocumento } = require('./documento');
const financeiro = require('./financeiro');
const { reaisPorExtenso, andarPorExtenso } = require('./extenso');

const QUITACAO = 'Termo de Quitação de Obrigações';
const DISTRATO = 'Cancelamento do Termo de Adesão Preliminar';

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function emReal(numero) {
  const n = Number(numero) || 0;
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function porExtensoData(iso) {
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.getDate();
  return `${dia === 1 ? '1º' : dia} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Reúne tudo que os documentos de encerramento precisam. Diferente do fluxo
 * do formulário, aqui nada é digitado: cliente, unidade e parcelas já estão
 * no sistema há meses.
 */
function reunirOperacao({ clienteId, unidadeId }) {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(parseInt(clienteId));
  if (!cliente) throw new Error('Cliente não encontrado.');

  const unidade = unidadeId
    ? db.prepare('SELECT * FROM unidades WHERE id = ?').get(parseInt(unidadeId))
    : null;

  const empreendimentoId = (unidade && unidade.empreendimentoId) || cliente.empreendimentoId;
  const empreendimento = empreendimentoId
    ? db.prepare('SELECT * FROM empreendimentos WHERE id = ?').get(empreendimentoId)
    : null;

  if (!empreendimento) {
    throw new Error('A operação não tem empreendimento, e o documento precisa dos dados da vendedora.');
  }

  const condicao = unidadeId
    ? 'clienteId = ? AND unidadeId = ?'
    : 'clienteId = ? AND unidadeId IS NULL';
  const parametros = unidadeId ? [parseInt(clienteId), parseInt(unidadeId)] : [parseInt(clienteId)];

  const lancamentos = db.prepare(
    `SELECT * FROM financeiro WHERE ${condicao} AND tipo = 'entrada' ORDER BY data, id`
  ).all(parametros).map(financeiro.enriquecer);

  return { cliente, unidade, empreendimento, empreendimentoId, lancamentos };
}

/**
 * O bloco do comprador, montado a partir do cadastro. O cliente guarda menos
 * do que o formulário coletava, então campos como RG e profissão podem vir
 * vazios — e o aviso de campo em branco é quem denuncia.
 */
function blocoComprador(cliente) {
  return {
    nome: cliente.nome,
    cpf: cliente.cpfCnpj,
    nacionalidade: cliente.nacionalidade,
    estadoCivil: cliente.estadoCivil,
    profissao: cliente.profissao,
    rg: cliente.rg,
    orgaoEmissorRg: cliente.orgaoEmissorRg,
    endereco: cliente.endereco,
    telefone: cliente.telefone,
    email: cliente.email
  };
}

function registrar({ tipo, resultado, cliente, unidade, empreendimentoId }) {
  const contratoId = `enc-${Date.now()}`;

  db.prepare(
    'INSERT INTO contratos (id, nome, categoria, status, empreendimentoId, unidadeId, clienteId) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run([contratoId, tipo, 'Encerramento', 'gerado', empreendimentoId,
    unidade ? unidade.id : null, cliente.id]);

  db.prepare(
    'INSERT INTO documentos (tipo, nome, empreendimentoId, unidadeId, clienteId, caminho, data, contratoId, origem, camposSemValor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run([tipo, `${tipo} - ${cliente.nome}`, empreendimentoId,
    unidade ? unidade.id : null, cliente.id, resultado.caminhoPublico, hoje(),
    contratoId, 'gerado', JSON.stringify(resultado.placeholdersSemValor)]);

  return contratoId;
}

/**
 * Termo de Quitação.
 *
 * Recusa enquanto houver parcela em aberto: o documento DECLARA ter recebido
 * a integralidade. Emitir com parcela pendente seria declarar o que não
 * aconteceu — e é a aplicação que precisa impedir, não a pessoa lembrar.
 */
async function gerarQuitacao({ clienteId, unidadeId, cidadeUf }) {
  const { cliente, unidade, empreendimento, empreendimentoId, lancamentos } =
    reunirOperacao({ clienteId, unidadeId });

  const vivos = lancamentos.filter((l) => l.situacao !== 'cancelado');
  if (!vivos.length) {
    throw new Error('Esta operação não tem lançamentos no financeiro — não há o que quitar.');
  }

  const emAberto = vivos.filter((l) => l.situacao !== 'recebido');
  if (emAberto.length) {
    throw new Error(
      `Ainda há ${emAberto.length} parcela(s) em aberto no financeiro. ` +
      'O termo declara ter recebido a integralidade do valor; confirme os recebimentos antes de emiti-lo.'
    );
  }

  const total = vivos.reduce((acc, l) => acc + l.valor, 0);
  const ultimoRecebimento = vivos
    .map((l) => l.dataRecebimento)
    .filter(Boolean)
    .sort()
    .pop() || hoje();

  const documento = {
    tipo: QUITACAO,
    dadosGerais: { dataDocumento: formatarBr(hoje()), cidadeUf: cidadeUf || 'Aracruz/ES' },
    comprador: blocoComprador(cliente),
    encerramento: {
      lancamentos: vivos,
      unidadeAndar: andarPorExtenso(unidade && unidade.pavimento),
      total: emReal(total),
      totalExtenso: reaisPorExtenso(total),
      saldo: emReal(0),
      dataQuitacao: porExtensoData(ultimoRecebimento)
    }
  };

  const resultado = await gerarDocumento({
    documento, empreendimento, empreendimentoId,
    unidadeNumero: unidade ? unidade.numero : null
  });

  const contratoId = registrar({ tipo: QUITACAO, resultado, cliente, unidade, empreendimentoId });

  return { ...resultado, contratoId, total, parcelas: vivos.length };
}

/**
 * Distrato da adesão à SCP.
 *
 * Além do arquivo, desfaz a operação: libera a unidade, desassocia o cliente
 * e cancela as parcelas que ainda eram esperadas. Sem isso o espelho
 * continuaria mostrando vendido e o financeiro cobrando para sempre.
 */
async function gerarDistrato({ clienteId, unidadeId, cidadeUf }) {
  const { cliente, unidade, empreendimento, empreendimentoId, lancamentos } =
    reunirOperacao({ clienteId, unidadeId });

  const jaDistratada = db.prepare(
    'SELECT id FROM contratos WHERE clienteId = ? AND nome = ?'
  ).get([parseInt(clienteId), DISTRATO]);
  if (jaDistratada) {
    throw new Error('Esta operação já tem um distrato emitido.');
  }

  const devolvido = lancamentos
    .filter((l) => l.situacao === 'recebido')
    .reduce((acc, l) => acc + l.valor, 0);

  const conjuge = cliente.conjugeNome ? {
    nome: cliente.conjugeNome, cpf: cliente.conjugeCpf, rg: cliente.conjugeRg,
    nacionalidade: cliente.conjugeNacionalidade, profissao: cliente.conjugeProfissao,
    estadoCivil: cliente.conjugeEstadoCivil, email: cliente.conjugeEmail
  } : null;

  const documento = {
    tipo: DISTRATO,
    dadosGerais: { dataDocumento: formatarBr(hoje()), cidadeUf: cidadeUf || 'Aracruz' },
    comprador: blocoComprador(cliente),
    conjuge,
    encerramento: {
      valorDevolvido: emReal(devolvido),
      valorDevolvidoExtenso: reaisPorExtenso(devolvido)
    }
  };

  const resultado = await gerarDocumento({
    documento, empreendimento, empreendimentoId,
    unidadeNumero: unidade ? unidade.numero : null
  });

  const contratoId = registrar({ tipo: DISTRATO, resultado, cliente, unidade, empreendimentoId });

  // --- desfaz a operação ---
  const financeiroCancelado = financeiro.cancelarDaOperacao({ clienteId, unidadeId });

  if (unidade) {
    db.prepare(
      "UPDATE unidades SET status = 'livre', clienteId = NULL, reservadoPor = NULL, reservadoEm = NULL WHERE id = ?"
    ).run(unidade.id);
  }
  db.prepare('UPDATE clientes SET unidadeId = NULL WHERE id = ?').run(parseInt(clienteId));

  return {
    ...resultado,
    contratoId,
    devolvido,
    parcelasCanceladas: financeiroCancelado.cancelados,
    unidadeLiberada: unidade ? unidade.numero : null
  };
}

function formatarBr(iso) {
  const [a, m, d] = String(iso).split('-');
  return `${d}/${m}/${a}`;
}

module.exports = { QUITACAO, DISTRATO, reunirOperacao, gerarQuitacao, gerarDistrato };
