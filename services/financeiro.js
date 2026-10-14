const db = require('../database');

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atraso não é um estado guardado, é consequência da data: parcela ainda
 * prevista cujo vencimento já passou. Calculando, nunca desatualiza.
 */
function situacao(lancamento) {
  // Parcela de operação distratada não é nem recebida nem a vencer: ela
  // deixou de existir. Sem este estado, o distrato devolveria o dinheiro e o
  // financeiro continuaria cobrando para sempre.
  if (lancamento.status === 'cancelado') return 'cancelado';
  if (lancamento.status !== 'previsto') return 'recebido';
  if (!lancamento.data) return 'previsto';
  return lancamento.data < hoje() ? 'atrasado' : 'previsto';
}

const ROTULOS = {
  entrada: {
    previsto: 'A vencer',
    atrasado: 'Atrasado',
    recebido: 'Recebido',
    cancelado: 'Cancelado'
  }
};

function rotulo(sit, tipo) {
  return (ROTULOS[tipo] || ROTULOS.entrada)[sit];
}

function enriquecer(lancamento) {
  const sit = situacao(lancamento);
  return {
    ...lancamento,
    situacao: sit,
    situacaoLabel: rotulo(sit, lancamento.tipo)
  };
}

/** Confirma que o dinheiro entrou. */
function confirmarRecebimento(id, dataRecebimento) {
  db.prepare('UPDATE financeiro SET status = ?, dataRecebimento = ? WHERE id = ?')
    .run(['recebido', dataRecebimento || hoje(), parseInt(id)]);
}

/** Desfaz a confirmação. */
function desfazerRecebimento(id) {
  db.prepare('UPDATE financeiro SET status = ?, dataRecebimento = NULL WHERE id = ?')
    .run(['previsto', parseInt(id)]);
}

function numeroOuNulo(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Escolher a unidade já diz o empreendimento e, quase sempre, o cliente.
 * Completar aqui evita lançamento meio preenchido por descuido de quem digita.
 */
function resolverVinculo({ empreendimentoId, unidadeId, clienteId }) {
  const uid = numeroOuNulo(unidadeId);
  const vinculo = {
    empreendimentoId: empreendimentoId || null,
    unidadeId: uid,
    clienteId: numeroOuNulo(clienteId)
  };

  if (uid === null) return vinculo;

  const unidade = db.prepare('SELECT empreendimentoId, clienteId FROM unidades WHERE id = ?').get(uid);
  if (!unidade) return vinculo;

  if (!vinculo.empreendimentoId) vinculo.empreendimentoId = unidade.empreendimentoId || null;
  if (vinculo.clienteId === null) vinculo.clienteId = unidade.clienteId || null;
  return vinculo;
}

function criar({ empreendimentoId, unidadeId, clienteId, categoria, valor, data, observacao, status }) {
  const numero = Number(String(valor).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error('Informe um valor maior que zero.');
  }

  const st = status === 'previsto' ? 'previsto' : 'recebido';
  const vinculo = resolverVinculo({ empreendimentoId, unidadeId, clienteId });

  // Forçamos o tipo sempre como 'entrada' para eliminar as saídas
  db.prepare(
    'INSERT INTO financeiro (empreendimentoId, unidadeId, clienteId, categoria, tipo, valor, data, observacao, status, dataRecebimento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run([
    vinculo.empreendimentoId,
    vinculo.unidadeId,
    vinculo.clienteId,
    categoria || 'Outros',
    'entrada',
    numero,
    data || hoje(),
    observacao || null,
    st,
    st === 'recebido' ? (data || hoje()) : null
  ]);
}

function atualizar(id, dados) {
  const { categoria, valor, data, observacao } = dados;
  const numero = Number(String(valor).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error('Informe um valor maior que zero.');
  }

  // Quem edita pode mandar só parte do formulário; o que não veio permanece
  // como está, em vez de virar vínculo em branco.
  const atual = db.prepare('SELECT empreendimentoId, unidadeId, clienteId FROM financeiro WHERE id = ?')
    .get(parseInt(id)) || {};
  const escolher = (campo) => (campo in dados ? dados[campo] : atual[campo]);

  const vinculo = resolverVinculo({
    empreendimentoId: escolher('empreendimentoId'),
    unidadeId: escolher('unidadeId'),
    clienteId: escolher('clienteId')
  });

  db.prepare(
    'UPDATE financeiro SET empreendimentoId = ?, unidadeId = ?, clienteId = ?, categoria = ?, tipo = ?, valor = ?, data = ?, observacao = ? WHERE id = ?'
  ).run([
    vinculo.empreendimentoId,
    vinculo.unidadeId,
    vinculo.clienteId,
    categoria || 'Outros',
    'entrada',
    numero,
    data || null,
    observacao || null,
    parseInt(id)
  ]);
}

function excluir(id) {
  db.prepare('DELETE FROM financeiro WHERE id = ?').run(parseInt(id));
}

/**
 * Totais focados exclusivamente em Entradas (Recebimentos)
 */
function totais(lancamentos) {
  const soma = (filtro) => lancamentos.filter(filtro).reduce((acc, l) => acc + l.valor, 0);

  // Cancelados ficam de fora de todos os totais: o dinheiro foi devolvido.
  const recebido = soma((l) => l.tipo === 'entrada' && l.situacao === 'recebido');

  return {
    recebido,
    saidas: 0, // Mantido em 0 para não quebrar a estrutura existente
    aVencer: soma((l) => l.tipo === 'entrada' && l.situacao === 'previsto'),
    atrasado: soma((l) => l.tipo === 'entrada' && l.situacao === 'atrasado'),
    saldo: recebido // Sem saídas, o saldo é o próprio recebido
  };
}

/**
 * Cancela os lançamentos ainda previstos de uma operação distratada e informa
 * quanto já havia sido recebido — que é o valor a devolver ao investidor.
 */
function cancelarDaOperacao({ clienteId, unidadeId }) {
  const condicao = unidadeId
    ? 'clienteId = ? AND unidadeId = ?'
    : 'clienteId = ? AND unidadeId IS NULL';
  const parametros = unidadeId ? [parseInt(clienteId), parseInt(unidadeId)] : [parseInt(clienteId)];

  const todos = db.prepare(`SELECT * FROM financeiro WHERE ${condicao}`).all(parametros);
  const recebido = todos
    .filter((l) => l.status === 'recebido')
    .reduce((acc, l) => acc + l.valor, 0);

  const alterados = db.prepare(
    `UPDATE financeiro SET status = 'cancelado' WHERE ${condicao} AND status = 'previsto'`
  ).run(parametros);

  return {
    cancelados: Number(alterados.changes || 0),
    jaRecebido: recebido,
    total: todos.length
  };
}

module.exports = {
  cancelarDaOperacao,
  enriquecer,
  situacao,
  rotulo,
  confirmarRecebimento,
  desfazerRecebimento,
  criar,
  atualizar,
  excluir,
  totais,
  CATEGORIAS_SAIDA: [], // Zera as categorias de saída
  hoje
};