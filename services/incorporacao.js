const db = require('../database');

/**
 * Dados da incorporação que o Contrato de Promessa de Compra e Venda imprime
 * no item II do Quadro Resumo e na cláusula 3.
 *
 * São do empreendimento, não da venda: valem igual para todas as unidades.
 * Por isso moram no cadastro do empreendimento, e o formulário de contrato só
 * os confere (e o administrador corrige ali mesmo, se precisar).
 *
 * Uma lista só, usada pela tela do empreendimento, pelo formulário de
 * contrato e pela gravação — para os três não divergirem.
 */
const CAMPOS = [
  { nome: 'registroIncorporacao', rotulo: 'Registro da incorporação', cheio: true,
    ph: 'R-3 da Matrícula nº 00.000 do Cartório do 1º Ofício de Registro de Imóveis de ..., nos termos da Lei 4.591/64.' },
  { nome: 'patrimonioAfetacao', rotulo: 'Patrimônio de afetação', cheio: true,
    ph: 'AV-4 da Matrícula nº 00.000 do Cartório do 1º Ofício de Registro de Imóveis de ..., nos termos da Lei 4.591/64.' },
  { nome: 'enderecoImovel', rotulo: 'Endereço do imóvel', cheio: true,
    ph: 'Lotes 06 e 08, da quadra 10, Rua ..., nº ..., Bairro ..., Aracruz/ES, CEP 00000-000.',
    ajuda: 'Como consta na matrícula do terreno.' },
  { nome: 'alvaraConstrucao', rotulo: 'Alvará de construção nº', ph: '224/2021' },
  { nome: 'dataEntrega', rotulo: 'Data prevista de entrega (habite-se)', tipo: 'date' },
  { nome: 'dataOrcamento', rotulo: 'Data dos preços do orçamento', tipo: 'date',
    ajuda: 'Cláusula 3.2: "aos preços vigentes em ...".' },
  { nome: 'tipoPadronizado', rotulo: 'Tipo padronizado', ph: '101',
    ajuda: 'Cláusula 3.2. Só o número: o extenso é gerado.' },
  { nome: 'areasSubRogadas', rotulo: 'Áreas sub-rogadas (cláusula 3.3)', cheio: true,
    ph: 'das Lojas nº 01(um), 02(dois), 03(três) e 04 (quatro), e suas vagas de garagem',
    ajuda: 'O que o comprador paga a construção, na proporção da fração ideal, por conta da permuta '
      + 'com o dono do terreno. Com o artigo ("das lojas...", "dos apartamentos..."). '
      + 'Não é a unidade comprada.' }
];

const NOMES = CAMPOS.map((c) => c.nome);

function salvar(empreendimentoId, dados) {
  const colunas = NOMES.filter((n) => n in dados);
  if (!colunas.length) return;
  db.prepare(`UPDATE empreendimentos SET ${colunas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run([...colunas.map((c) => String(dados[c] ?? '').trim() || null), empreendimentoId]);
}

module.exports = { CAMPOS, NOMES, salvar };
