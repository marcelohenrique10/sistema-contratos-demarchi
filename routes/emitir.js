const express = require('express');
const db = require('../database');
const F = require('../services/formulario');
const { reaisPorExtenso, inteiroPorExtenso } = require('../services/extenso');
const v = require('../services/validacao');
const incorporacao = require('../services/incorporacao');

/**
 * Formulário interno de contrato.
 *
 * Montado dentro do router de páginas, DEPOIS da lista de permissões: as
 * rotas daqui passam pelo mesmo porteiro que o resto. As que o corretor pode
 * usar estão liberadas lá, explicitamente.
 */
const router = express.Router();

function caminhoDaOperacao(clienteId, unidadeId) {
  return `/operacoes/${clienteId}/${unidadeId || 'sem-unidade'}/emitir`;
}

// O contexto da operação, com o que este usuário pode corrigir nela.
function contextoPara(req, res) {
  const ctx = F.contexto(req.params.clienteId, req.params.unidadeId);
  ctx.editaEmpreendimento = Boolean(res.locals.ehAdmin);
  return ctx;
}

function renderizar(res, ctx, { valores, marcados, erros = {}, geral = [], avisos = [] }, status = 200) {
  const numero = ctx.unidade ? String(ctx.unidade.numero).trim() : '';
  res.status(status).render('emitir', {
    ctx,
    valores,
    marcados: marcados.map(String),
    erros, geral, avisos,
    docs: F.DOCS,
    camposIncorporacao: incorporacao.CAMPOS,
    acao: caminhoDaOperacao(ctx.cliente.id, ctx.uid),
    unidadeExtenso: /^\d+$/.test(numero) ? inteiroPorExtenso(parseInt(numero, 10)) : '',
    listas: {
      estadosCivis: F.ESTADOS_CIVIS, formas: F.FORMAS_PAGAMENTO, indices: F.INDICES,
      tiposParcela: F.TIPOS_PARCELA_SUGERIDOS, tiposParcelaScp: F.TIPOS_PARCELA_SCP
    }
  });
}

router.get('/operacoes/:clienteId/:unidadeId/emitir', (req, res) => {
  let ctx;
  try {
    ctx = contextoPara(req, res);
  } catch (e) {
    return res.redirect('/contratos?erro=' + encodeURIComponent(e.message));
  }

  if (!ctx.contratos.length) {
    return res.redirect('/contratos?erro=' + encodeURIComponent(
      'Esta operação não tem documentos de contrato. Acrescente-os em "Iniciar nova operação".'
    ));
  }

  // Vindo do botão de um documento, só ele vem marcado. Sem isso, os pendentes.
  const pedido = String(req.query.contrato || '');
  const marcados = ctx.contratos.some((c) => String(c.id) === pedido)
    ? [pedido]
    : ctx.contratos.filter((c) => c.status !== 'gerado' && c.status !== 'anexado').map((c) => c.id);

  renderizar(res, ctx, { valores: F.valoresIniciais(ctx), marcados });
});

router.post('/operacoes/:clienteId/:unidadeId/emitir', async (req, res) => {
  let ctx;
  try {
    ctx = contextoPara(req, res);
  } catch (e) {
    return res.redirect('/contratos?erro=' + encodeURIComponent(e.message));
  }

  const interp = F.interpretar(req.body, ctx);
  const marcados = [].concat(req.body.contratoIds || []);

  if (!interp.ok) {
    return renderizar(res, ctx, {
      valores: interp.valores, marcados, erros: interp.erros, geral: interp.geral, avisos: interp.avisos
    }, 422);
  }

  try {
    const r = await F.emitirOperacao(ctx, interp, req.usuario || res.locals.usuario);
    res.redirect(`/emissoes/${r.emissaoId}`);
  } catch (e) {
    renderizar(res, ctx, {
      valores: interp.valores, marcados, geral: [`Não foi possível gerar: ${e.message}`], avisos: interp.avisos
    }, 500);
  }
});

router.get('/emissoes/:id', (req, res) => {
  const emissao = db.prepare('SELECT * FROM emissoes WHERE id = ?').get(parseInt(req.params.id));
  if (!emissao) return res.status(404).send('Emissão não encontrada');

  const cliente = db.prepare('SELECT id, nome FROM clientes WHERE id = ?').get(emissao.clienteId) || {};
  const unidade = emissao.unidadeId
    ? db.prepare('SELECT numero FROM unidades WHERE id = ?').get(emissao.unidadeId)
    : null;
  let resultado = { gerados: [], falhas: [], avisos: [] };
  try { resultado = { ...resultado, ...JSON.parse(emissao.resultado || '{}') }; } catch (_) { /* fica vazio */ }

  res.render('emitido', {
    emissao, cliente, unidade, resultado,
    voltar: caminhoDaOperacao(emissao.clienteId, emissao.unidadeId)
  });
});

// Mostra o valor por extenso enquanto a pessoa digita: é o mesmo texto que
// vai para o contrato, então o erro aparece antes de gerar.
router.get('/api/extenso', (req, res) => {
  const n = v.dinheiro(req.query.valor);
  res.json({ extenso: n > 0 ? reaisPorExtenso(n) : '' });
});

module.exports = router;
