/**
 * Valor em reais por extenso.
 *
 * Nos outros documentos quem escreve o extenso é a pessoa, no formulário. A
 * quitação e o distrato nascem do sistema, meses depois — não há formulário
 * para pedir, então o número precisa virar texto aqui.
 *
 * Como vai para documento assinado, o código é literal de propósito: sem
 * atalho esperto, com os casos irregulares do português escritos à mão.
 */

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze',
  'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta',
  'sessenta', 'setenta', 'oitenta', 'noventa'];
// "cem" é exceção: só vale sozinho. 101 é "cento e um".
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

/** 0 a 999 por extenso. */
function ateNovecentos(n) {
  if (n === 0) return '';
  if (n === 100) return 'cem';

  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes = [];

  if (centena) partes.push(CENTENAS[centena]);

  if (resto >= 10 && resto <= 19) {
    partes.push(DEZ_A_DEZENOVE[resto - 10]);
  } else {
    const dezena = Math.floor(resto / 10);
    const unidade = resto % 10;
    const miolo = [];
    if (dezena) miolo.push(DEZENAS[dezena]);
    if (unidade) miolo.push(UNIDADES[unidade]);
    if (miolo.length) partes.push(miolo.join(' e '));
  }

  return partes.join(' e ');
}

const ESCALAS = [
  { valor: 1000000000, singular: 'bilhão', plural: 'bilhões' },
  { valor: 1000000, singular: 'milhão', plural: 'milhões' },
  { valor: 1000, singular: 'mil', plural: 'mil' }
];

/** Número inteiro por extenso, sem unidade monetária. */
function inteiroPorExtenso(n) {
  if (n === 0) return 'zero';

  const grupos = [];
  let restante = n;

  ESCALAS.forEach(({ valor, singular, plural }) => {
    const quantos = Math.floor(restante / valor);
    if (!quantos) return;
    restante -= quantos * valor;

    // "mil" não leva "um" na frente: 1.000 é "mil", não "um mil".
    const prefixo = valor === 1000 && quantos === 1 ? '' : inteiroPorExtenso(quantos) + ' ';
    grupos.push(prefixo + (quantos === 1 ? singular : plural));
  });

  if (restante) grupos.push(ateNovecentos(restante));

  if (grupos.length < 2) return grupos.join('');

  // Como o último grupo se liga ao anterior:
  //   sem resto abaixo de mil  -> "e"   (1.500.000 = um milhão E quinhentos mil)
  //   resto menor que cem      -> "e"   (1.015    = mil E quinze)
  //   resto em centena redonda -> "e"   (1.100    = mil E cem)
  //   qualquer outro resto     -> ","   (1.234    = mil, duzentos e trinta e quatro)
  const ultimo = grupos[grupos.length - 1];
  const anteriores = grupos.slice(0, -1);
  const sobra = n % 1000;
  const ligaComE = sobra === 0 || sobra < 100 || sobra % 100 === 0;

  return anteriores.join(', ') + (ligaComE ? ' e ' : ', ') + ultimo;
}

/**
 * "624368.5" -> "seiscentos e vinte e quatro mil, trezentos e sessenta e oito
 * reais e cinquenta centavos".
 *
 * Aceita número, "1.234,56" e "R$ 1.234,56".
 */
function reaisPorExtenso(valor) {
  const n = normalizar(valor);
  if (n === null) return '';

  const inteiro = Math.floor(n);
  const centavos = Math.round((n - inteiro) * 100);

  const partes = [];
  if (inteiro > 0) {
    const texto = inteiroPorExtenso(inteiro);
    // "dois milhões DE reais", mas "um milhão e quinhentos mil reais": a
    // preposição só entra quando a frase termina na palavra de escala.
    const terminaEmEscala = /(milh[ãõ]|bilh[ãõ])\w*$/.test(texto);
    const moeda = inteiro === 1 ? 'real' : 'reais';
    partes.push(`${texto} ${terminaEmEscala ? 'de ' : ''}${moeda}`);
  }
  if (centavos > 0) {
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  }
  if (!partes.length) return 'zero real';

  return partes.join(' e ');
}

function normalizar(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const limpo = String(valor ?? '').replace(/[^\d,.-]/g, '').trim();
  if (!limpo) return null;
  const n = Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
  return Number.isFinite(n) ? n : null;
}

const ORDINAIS = ['', 'primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto',
  'sétimo', 'oitavo', 'nono', 'décimo', 'décimo primeiro', 'décimo segundo',
  'décimo terceiro', 'décimo quarto', 'décimo quinto', 'décimo sexto',
  'décimo sétimo', 'décimo oitavo', 'décimo nono', 'vigésimo'];

/**
 * "10º" -> "décimo andar". Pavimento que não for número vira ele mesmo, para
 * o documento nunca sair com o campo vazio.
 */
function andarPorExtenso(pavimento) {
  const texto = String(pavimento ?? '').trim();
  if (!texto) return '';

  const n = parseInt(texto.replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1 || n >= ORDINAIS.length) return texto;

  return `${ORDINAIS[n]} andar`;
}

module.exports = { reaisPorExtenso, inteiroPorExtenso, andarPorExtenso };
