# Histórico do projeto — Sistema de Contratos De Marchi

Estado em 25/10/2026. Junta o que foi decidido e feito desde abril, para quem
pegar o projeto (inclusive uma sessão nova do Claude) não precisar reconstruir
a história.

## 1. O que é

Sistema interno da **De Marchi Incorporadora**, desenvolvido pela EJOTA
(empresa júnior). O Marcelo é o desenvolvedor, e o Léo Mello é o gerente do
projeto. Serve para controlar a venda de unidades: cadastro de clientes e
empreendimentos, espelho de vendas, geração dos contratos em Word, documentos
assinados e financeiro.

- **Repositório:** `marcelohenrique10/sistema-contratos-demarchi` (renomeado; antes `sistema-contratos-imobiliaria`). Está na conta pessoal do Marcelo.
- **Hospedagem:** Render, plano **gratuito**, na conta do Marcelo. Ele publica sozinho a cada push.
- **Stack:** Node 20+, Express 5, EJS, JavaScript puro no navegador, SQLite via `node-sqlite3-wasm` (arquivo `imobiliaria.db`). Os `.docx` são gerados editando o XML direto (`adm-zip`).

## 2. Mapa do código

| Pasta / arquivo | Para que serve |
|---|---|
| `app.js`, `database.js`, `caminhos.js` | Sobe o servidor, cria e migra o banco no boot, resolve onde ficam banco e arquivos (`DADOS_DIR`, `DB_PATH`, `STORAGE_DIR`) |
| `routes/pages.js` | As telas. No topo fica a **lista do que o corretor pode acessar**; o que não está nela é negado |
| `routes/emitir.js` + `views/emitir.ejs` + `public/js/emitir.js` | **Formulário interno** de contrato (novo) |
| `routes/webhook.js` | Entrada antiga vinda do n8n (`/webhook/cliente`, `/contrato`, `/documento`, `/empreendimentos`) |
| `routes/usuarios.js`, `routes/auth.js` | Contas, login e sessão |
| `services/documento.js` | `CATALOGO` dos 7 modelos e montagem dos valores de cada um |
| `services/docx.js` | Troca os `[PLACEHOLDERS]` dentro do `.docx` |
| `services/emissao.js` | Emissão de documento, usada pelo webhook e pelo formulário interno |
| `services/formulario.js`, `services/validacao.js` | Lógica e validação do formulário interno (CPF/CNPJ, CEP, dinheiro) |
| `services/encerramento.js` | Termo de Quitação e Distrato |
| `services/backup.js` + `routes/backup.js` | Backup, restauração e cópia automática diária |
| `services/recebiveis.js`, `services/financeiro.js` | Parcelas a receber geradas a partir do contrato; lançamentos |
| `services/extenso.js` | Valores e números por extenso |
| `services/reservas.js`, `services/unidades.js` | Reserva e liberação de unidade |
| `services/usuarios.js`, `services/auth.js` | Papéis, senha (scrypt), cookie assinado |
| `services/retroativo.js` | Recupera a qualificação de clientes antigos a partir dos logs do webhook |
| `templates/` | Os 7 modelos `.docx` + `README.md` com as divergências jurídicas |
| `forms/apps-script-formulario.gs` | Apps Script do Google Forms (caminho antigo) |
| `n8n/producao-render.json` | Workflow do n8n em produção (caminho antigo) |
| `docs/` | Manuais, checklist de entrega, virada para produção, plano de PDF |

## 3. Os 7 documentos

| Documento | Origem | Como sai |
|---|---|---|
| Contrato de Promessa de Compra e Venda | formulário | formulário interno |
| Anexo ao Contrato de Promessa | formulário | formulário interno |
| Termo de Anuência com Outorga de Poderes | formulário | formulário interno |
| Termo de Ciência e Anuência para Empréstimo | formulário | formulário interno |
| Termo de Adesão Preliminar SCP | formulário | formulário interno |
| Termo de Quitação de Obrigações | sistema | botão na operação ou lista; lê o Financeiro |
| Cancelamento do Termo de Adesão (Distrato) | sistema | botão na operação ou lista; só admin |

Atalhos na tela de Contratos: **Compra e Venda** (3 documentos), **Compra e Venda com financiamento** (4) e **Adesão à SCP** (1).

Regras dos documentos de encerramento:

- **Quitação** é recusada enquanto houver parcela em aberto, porque o termo declara que o valor foi recebido por inteiro. O quadro de pagamentos vem do Financeiro, então confirmar um recebimento passa a ter efeito em documento assinado.
- **Distrato** libera a unidade, desassocia o cliente e cancela as parcelas previstas. Pede confirmação e só o admin vê a opção.
- Não dá para combinar Quitação com documento de abertura, nem Quitação com Distrato.
- O distrato atual tem texto específico de SCP.

## 4. Linha do tempo

**Abr–jul/2026.** Base inicial com o Vitor (PR #1, integração com o n8n), banco, webhooks e autenticação.

**Ago/2026.** Financeiro com valores a receber, CRUD, upload de documentos. Decisões:
- O n8n é só mensageiro. Quem resolve tudo e gera o documento é o sistema.
- Só `.docx` por enquanto. O PDF foi validado e está guardado em `docs/pdf-e-word.md` (Word com o vermelho para conferir, PDF todo preto). Não dá para hospedar em Vercel/Netlify por causa do LibreOffice.
- `respostaId` impede que a mesma resposta seja processada duas vezes.

**Set/2026 (até a apresentação ao cliente).**
- Papéis: **admin** vê tudo; **corretor** vê clientes, empreendimentos, contratos/documentos e espelho, e só vê o contato dos clientes que ele mesmo criou. Contas individuais criadas pelo admin. Desativar uma conta derruba a sessão na hora.
- Espelho clicável: reservar exige um cliente já cadastrado e liga cliente e unidade nos dois sentidos; o corretor só libera a própria reserva.
- CPF/CNPJ formatados na entrada, contatos mascarados.
- Deploy no Render e `caminhos.js` preparado para o disco.
- Refatoração visual com a logo: azul `#0d3444` e ocre `#de8e32`, fonte Manrope, responsivo.
- Financeiro identifica cada lançamento por **empreendimento → unidade → cliente**.
- E-mail de "contrato pronto" vai para o responsável, em três degraus: e-mail digitado no formulário, depois o cadastro do usuário, depois os admins (com uma tarja explicando o porquê).
- Contrato de Compra e Venda: as cláusulas 1.4 (fração ideal) e 3.2 (custo de construção) viraram placeholders, porque antes saíam como `R$XXXXXXX`.
- Tela de Contratos com os 5 modelos reais (Permuta e Reserva saíram porque não existe modelo deles). Se o catálogo divergir dos modelos, o sistema nem sobe.
- SCP: as marcações `{{...}}` do modelo foram convertidas, a tabela "Condições e prazos" agora sai das parcelas, e o roteamento do formulário foi corrigido.
- `atualizarFormulario()` no Apps Script (não cria tudo de novo; pode rodar várias vezes).
- Manuais do sistema e do formulário, mais o checklist de entrega, também em Word.

**13/10/2026.**
- Termo de Quitação e Distrato convertidos em modelos (59 trocas, sem sobrar nenhum dado real) e gerados pelo sistema. Dados bancários, telefone, nome fantasia e qualificação do sócio passaram para o cadastro do empreendimento ("Dados usados nos termos").
- Status `cancelado` em contratos e lançamentos.
- A qualificação do comprador (nacionalidade, estado civil, RG, endereço, cônjuge) passou a ser guardada no cliente e foi recuperada dos logs antigos. A tela do cliente ganhou esses campos.
- **CNPJ do High Tower corrigido** (commit `26cadbc`): de `46.625.994/0001-32` para `62.255.242/0001-83`, Rua Flor de Noiva S/N, CEP 29190-359. São duas SPEs reais do grupo; o `46` é da Flor do Guarujá SPE.
- Os 7 documentos numa lista só, com os botões de encerramento mantidos no cabeçalho da operação.

**25/10/2026 — mudança de rumo.** O cliente reclamou, por áudios ao Léo, que o formulário pede tudo de novo mesmo com o cliente já cadastrado. Avaliação feita:
- Google Forms + n8n serviu para sair rápido, mas tinha cerca de 120 perguntas, dados em dois lugares, vínculo pelo título exato da pergunta e limite de 5 parcelas.
- No Render gratuito o banco volta ao do git a cada reinício ou deploy, ou seja, **o cliente testou um sistema que esquece tudo**.

Decisão: **todos os documentos saem de um formulário interno**, em JavaScript na mesma base (Python foi descartado). Feito em 3 commits, que foram para o GitHub às 17:36 do mesmo dia (o resumo da sessão disse "sem push", e estava errado). O formulário interno está no ar no Render:

- `3739aeb` — a unidade guarda vagas, áreas, fração ideal e planta.
- `ea6f30a` — a emissão virou o serviço `services/emissao.js`, compartilhado com o webhook (resultado idêntico ao anterior).
- `8b7c49b` — formulário interno. "Preencher formulário" virou **Preencher**; documento gerado ganhou **Corrigir**.

Como funciona o formulário interno:
- É por operação (cliente + unidade) e só mostra as seções dos documentos marcados.
- Os dados do comprador vêm do cadastro, e a correção feita ali volta para o cadastro.
- Unidade, extensos e percentuais são automáticos, e o responsável é quem está logado.
- Falta de campo obrigatório bloqueia e mantém o que já foi digitado. CPF inválido ou parcelas que não somam o preço só geram aviso.
- Gerar de novo substitui o arquivo e as parcelas, sem duplicar. O formulário reabre com o último preenchimento.
- Testes: 40 na lógica, 30 de ponta a ponta, e conferência no navegador em 1280px e 390px.
- De passagem, corrigi a unidade por extenso que saía em branco no Termo de Anuência e a data do compromisso no Termo de Empréstimo.

**26/10/2026 — banco pronto para o disco e backup.** Ainda sem disco contratado:
- Com `DADOS_DIR`, a primeira subida copia o `imobiliaria.db` do repositório para o disco; depois disso, publicar não toca mais nos dados. O banco não precisa sair do git para a virada.
- Tela **Backup** (só admin): baixar um `.zip` com o banco e os documentos; guardar uma cópia no servidor; restaurar com confirmação. Antes de restaurar, guarda o estado atual. Aceita backup de versão anterior do sistema e recusa arquivo inválido, banco sem administrador e `../` dentro do zip.
- Cópia automática diária em `DADOS_DIR/backups`, mantendo as últimas 14.
- Defeito antigo corrigido: `Statement.get()` do `node-sqlite3-wasm` deixava a consulta aberta, e o sistema sempre tinha uma leitura do banco "em andamento". O `get()` agora reinicia a consulta depois de ler (no `database.js`).
- Testes: 28 verificações de backup por HTTP, com disco descartável, e os 125 testes do formulário interno passando de novo.
- `docs/virada-para-producao.md` e o checklist reescritos para o novo caminho.

## 5. Cuidados técnicos

- **Não dar push sem o Marcelo pedir.** Sem disco, cada deploy ou reinício no Render gratuito volta o banco para a versão do repositório.
- A virada para o disco está em `docs/virada-para-producao.md`: baixar o backup, contratar o disco, definir `DADOS_DIR=/var/data` e restaurar.
- `node-sqlite3-wasm` grava direto no arquivo e só aceita um processo por vez. Rodar um script no banco com o servidor ligado dá `database is locked` e derruba o servidor. Um processo que morre deixa a trava `<banco>.lock` (uma pasta), que precisa ser apagada.
- Testes que dão `require('./database')` sem `DB_PATH` abrem o banco do projeto. Sempre passar `DB_PATH` e `STORAGE_DIR` (ou `DADOS_DIR`) apontando para uma cópia descartável.
- Consultas preparadas que nunca recebem `finalize()` continuam ocupando memória; o `get()` corrigido só resolve a parte da leitura aberta.
- Express 5: `req.body` é `undefined` num POST sem corpo.
- Em `.docx` o texto vem quebrado em vários pedaços de XML. A regex certa para a tag de texto é `<w:t(?:\s[^>]*)?>`, porque `<w:t[^>]*>` também pega `<w:tbl>` e `<w:tab/>`.
- Arquivos grandes: usar a ferramenta Write; o heredoc no bash quebra.
- CSS: `[hidden]` perde para uma classe com `display:flex`.
- Ajustes de tela só aparecem conferindo no navegador; vários defeitos só foram pegos assim.

## 6. Custos (set/2026)

| Item | Custo |
|---|---|
| Render Starter | US$ 7,00/mês |
| Disco persistente | US$ 0,25/GB/mês |
| n8n Cloud Starter | US$ 24/mês (deixa de ser necessário com o formulário interno) |

Com o formulário interno, o total fica em cerca de **US$ 7,25/mês**. O cliente vai pagar, mas só depois de validar. Por enquanto o Marcelo não tem como pagar.

**26/10/2026 — ajustes no Contrato de Promessa** (`3d0ef17`): intermediadora opcional (o bloco some quando não há); item II e cláusula 3 viraram dados do empreendimento (`services/incorporacao.js`), que o admin edita e o corretor só vê; observações do pagamento a partir da 2), uma por linha.

**29/10/2026 — hospedagem.** Decidido: a De Marchi cria um Gmail exclusivo do sistema e a conta do Render com ele, cadastra o cartão e envia os acessos. O plano Hobby do Render não aceita membros (Pro custa US$ 25/mês), por isso o acesso é pelo login da conta. O Render não transfere serviço entre contas: o sistema é criado de novo na conta deles e os dados vêm pela tela de Backup. O n8n sai; os avisos de contrato passam a ser enviados pelo próprio sistema, com os documentos anexados, para quem gerou e para todos os admins (campo "Recebe aviso em"). PDF enviado ao cliente: `docs/Hospedagem do Sistema De Marchi.pdf`.

## 7. O que falta, por fase

### Fase 1 — agora, sem depender do cliente
1. **Avisos de contrato por e-mail, com anexos** (prometido no PDF). Envio por SMTP do Gmail com senha de app; para quem gerou e para todos os admins com "Recebe aviso em"; falha no e-mail não impede a geração e aparece na tela. Testar com um Gmail de teste.
2. **Cônjuge opcional de verdade** no Contrato de Promessa: o bloco sai com rótulos vazios quando não há cônjuge.
3. **Cláusula 1.3**: descreve o terreno com texto fixo (lotes 6 e 8, Rua Flor do Guarujá nº 47, matrícula 22.074). Ligar aos dados da incorporação ou confirmar com o cliente.
4. **Finalizar consultas preparadas** do SQLite (vazamento de memória; tarefa separada já sugerida).

### Fase 2 — quando a De Marchi enviar os acessos
1. Antes de tudo, baixar o backup do Render atual (o gratuito pode zerar a qualquer momento).
2. Na conta deles: criar o Web Service ligado ao GitHub, plano Starter, disco em `/var/data`.
3. Variáveis: `DADOS_DIR=/var/data`, `NODE_ENV=production`, `SESSION_SECRET` e `APP_SENHA` novos, e as do e-mail (Gmail + senha de app).
4. Senha de app do Gmail: precisa de 2 minutos com quem recebe o código de verificação na De Marchi.
5. Restaurar o backup pela tela, reiniciar o serviço e conferir que os dados ficam.
6. Gerar um contrato de teste e conferir os dois e-mails com anexos.
7. Avisar o Léo: sistema pronto e **n8n pode ser cancelado**.
8. Desligar o serviço antigo na conta do Marcelo.

### Fase 3 — dados que o cliente precisa passar
1. Dados da incorporação do High Tower (registro, patrimônio de afetação, endereço do imóvel, alvará, data de entrega, data do orçamento, tipo padronizado, áreas sub-rogadas). **Sem eles o Contrato de Promessa não gera.**
2. Características de cada unidade do High Tower (tipo, vagas, áreas, fração ideal, planta).
3. "Dados usados nos termos" do empreendimento (banco, agência, conta, PIX, telefone, sócio) e e-mail de cada admin em `/usuarios`.
4. Conferir a qualificação dos clientes antigos (pode ter lixo de testes).

### Fase 4 — perguntas jurídicas (lembrar sempre)
1. Conta bancária do High Tower: Compra e Venda traz a `00003362-2` da Flor do Guarujá SPE; SCP e Distrato usam a `574637521-3` do High Tower.
2. Procurador do Termo de Anuência: o modelo cita a Flor do Guarujá SPE.
3. NIRE `32202941759` aparece com dois CNPJs.
4. Cláusula 3.3: áreas sub-rogadas são as unidades do dono do terreno, não a unidade comprada? (foi assim que ficou)
5. Pessoa jurídica: os modelos não têm lugar para o representante legal.
6. SCP: o "valor do aporte" é o total ou só a entrada?
7. Distrato só cobre SCP; precisa de um para compra e venda?
8. Modelos de Permuta e Reserva não existem.
9. Validação jurídica dos 7 modelos.

### Fase 5 — entrega final
1. **Manual único** (parte do corretor e parte do admin), substituindo `manual-do-sistema.md` e `manual-do-formulario.md`, que ainda descrevem o Google Forms.
2. Aposentar no código o webhook do n8n, `n8n/` e `forms/` (depois que os avisos estiverem no ar).
3. Trocar o `imobiliaria.db` versionado por um banco limpo e limpar o histórico do git (tem dados de teste).
4. Repositório para a organização da EJOTA no GitHub e repontar o Render.
5. Usuários reais criados, `admin` genérico desativado.
6. Combinar quem baixa o backup toda semana.
7. Treinamento rápido e aceite. A De Marchi troca as senhas do Gmail e do Render.
