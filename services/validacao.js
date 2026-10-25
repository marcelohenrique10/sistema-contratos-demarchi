/**
 * Validações e conversões do formulário de contrato.
 *
 * Contrato assinado carrega CPF, CEP e valor em reais. Estas funções são
 * literais de propósito: cada uma é testada com casos conhecidos.
 */
const { somenteDigitos } = require('./formato');

function todosIguais(digitos) {
  return /^(\d)\1+$/.test(digitos);
}

function digitoCpf(base, pesoInicial) {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function cpfValido(valor) {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || todosIguais(d)) return false;
  return digitoCpf(d.slice(0, 9), 10) === Number(d[9]) && digitoCpf(d.slice(0, 10), 11) === Number(d[10]);
}

function digitoCnpj(base) {
  const pesos = base.length === 12
    ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cnpjValido(valor) {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || todosIguais(d)) return false;
  return digitoCnpj(d.slice(0, 12)) === Number(d[12]) && digitoCnpj(d.slice(0, 13)) === Number(d[13]);
}

/** CPF com 11 dígitos ou CNPJ com 14; qualquer outra coisa não é documento. */
function documentoValido(valor) {
  const d = somenteDigitos(valor);
  if (d.length === 11) return cpfValido(d);
  if (d.length === 14) return cnpjValido(d);
  return false;
}

function ehPessoaJuridica(valor) {
  return somenteDigitos(valor).length === 14;
}

function cepValido(valor) {
  return somenteDigitos(valor).length === 8;
}

/**
 * "R$ 1.234,56", "1.234,56", "1234,56" e "1234.56" viram número.
 * null quando não há número reconhecível — nunca zero por engano.
 */
function dinheiro(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  const limpo = String(texto ?? '').replace(/[^\d,.-]/g, '').trim();
  if (!limpo) return null;

  let normalizado;
  if (limpo.includes(',')) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) {
    normalizado = limpo.replace(/\./g, ''); // "733.000" é setecentos e trinta e três mil
  } else {
    normalizado = limpo;
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** 733000 -> "733.000,00" */
function formatarNumero(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 733000 -> "R$ 733.000,00" */
function emReais(n) {
  return `R$ ${formatarNumero(n)}`;
}

/** Aceita aaaa-mm-dd (campo date) e dd/mm/aaaa. Devolve aaaa-mm-dd ou null. */
function dataIso(texto) {
  const t = String(texto ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!br) return null;
    m = [null, br[3], br[2].padStart(2, '0'), br[1].padStart(2, '0')];
  }
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  const confere = !Number.isNaN(d.getTime())
    && d.getFullYear() === Number(m[1]) && d.getMonth() + 1 === Number(m[2]) && d.getDate() === Number(m[3]);
  return confere ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

module.exports = {
  cpfValido, cnpjValido, documentoValido, ehPessoaJuridica, cepValido,
  dinheiro, formatarNumero, emReais, dataIso
};
