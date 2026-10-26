// Formulário interno de contrato: o que acontece no navegador.
//
// Nada aqui é decisão: quem valida e quem gera é o servidor. O navegador só
// esconde o que não se aplica, soma as parcelas e mostra o extenso enquanto a
// pessoa digita — para o erro aparecer ANTES de gerar o documento.
(function () {
  var form = document.getElementById('form-emitir');
  if (!form) return;

  var docs = Array.prototype.slice.call(form.querySelectorAll('input[name="contratoIds"]'));
  var corpoParcelas = document.getElementById('parcelas');
  var reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // Mesma regra do servidor (services/validacao.js -> dinheiro).
  function dinheiro(texto) {
    var limpo = String(texto || '').replace(/[^\d,.-]/g, '').trim();
    if (!limpo) return null;
    var n;
    if (limpo.indexOf(',') !== -1) n = Number(limpo.replace(/\./g, '').replace(',', '.'));
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) n = Number(limpo.replace(/\./g, ''));
    else n = Number(limpo);
    return isFinite(n) ? n : null;
  }

  function chavesMarcadas() {
    return docs.filter(function (d) { return d.checked; }).map(function (d) { return d.dataset.chave; });
  }

  function pessoa() {
    var r = form.querySelector('input[name="tipoPessoa"]:checked');
    return r ? r.value : 'pf';
  }

  function valor(nome) {
    var el = form.elements[nome];
    return el ? el.value : '';
  }

  // ------------------------------------------------------------ visibilidade
  function atualizar() {
    var chaves = chavesMarcadas();
    var p = pessoa();
    var temCV = chaves.indexOf('cv') !== -1;
    var temSCP = chaves.indexOf('scp') !== -1;

    Array.prototype.forEach.call(form.querySelectorAll('[data-para], [data-pessoa]'), function (el) {
      var para = el.dataset.para;
      var paraOk = !para || para.split(' ').some(function (k) { return chaves.indexOf(k) !== -1; });
      var pessoaOk = !el.dataset.pessoa || el.dataset.pessoa === p;
      el.hidden = !(paraOk && pessoaOk);
    });

    // À vista dispensa parcelas — a menos que haja um SCP, que tem as suas.
    var aVista = valor('formaAquisicao') === 'À vista';
    document.getElementById('a-vista').hidden = !aVista;
    document.getElementById('secao-parcelas').hidden = !((temCV && !aVista) || temSCP);

    document.getElementById('campos-conjuge').hidden = !document.getElementById('conjugeConsta').checked;
    document.getElementById('campos-intermediadora').hidden = !document.getElementById('intermediadoraConsta').checked;

    // Só SCP: o tipo da parcela é uma das cinco linhas fixas da tabela.
    var lista = temSCP && !temCV ? 'tipos-parcela-scp' : 'tipos-parcela';
    Array.prototype.forEach.call(corpoParcelas.querySelectorAll('input[name="parcelaTipo"]'), function (i) {
      i.setAttribute('list', lista);
    });

    somar();
  }

  // ------------------------------------------------------------------ somas
  function somar() {
    var chaves = chavesMarcadas();
    var temCV = chaves.indexOf('cv') !== -1;
    var soma = 0;

    Array.prototype.forEach.call(corpoParcelas.querySelectorAll('tr'), function (tr) {
      var v = dinheiro(tr.querySelector('[name="parcelaValor"]').value);
      var q = parseInt(tr.querySelector('[name="parcelaQtd"]').value, 10);
      if (v > 0 && q > 0) soma += v * q;
    });

    var aporte = form.elements.valorAporte;
    if (aporte) aporte.placeholder = soma > 0 ? reais.format(soma).replace(/ /g, ' ') : '';

    var alvo = temCV ? dinheiro(valor('precoTotal')) : (dinheiro(valor('valorAporte')) || soma);
    var rotulo = temCV ? 'o preço total' : 'o aporte';
    var el = document.getElementById('soma-parcelas');
    if (!soma) { el.textContent = ''; el.className = 'soma'; }
    else if (alvo > 0 && Math.abs(soma - alvo) > 0.01) {
      el.textContent = 'As parcelas somam ' + reais.format(soma) + ' — ' + rotulo + ' é ' + reais.format(alvo)
        + ' (diferença de ' + reais.format(Math.abs(soma - alvo)) + ').';
      el.className = 'soma diverge';
    } else {
      el.textContent = 'As parcelas somam ' + reais.format(soma) + (alvo > 0 ? ' — bate com ' + rotulo + '.' : '.');
      el.className = 'soma bate';
    }

    var preco = dinheiro(valor('precoTotal'));
    var fracao = dinheiro(valor('valorFracaoIdeal'));
    var custo = dinheiro(valor('valorCustoConstrucao'));
    var f = document.getElementById('soma-fracao');
    if (preco > 0 && fracao > 0 && custo > 0 && Math.abs(fracao + custo - preco) > 0.01) {
      f.textContent = 'Fração ideal + custo de construção somam ' + reais.format(fracao + custo)
        + ', e o preço total é ' + reais.format(preco) + '.';
      f.className = 'soma diverge';
    } else {
      f.textContent = '';
      f.className = 'soma';
    }
  }

  // ---------------------------------------------------------------- parcelas
  function novaLinha() {
    var modelo = corpoParcelas.querySelector('tr');
    var linha = modelo.cloneNode(true);
    linha.removeAttribute('aria-invalid');
    Array.prototype.forEach.call(linha.querySelectorAll('input'), function (i) { i.value = ''; });
    Array.prototype.forEach.call(linha.querySelectorAll('select'), function (s) { s.selectedIndex = 0; });
    corpoParcelas.appendChild(linha);
    linha.querySelector('input').focus();
    atualizar();
  }

  document.getElementById('add-parcela').addEventListener('click', novaLinha);

  corpoParcelas.addEventListener('click', function (e) {
    if (!e.target.classList.contains('remover')) return;
    var linhas = corpoParcelas.querySelectorAll('tr');
    var tr = e.target.closest('tr');
    if (linhas.length > 1) tr.remove();
    else Array.prototype.forEach.call(tr.querySelectorAll('input'), function (i) { i.value = ''; });
    somar();
  });

  // ------------------------------------------------------------ observações
  // O texto que o contrato modelo trazia para quando parte do preço é paga com
  // um imóvel. O valor vem das parcelas pagas com "Apartamento" ou "Permuta";
  // a descrição do imóvel fica para a pessoa completar.
  document.getElementById('obs-permuta').addEventListener('click', function () {
    var soma = 0;
    Array.prototype.forEach.call(corpoParcelas.querySelectorAll('tr'), function (tr) {
      var forma = tr.querySelector('[name="parcelaForma"]').value;
      var v = dinheiro(tr.querySelector('[name="parcelaValor"]').value);
      var q = parseInt(tr.querySelector('[name="parcelaQtd"]').value, 10) || 1;
      if ((forma === 'Apartamento' || forma === 'Permuta') && v > 0) soma += v * q;
    });
    var valorTexto = soma > 0 ? reais.format(soma).replace(/\s/g, ' ') : 'R$ ___';
    var texto = 'As partes ajustam que a correção INCC sobre o débito de ' + valorTexto
      + ' referente a permuta serão aplicados tanto sobre o saldo devedor quanto da valorização do '
      + '[descreva o imóvel: tipo, número, endereço completo e CEP].';
    var campo = document.getElementById('observacoesPagamento');
    campo.value = campo.value.trim() ? campo.value.replace(/\s*$/, '') + '\n' + texto : texto;
    campo.focus();
    var inicio = campo.value.lastIndexOf('[descreva');
    if (inicio !== -1) campo.setSelectionRange(inicio, campo.value.length - 1);
  });

  // ----------------------------------------------------------------- extenso
  // O mesmo texto que vai para o contrato, vindo do servidor.
  Array.prototype.forEach.call(form.querySelectorAll('[data-extenso]'), function (campo) {
    var alvo = campo.parentNode.querySelector('.extenso');
    var espera;
    function mostrar() {
      var n = dinheiro(campo.value);
      if (!(n > 0)) { alvo.textContent = ''; return; }
      fetch('/api/extenso?valor=' + encodeURIComponent(campo.value), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { extenso: '' }; })
        .then(function (j) { alvo.textContent = j.extenso ? 'Por extenso: ' + j.extenso : ''; })
        .catch(function () { alvo.textContent = ''; });
    }
    campo.addEventListener('input', function () { clearTimeout(espera); espera = setTimeout(mostrar, 350); });
    mostrar();
  });

  // ------------------------------------------------------------------ eventos
  form.addEventListener('change', atualizar);
  form.addEventListener('input', function (e) {
    if (/^(parcela|precoTotal|valorFracaoIdeal|valorCustoConstrucao|valorAporte)/.test(e.target.name || '')) somar();
  });

  form.addEventListener('submit', function (e) {
    if (!chavesMarcadas().length) {
      e.preventDefault();
      alert('Marque ao menos um documento para gerar.');
      return;
    }
    var botao = document.getElementById('gerar');
    botao.disabled = true;
    botao.textContent = 'Gerando…';
  });

  atualizar();
})();
