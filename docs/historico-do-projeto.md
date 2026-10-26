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

## 7. O que falta

**Técnico**
1. Push, só quando o Marcelo pedir.
2. Contratar o disco e fazer a virada (o código está pronto; ver `docs/virada-para-producao.md`). Combinar quem baixa o backup toda semana.
3. Cadastrar as unidades do High Tower (vagas, áreas, fração ideal, planta).
4. Aposentar o webhook, o n8n e o Google Forms depois que o cliente validar. Hoje continuam funcionando, só sem link na tela.
5. Atualizar `manual-do-sistema.md` e `manual-do-formulario.md`, que ainda descrevem o Google Forms.
6. Preencher em `/empreendimentos` → High Tower os "Dados usados nos termos", e o e-mail do `admin` em `/usuarios`.
7. Conferir a qualificação recuperada dos clientes antigos, que pode ter vindo com lixo de testes.

**Entrega** (`docs/checklist-de-entrega.md`): GitHub da EJOTA, contas Google, Render e e-mail no nome da De Marchi, troca de senhas e segredos, e tirar o `imobiliaria.db` do histórico do git (tem dados pessoais de compradores).

**Só o cliente responde** (lembrar sempre):
1. Conta bancária do High Tower: o Compra e Venda traz fixa a conta `00003362-2` da Flor do Guarujá SPE, enquanto o SCP e o Distrato usam a `574637521-3` do High Tower.
2. Procurador do Termo de Anuência: o modelo cita a Flor do Guarujá SPE.
3. NIRE `32202941759` aparece com dois CNPJs diferentes.
4. Intermediadora VMC Ferreira está escrita fixa no Compra e Venda.
5. Modelos de Permuta e Reserva não existem.
6. Pessoa jurídica: os modelos não têm lugar para o representante legal.
7. SCP: o "valor do aporte" é o total ou só a entrada?
8. Validação jurídica dos 7 modelos.
