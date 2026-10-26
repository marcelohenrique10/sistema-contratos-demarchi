const AdmZip = require('adm-zip');

const DOC_XML = 'word/document.xml';

function escaparXml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function lerDocumentoXml(caminho) {
  const zip = new AdmZip(caminho);
  return { zip, xml: zip.readAsText(DOC_XML) };
}

function gravarDocumentoXml(zip, xml, destino) {
  zip.updateFile(DOC_XML, Buffer.from(xml, 'utf8'));
  zip.writeZip(destino);
}

// Troca os [PLACEHOLDER] pelos valores. O que não tiver valor vira string
// vazia, para não sobrar colchete no documento entregue ao cliente.
function substituirPlaceholders(xml, valores) {
  return xml.replace(/\[([A-Z0-9_]+)\]/g, (original, chave) => {
    if (!(chave in valores)) return original;
    return escaparXml(valores[chave]);
  });
}

function listarPlaceholders(xml) {
  const semTags = xml.replace(/<[^>]+>/g, '');
  return [...new Set(semTags.match(/\[[A-Z0-9_]+\]/g) || [])];
}

// ---------- Parágrafos ----------

const RE_PARAGRAFO = /<w:p[ >][\s\S]*?<\/w:p>/g;

function textoDoParagrafo(paragrafoXml) {
  return (paragrafoXml.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ''))
    .join('');
}

function paragrafos(xml) {
  const lista = [];
  let m;
  RE_PARAGRAFO.lastIndex = 0;
  while ((m = RE_PARAGRAFO.exec(xml))) {
    lista.push({ inicio: m.index, fim: m.index + m[0].length, xml: m[0], texto: textoDoParagrafo(m[0]) });
  }
  return lista;
}

/**
 * Remove os parágrafos cujo texto contém algum dos placeholders informados
 * (por prefixo: 'INTERMEDIADORA_' pega todos os campos da intermediadora).
 *
 * É assim que um bloco opcional some por inteiro do documento, título
 * incluído, em vez de sair com os rótulos e os campos vazios. Se o bloco
 * estava entre duas linhas em branco, uma delas sai junto, para não ficar
 * um buraco duplo no lugar.
 */
function removerParagrafosCom(xml, prefixos) {
  if (!prefixos.length) return xml;
  const lista = paragrafos(xml);
  const temMarcador = (texto) => prefixos.some((p) => texto.includes(`[${p}`));

  const remover = new Set();
  lista.forEach((p, i) => { if (temMarcador(p.texto)) remover.add(i); });

  const vazio = (i) => lista[i] && !lista[i].texto.trim();
  // Colado: só espaço entre um parágrafo e outro (nada de tabela no meio)
  const colados = (a, b) => lista[a] && lista[b] && !xml.slice(lista[a].fim, lista[b].inicio).trim();

  [...remover].forEach((i) => {
    if (remover.has(i + 1)) return; // não é o fim do bloco
    let primeiro = i;
    while (remover.has(primeiro - 1)) primeiro--;
    if (vazio(primeiro - 1) && vazio(i + 1) && colados(primeiro - 1, primeiro) && colados(i, i + 1)) {
      remover.add(i + 1);
    }
  });

  let resultado = xml;
  [...remover].sort((a, b) => b - a).forEach((i) => {
    resultado = resultado.slice(0, lista[i].inicio) + resultado.slice(lista[i].fim);
  });
  return resultado;
}

/**
 * Repete o parágrafo que contém `[CHAVE]`, uma cópia para cada texto, com a
 * formatação do original. Lista vazia remove o parágrafo.
 *
 * Usado nas observações do quadro de pagamento: quantas houver, cada uma
 * no seu parágrafo.
 */
function repetirParagrafo(xml, chave, textos) {
  const marcador = `[${chave}]`;
  const alvo = paragrafos(xml).find((p) => p.texto.includes(marcador));
  if (!alvo) return xml;
  if (!textos.length) return removerParagrafosCom(xml, [chave]);

  const copias = textos.map((texto) => alvo.xml.replace(marcador, escaparXml(texto)));
  return xml.slice(0, alvo.inicio) + copias.join('') + xml.slice(alvo.fim);
}

// ---------- Tabelas ----------

function extrairLinhas(tabelaXml) {
  return tabelaXml.match(/<w:tr(?: [^>]*)?>[\s\S]*?<\/w:tr>/g) || [];
}

function extrairCelulas(linhaXml) {
  return linhaXml.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
}

// Escreve `texto` na primeira caixa de texto da célula e esvazia as demais,
// preservando a formatação original (fonte, alinhamento, bordas).
function definirTextoCelula(celulaXml, texto) {
  let primeira = true;
  return celulaXml.replace(/(<w:t(?: [^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (_, abre, __, fecha) => {
    if (primeira) {
      primeira = false;
      const tag = abre.includes('xml:space') ? abre : abre.replace('<w:t', '<w:t xml:space="preserve"');
      return `${tag}${escaparXml(texto)}${fecha}`;
    }
    return `${abre}${fecha}`;
  });
}

// `textos` é posicional, uma entrada por célula. null/undefined mantém a
// célula intacta — usado nas células mescladas, que não têm texto próprio.
function definirTextosLinha(linhaXml, textos) {
  let i = 0;
  return linhaXml.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (celula) => {
    const texto = textos[i++];
    return texto === undefined || texto === null ? celula : definirTextoCelula(celula, texto);
  });
}

// Substitui o miolo da primeira tabela do documento pelas linhas informadas,
// mantendo as propriedades da tabela (<w:tblPr>, <w:tblGrid>).
function substituirLinhasDaPrimeiraTabela(xml, novasLinhas) {
  return substituirLinhasDaTabela(xml, 0, novasLinhas);
}

/**
 * O mesmo, para a tabela de índice `indice`.
 *
 * O Termo de Quitação usa tabela também no cabeçalho e no bloco de
 * assinaturas, então "a primeira" não serve — a de pagamentos é a segunda.
 */
function substituirLinhasDaTabela(xml, indice, novasLinhas) {
  const tabelas = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
  const original = tabelas[indice];
  if (!original) return xml;
  const primeiraLinha = original.search(/<w:tr(?: [^>]*)?>/);
  const cabecalho = original.slice(0, primeiraLinha);

  const nova = `${cabecalho}${novasLinhas.join('')}</w:tbl>`;
  return xml.replace(original, nova);
}

module.exports = {
  lerDocumentoXml,
  gravarDocumentoXml,
  substituirPlaceholders,
  listarPlaceholders,
  removerParagrafosCom,
  repetirParagrafo,
  extrairLinhas,
  extrairCelulas,
  definirTextoCelula,
  definirTextosLinha,
  substituirLinhasDaPrimeiraTabela,
  substituirLinhasDaTabela,
  escaparXml
};
