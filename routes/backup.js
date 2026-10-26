const express = require('express');
const multer = require('multer');
const router = express.Router();
const backup = require('../services/backup');
const caminhos = require('../caminhos');
const { exigirAdmin } = require('../services/auth');

// Contém CPF, RG, endereço e todos os contratos. Só administrador.
router.use(exigirAdmin);

// Fica em memória: o arquivo é lido uma vez e descartado. 200 MB cobre o
// banco e alguns milhares de contratos com folga.
const receber = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024, files: 1 }
}).single('arquivo');

function voltar(res, chave, valor) {
  res.redirect(`/backup?${chave}=${encodeURIComponent(valor)}`);
}

router.get('/', (req, res) => {
  res.render('backup', {
    copias: backup.listar(),
    // Sem DADOS_DIR, banco e cópias vivem dentro do projeto — e no Render
    // gratuito somem a cada reinício. A tela precisa dizer isso.
    temDisco: Boolean(process.env.DADOS_DIR),
    erro: req.query.erro || null,
    aviso: req.query.aviso || null
  });
});

router.get('/baixar', (req, res) => {
  try {
    const conteudo = backup.gerar();
    res.attachment(backup.nomeDoArquivo('manual'));
    res.type('application/zip');
    res.send(conteudo);
  } catch (e) {
    voltar(res, 'erro', 'Não foi possível gerar o backup: ' + e.message);
  }
});

router.get('/copias/:nome', (req, res) => {
  const arquivo = backup.caminhoDaCopia(req.params.nome);
  if (!arquivo) return voltar(res, 'erro', 'Cópia não encontrada.');
  res.download(arquivo);
});

router.post('/salvar', (req, res) => {
  try {
    const nome = backup.salvar('manual');
    voltar(res, 'aviso', `Cópia guardada no servidor: ${nome}`);
  } catch (e) {
    voltar(res, 'erro', 'Não foi possível guardar a cópia: ' + e.message);
  }
});

router.post('/restaurar', (req, res) => {
  receber(req, res, (erroUpload) => {
    if (erroUpload) return voltar(res, 'erro', erroUpload.message);
    if (!req.file) return voltar(res, 'erro', 'Escolha o arquivo .zip do backup.');
    if (req.body.confirmar !== 'RESTAURAR') {
      return voltar(res, 'erro', 'Para restaurar, digite RESTAURAR no campo de confirmação.');
    }

    try {
      const r = backup.restaurar(req.file.buffer);
      const c = r.contagem;
      voltar(res, 'aviso',
        `Backup restaurado: ${c.clientes || 0} cliente(s), ${c.unidades || 0} unidade(s), ` +
        `${c.contratos || 0} contrato(s), ${r.documentos} arquivo(s) de documento. ` +
        `O estado anterior foi guardado em ${r.seguranca}.`);
    } catch (e) {
      voltar(res, 'erro', e.message);
    }
  });
});

module.exports = router;
