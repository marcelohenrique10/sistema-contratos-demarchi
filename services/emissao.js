const db = require('../database');
const { gerarDocumento } = require('./documento');
const { registrarRecebiveis } = require('./recebiveis');

/**
 * Emissão de um documento: gera o arquivo, registra na tela de Documentos,
 * marca o contrato como gerado, guarda a qualificação no cliente e cria o
 * cronograma de recebíveis.
 *
 * Existe um só caminho para isso. Antes a lógica morava dentro da rota do
 * webhook, que só o n8n alcançava; o formulário interno precisa da mesma coisa,
 * e duas cópias divergiriam — o mesmo erro que o catálogo de modelos já
 * cometeu uma vez.
 */

// Remove o prefixo numérico da lista suspensa do formulário ("1. Contrato..." -> "Contrato...")
function normalizarTipoDocumento(tipo) {
  return String(tipo || '').replace(/^\s*\d+\s*[.)-]\s*/, '').trim();
}

// O formulário informa o número da unidade ("1001"), não o id do banco.
function resolverUnidadeId({ unidadeId, unidadeNumero, empreendimentoId }) {
  if (unidadeId) return parseInt(unidadeId);
  if (!unidadeNumero || !empreendimentoId) return null;

  const unidade = db.prepare(
    'SELECT id FROM unidades WHERE empreendimentoId = ? AND TRIM(numero) = TRIM(?)'
  ).get([empreendimentoId, String(unidadeNumero)]);

  return unidade ? unidade.id : null;
}

/**
 * Guarda no cliente a qualificação que veio no documento.
 *
 * Só preenche o que está vazio: o cadastro manual, feito por alguém da
 * equipe, vale mais do que uma resposta de formulário reprocessada.
 */
function guardarQualificacao(clienteId, documento) {
  const c = documento.comprador || {};
  const j = documento.conjuge || {};

  const campos = {
    nacionalidade: c.nacionalidade, estadoCivil: c.estadoCivil, profissao: c.profissao,
    rg: c.rg, orgaoEmissorRg: c.orgaoEmissorRg, endereco: c.endereco, cep: c.cep,
    conjugeNome: j.nome, conjugeCpf: j.cpf, conjugeRg: j.rg,
    conjugeOrgaoEmissorRg: j.orgaoEmissorRg, conjugeNacionalidade: j.nacionalidade,
    conjugeProfissao: j.profissao, conjugeEstadoCivil: j.estadoCivil, conjugeEmail: j.email
  };

  const comValor = Object.entries(campos).filter(([, v]) => String(v || '').trim());
  if (!comValor.length) return;

  const sets = comValor.map(([k]) => `${k} = COALESCE(NULLIF(${k}, ''), ?)`).join(', ');
  db.prepare(`UPDATE clientes SET ${sets} WHERE id = ?`)
    .run([...comValor.map(([, v]) => String(v).trim()), clienteId]);
}

async function emitir({ documento, empreendimentoId, unidadeId, unidadeNumero, clienteId, contratoId, respostaId, comRecebiveis = true }) {
  const empreendimento = empreendimentoId
    ? db.prepare('SELECT * FROM empreendimentos WHERE id = ?').get(empreendimentoId)
    : null;

  const resultado = await gerarDocumento({ documento, empreendimento, empreendimentoId, unidadeNumero });
  const unidade = resolverUnidadeId({ unidadeId, unidadeNumero, empreendimentoId });
  const faltando = resultado.placeholdersSemValor;
  const tipo = normalizarTipoDocumento(documento.tipo);

  const insercao = db.prepare(
    'INSERT INTO documentos (tipo, nome, empreendimentoId, unidadeId, clienteId, caminho, data, respostaId, contratoId, origem, camposSemValor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run([
    tipo,
    `${tipo} - ${(documento.comprador || {}).nome || 'sem nome'}`,
    empreendimentoId || null,
    unidade,
    clienteId ? parseInt(clienteId) : null,
    resultado.caminhoPublico,
    new Date().toISOString().slice(0, 10),
    respostaId || null,
    contratoId || null,
    'gerado',
    JSON.stringify(faltando)
  ]);

  if (contratoId) {
    db.prepare('UPDATE contratos SET status = ? WHERE id = ?').run(['gerado', contratoId]);
  }

  // A qualificação que acabou de entrar no documento fica guardada no
  // cliente. É dela que a quitação e o distrato vivem, meses depois,
  // quando não há mais formulário a preencher.
  if (clienteId) guardarQualificacao(parseInt(clienteId), documento);

  // As parcelas do contrato viram cronograma de recebíveis no financeiro.
  const recebiveis = comRecebiveis
    ? registrarRecebiveis({ contratoId, empreendimentoId, compraVenda: documento.compraVenda })
    : { lancamentos: 0, total: 0 };

  return {
    id: Number(insercao.lastInsertRowid),
    arquivo: resultado.caminhoPublico,
    camposSemValor: faltando,
    camposNaoAplicaveis: resultado.placeholdersNaoAplicaveis,
    recebiveis
  };
}

module.exports = { emitir, resolverUnidadeId, normalizarTipoDocumento, guardarQualificacao };
