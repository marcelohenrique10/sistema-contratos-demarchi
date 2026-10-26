const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const db = require('../database');
const caminhos = require('../caminhos');

/**
 * Cópia de segurança: o banco inteiro mais os documentos gerados e enviados,
 * num .zip só.
 *
 * Os dois precisam andar juntos. O banco sem os arquivos aponta para
 * contratos que não existem; os arquivos sem o banco são .docx soltos que
 * ninguém sabe de quem são.
 */

const NOME_BANCO = 'imobiliaria.db';
// Quantas cópias automáticas ficam guardadas. Uma por dia, duas semanas.
const MANTER = 14;
// Intervalo mínimo entre cópias automáticas.
const INTERVALO_HORAS = 24;

function carimbo(data = new Date()) {
  // 2026-10-26_143005 — ordena por nome e não tem ":" (proibido no Windows)
  const p = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}_` +
    `${p(data.getHours())}${p(data.getMinutes())}${p(data.getSeconds())}`;
}

function temporario(nome) {
  return path.join(caminhos.BACKUPS, `.tmp-${process.pid}-${Date.now()}-${nome}`);
}

// Aspas simples dobradas: o caminho entra no SQL como texto, não como parâmetro
// (ATTACH não aceita parâmetro).
function literal(caminho) {
  return `'${caminho.replace(/'/g, "''")}'`;
}

function arquivosDoStorage(pasta = caminhos.STORAGE) {
  if (!fs.existsSync(pasta)) return [];
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const completo = path.join(pasta, item.name);
    return item.isDirectory() ? arquivosDoStorage(completo) : [completo];
  });
}

/**
 * Monta o .zip em memória e devolve o Buffer.
 *
 * O banco é copiado como arquivo. É seguro porque o node-sqlite3-wasm grava
 * direto no arquivo a cada transação concluída, e o Node executa uma coisa por
 * vez: durante a cópia (síncrona) nenhuma escrita acontece. Só não pode estar
 * no meio de uma transação.
 *
 * VACUUM INTO seria o caminho "de livro", mas recusa enquanto houver qualquer
 * consulta em andamento. A cópia do arquivo não depende disso.
 */
function gerar() {
  caminhos.garantirPastas();
  if (db.inTransaction) throw new Error('Há uma gravação em andamento. Tente de novo em alguns segundos.');
  const copia = temporario(NOME_BANCO);

  try {
    fs.copyFileSync(caminhos.BANCO, copia);

    const zip = new AdmZip();
    zip.addLocalFile(copia, '', NOME_BANCO);

    for (const arquivo of arquivosDoStorage()) {
      const relativo = path.relative(caminhos.STORAGE, arquivo).replace(/\\/g, '/');
      zip.addLocalFile(arquivo, path.posix.dirname(`storage/${relativo}`), path.basename(arquivo));
    }

    zip.addFile('backup.json', Buffer.from(JSON.stringify({
      geradoEm: new Date().toISOString(),
      documentos: arquivosDoStorage().length
    }, null, 2)));

    return zip.toBuffer();
  } finally {
    fs.rmSync(copia, { force: true });
  }
}

function nomeDoArquivo(motivo = 'manual') {
  return `backup-demarchi_${carimbo()}_${motivo}.zip`;
}

/** Cópias guardadas no servidor, da mais nova para a mais antiga. */
function listar() {
  if (!fs.existsSync(caminhos.BACKUPS)) return [];
  return fs.readdirSync(caminhos.BACKUPS)
    .filter((nome) => /^backup-demarchi_.*\.zip$/.test(nome))
    .map((nome) => {
      const info = fs.statSync(path.join(caminhos.BACKUPS, nome));
      return { nome, tamanho: info.size, criadoEm: info.mtime };
    })
    .sort((a, b) => b.criadoEm - a.criadoEm);
}

/** Grava uma cópia no servidor e apaga as excedentes. */
function salvar(motivo) {
  caminhos.garantirPastas();
  // Duas cópias no mesmo segundo não podem se sobrescrever: a de antes de uma
  // restauração é a única que desfaz um engano.
  let nome = nomeDoArquivo(motivo);
  for (let n = 2; fs.existsSync(path.join(caminhos.BACKUPS, nome)); n++) {
    nome = nomeDoArquivo(`${motivo}-${n}`);
  }
  fs.writeFileSync(path.join(caminhos.BACKUPS, nome), gerar());

  // Só as automáticas giram. A feita antes de uma restauração fica até
  // alguém apagar: é a que desfaz um engano.
  listar()
    .filter((b) => b.nome.endsWith('_automatico.zip'))
    .slice(MANTER)
    .forEach((b) => fs.rmSync(path.join(caminhos.BACKUPS, b.nome), { force: true }));

  return nome;
}

function caminhoDaCopia(nome) {
  // O nome vem da URL: só aceita o formato que nós mesmos geramos, para não
  // virar leitura de arquivo arbitrário.
  if (!/^backup-demarchi_[\w-]+\.zip$/.test(String(nome || ''))) return null;
  const completo = path.join(caminhos.BACKUPS, nome);
  return fs.existsSync(completo) ? completo : null;
}

/** Cópia automática, se a última tiver mais de INTERVALO_HORAS. */
function automatico() {
  const ultima = listar().find((b) => b.nome.endsWith('_automatico.zip'));
  const idadeHoras = ultima ? (Date.now() - ultima.criadoEm) / 36e5 : Infinity;
  if (idadeHoras < INTERVALO_HORAS) return null;
  return salvar('automatico');
}

function agendar() {
  const tentar = () => {
    try {
      const nome = automatico();
      if (nome) console.log(`Backup automático: ${nome}`);
    } catch (erro) {
      // Falhar a cópia não pode derrubar o sistema; fica no log.
      console.error('Backup automático falhou: ' + erro.message);
    }
  };
  // Logo depois de subir e, a partir daí, de hora em hora confere se já é tempo.
  setTimeout(tentar, 10 * 1000).unref();
  setInterval(tentar, 60 * 60 * 1000).unref();
}

/**
 * Coloca o conteúdo de um backup no lugar dos dados atuais.
 *
 * Os dados são trocados tabela a tabela dentro de uma transação: ou entra
 * tudo, ou nada muda. Antes, uma cópia do estado atual é gravada no servidor,
 * para o caso de o arquivo escolhido ser o errado.
 *
 * Backup de uma versão anterior do sistema também serve: entram as colunas
 * que existem nos dois lados, e as novas ficam vazias.
 */
function restaurar(buffer) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (_) {
    throw new Error('O arquivo não é um .zip válido.');
  }

  const entradaBanco = zip.getEntry(NOME_BANCO);
  if (!entradaBanco) {
    throw new Error(`O .zip não tem o ${NOME_BANCO}. Use um arquivo baixado desta tela.`);
  }

  caminhos.garantirPastas();
  const recebido = temporario(NOME_BANCO);
  fs.writeFileSync(recebido, entradaBanco.getData());

  let anexado = false;
  try {
    try {
      db.exec(`ATTACH ${literal(recebido)} AS r`);
      anexado = true;
    } catch (erro) {
      console.error('Restaurar: ATTACH falhou: ' + erro.message);
      throw new Error('O banco dentro do .zip está corrompido ou não é um banco do sistema.');
    }

    // Não deixa restaurar algo que trancaria todo mundo do lado de fora.
    const tabelasDoBackup = db.all("SELECT name FROM r.sqlite_master WHERE type = 'table'").map((t) => t.name);
    if (!tabelasDoBackup.includes('usuarios')) {
      throw new Error('O banco dentro do .zip não é deste sistema (não tem usuários).');
    }
    const admins = db.get("SELECT COUNT(*) AS n FROM r.usuarios WHERE papel = 'admin' AND ativo = 1").n;
    if (!admins) {
      throw new Error('O backup não tem nenhum administrador ativo. Restaurar trancaria todos do lado de fora.');
    }

    const seguranca = salvar('antes-de-restaurar');

    const tabelas = db.all(
      "SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    ).map((t) => t.name).filter((t) => tabelasDoBackup.includes(t));

    db.exec('BEGIN');
    try {
      const contagem = {};
      for (const tabela of tabelas) {
        const atuais = db.all(`PRAGMA main.table_info(${tabela})`).map((c) => c.name);
        const doBackup = db.all(`PRAGMA r.table_info(${tabela})`).map((c) => c.name);
        const colunas = atuais.filter((c) => doBackup.includes(c)).map((c) => `"${c}"`).join(', ');

        db.run(`DELETE FROM main.${tabela}`);
        db.run(`INSERT INTO main.${tabela} (${colunas}) SELECT ${colunas} FROM r.${tabela}`);
        contagem[tabela] = db.get(`SELECT COUNT(*) AS n FROM main.${tabela}`).n;
      }
      // Sem isso, o próximo cadastro poderia reusar um id que o backup já tem.
      if (tabelasDoBackup.includes('sqlite_sequence')) {
        db.run('DELETE FROM main.sqlite_sequence');
        db.run('INSERT INTO main.sqlite_sequence (name, seq) SELECT name, seq FROM r.sqlite_sequence');
      }
      db.exec('COMMIT');

      const documentos = extrairDocumentos(zip);
      return { seguranca, contagem, documentos };
    } catch (erro) {
      db.exec('ROLLBACK');
      throw erro;
    }
  } finally {
    if (anexado) {
      try { db.exec('DETACH r'); } catch (erro) { console.error('Restaurar: DETACH falhou: ' + erro.message); }
    }
    fs.rmSync(recebido, { force: true });
  }
}

// Os documentos do backup entram por cima dos atuais; os que só existem aqui
// ficam. Arquivo a mais não faz mal; arquivo a menos quebra um download.
function extrairDocumentos(zip) {
  const raiz = path.resolve(caminhos.STORAGE);
  let total = 0;

  for (const entrada of zip.getEntries()) {
    if (entrada.isDirectory || !entrada.entryName.startsWith('storage/')) continue;

    const destino = path.resolve(raiz, entrada.entryName.slice('storage/'.length));
    // Um .zip pode carregar "../../" no nome e escrever fora da pasta.
    if (!destino.startsWith(raiz + path.sep)) continue;

    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, entrada.getData());
    total++;
  }
  return total;
}

module.exports = { gerar, salvar, listar, restaurar, agendar, nomeDoArquivo, caminhoDaCopia };
