# Checklist de entrega

O sistema funciona. O que falta para **entregar** é diferente do que faltou
para construir: hoje quase tudo está em contas pessoais, e entregar significa
passar a chave junto com a porta.

Este documento lista o que precisa mudar de dono, o que precisa ser decidido
com o cliente, e em que ordem.

---

## O problema central

| Peça | Está em | Deveria estar em |
|---|---|---|
| Código (GitHub) | conta pessoal do Marcelo | organização da EJOTA, com cópia para a De Marchi |
| Hospedagem (Render) | conta pessoal do Marcelo | conta da De Marchi, que vai pagar |
| Automação (n8n) | instância do Marcelo | instância da De Marchi |
| Formulário e planilha (Google) | conta pessoal do Marcelo | conta Google da De Marchi |
| E-mail de aviso (Gmail) | conta pessoal do Marcelo | e-mail da De Marchi |
| Assinatura (Autentique) | conta da De Marchi | já está certo |

Enquanto isso não mudar, **o sistema depende de uma pessoa física continuar
existindo naquelas contas**. Se o Marcelo sair da EJOTA, o cliente perde tudo
sem que ninguém tenha feito nada errado.

Há também um detalhe que aparece na primeira semana de uso: **os e-mails de
contrato pronto saem do Gmail pessoal do Marcelo.** O corretor da De Marchi
recebe um aviso de contrato vindo de um endereço que não é da empresa.

---

## 1. Código — GitHub

**Hoje:** `marcelohenrique10/sistema-contratos-imobiliaria`, conta pessoal.

Sua ideia de criar uma organização para a EJOTA está certa. Vale separar duas
perguntas que costumam ser confundidas:

- **Quem mantém o código?** A EJOTA. Organização própria, com os membros do
  time como colaboradores.
- **Quem é dono do código?** Depende do contrato com a De Marchi. Se o contrato
  prevê cessão de direitos, o cliente precisa receber uma cópia — no mínimo, um
  repositório espelho na conta dele.

**Passos**

- [ ] Criar a organização no GitHub para a EJOTA
- [ ] Transferir o repositório (Settings → Transfer ownership) — preserva
      histórico, issues e a URL antiga redireciona
- [ ] Adicionar os membros do time com permissão adequada
- [ ] Conferir o contrato: a De Marchi tem direito a uma cópia do código?
- [ ] Se sim, criar o repositório na conta dela e enviar o histórico
- [ ] **Repontar o Render para o repositório novo** (ele fica preso ao antigo)

> **Antes de transferir:** conferir se não há segredo commitado. O `.env` está
> no `.gitignore`, mas vale rodar uma busca por senha e token no histórico.

---

## 2. Hospedagem — Render

**Hoje:** conta pessoal do Marcelo, plano gratuito.

O plano gratuito tem duas limitações que importam:

- o serviço **hiberna** após 15 minutos sem uso (a primeira visita demora ~30s)
- o disco é apagado a cada reinício

**Passos**

- [ ] A De Marchi cria a conta própria no Render
- [ ] Criar o serviço lá, apontando para o repositório da EJOTA
- [ ] Copiar todas as variáveis de ambiente (ver seção 6)
- [ ] Contratar o plano pago e o disco — **ver seção 5, isto não é opcional**
- [ ] Confirmar que o serviço novo responde antes de desligar o antigo
- [ ] Desligar o serviço da conta do Marcelo

> Alternativa: manter na conta da EJOTA e repassar o custo. Funciona, mas
> mantém a dependência. Decisão comercial, não técnica.

---

## 3. Automação — n8n

**Hoje:** instância do Marcelo. É a peça mais trabalhosa de mover, porque
carrega três credenciais.

**Passos**

- [ ] Decidir onde o n8n vai rodar: n8n Cloud (pago, mais simples) ou
      auto-hospedado (mais barato, exige manutenção)
- [ ] Criar a instância na conta da De Marchi
- [ ] Importar o `n8n/producao-render.json`
- [ ] Recriar as três credenciais **na conta da De Marchi**:
  - [ ] Google Sheets Trigger (OAuth, na conta Google dela)
  - [ ] Gmail (OAuth, no e-mail dela — resolve o problema do remetente)
  - [ ] Header Auth com o `WEBHOOK_SECRET` de produção
- [ ] Apontar o gatilho para a planilha de respostas dela
- [ ] Publicar o workflow
- [ ] Rodar uma resposta de teste ponta a ponta
- [ ] Desativar o workflow na instância do Marcelo

> Não existe exportação de credenciais no n8n, e isso é proposital. As três
> precisam ser criadas de novo, autenticando com as contas do cliente.

---

## 4. Formulário e planilha — Google

**Hoje:** conta pessoal do Marcelo.

**Passos**

- [ ] Transferir a propriedade do formulário para a conta Google da De Marchi
      (Google Forms → ⋮ → Adicionar colaboradores → transferir propriedade)
- [ ] Transferir a planilha de respostas junto
- [ ] Transferir o projeto do Apps Script, ou recriá-lo na conta dela
- [ ] Reconfigurar `URL_FORM`, `URL_APP` e `TOKEN_APP` nas Propriedades do script
- [ ] Conferir se o link público do formulário mudou — se mudou, atualizar a
      variável `FORM_URL` no Render
- [ ] Rodar `verificarDocumentosOferecidos()` para confirmar que veio inteiro

> Transferência de propriedade no Google exige que as duas contas sejam do
> mesmo domínio Workspace **ou** que a conta de destino aceite o convite. Se a
> De Marchi usa Gmail comum, funciona; se usa Workspace com restrição, pode
> ser preciso recriar com `criarFormularioContratual()`.

---

## 5. Banco de dados — respondendo a dúvida

**Pagar o Render, sozinho, não resolve.** São três coisas separadas:

| | O que resolve | O que não resolve |
|---|---|---|
| Plano pago | o serviço para de hibernar | os dados continuam sendo sobrescritos |
| Disco | os arquivos sobrevivem a reinício | nada, se o sistema não apontar para ele |
| Tirar o banco do git | os dados param de ser sobrescritos a cada publicação | — |

Hoje o `imobiliaria.db` **está dentro do repositório**, de propósito: em fase
de teste, cada publicação restaura a base de demonstração. Isso significa que,
do jeito que está, **todo deploy apaga o que o cliente cadastrou**.

Depois dos três passos abaixo, os dados ficam fixos: publicar código não toca
mais neles.

- [ ] Contratar o plano pago (US$ 7/mês) e adicionar um disco em `/var/data`
- [ ] Definir a variável `DADOS_DIR=/var/data`
- [ ] Tirar o banco do versionamento:
      ```bash
      git rm --cached imobiliaria.db
      echo "imobiliaria.db" >> .gitignore
      git commit -m "Banco sai do versionamento" && git push
      ```
- [ ] Tirar também os documentos de demonstração que foram forçados para o git
      (`storage/documentos/high-tower/contratos/*.docx`)
- [ ] Confirmar que o serviço subiu com o banco no disco e não perdeu dado numa
      segunda publicação

**Quando fazer:** no dia em que alguém cadastrar uma venda de verdade. Nem
antes nem depois. O detalhamento está em [virada para produção](virada-para-producao.md).

**Sobre backup:** o disco protege contra reinício, não contra apagar sem
querer. Backup continua sem dono — precisa ser decidido, não é algo que o
código resolva.

---

## 5b. Quanto o cliente vai pagar por mês

Verificado em setembro de 2026. Confirme antes de fechar com o cliente — preço
de nuvem muda.

| Item | Custo | Obrigatório? |
|---|---|---|
| Render — instância Starter | US$ 7,00 / mês | sim, para ter disco e não hibernar |
| Render — disco persistente | US$ 0,25 / GB / mês (1 GB basta) | sim |
| n8n Cloud — plano Starter | US$ 24,00 / mês (US$ 20 no anual) | uma das duas opções |
| n8n auto-hospedado | software grátis + US$ 4 a 7 / mês de servidor | uma das duas opções |
| Google Forms e Planilhas | grátis | — |
| Autentique | já contratado pela De Marchi | — |

**Duas contas fechadas:**

- Com n8n Cloud: **≈ US$ 31 / mês**
- Com n8n auto-hospedado: **≈ US$ 12 a 14 / mês**

O disco **é cobrado à parte** da instância, e não existe no plano gratuito.
Mas é barato: 1 GB por US$ 0,25 guarda o banco e alguns milhares de contratos.
A cobrança é proporcional ao tempo de uso.

A escolha entre n8n Cloud e auto-hospedado é sobre quem faz manutenção. O Cloud
custa o dobro do conjunto todo, mas ninguém precisa cuidar de atualização,
backup nem servidor. O auto-hospedado economiza uns US$ 19 por mês e cria uma
segunda coisa para manter — vale a pena se a EJOTA for continuar dando suporte.

O plano Starter do n8n Cloud dá 2.500 execuções mensais. Uma resposta do
formulário é uma execução, então a folga é grande para o volume da De Marchi.
Verificação sem resposta nova normalmente não conta como execução — confirme
com o n8n se o volume ficar próximo do limite.

> **Efeito colateral do disco:** um serviço com disco não faz publicação sem
> interrupção. O Render derruba a instância antiga antes de subir a nova, e o
> sistema fica fora do ar por alguns segundos a cada deploy. Irrelevante para
> uso interno, mas precisa ser dito.

---

## 6. Variáveis de ambiente

O serviço novo precisa de todas. As marcadas com ⚠️ **devem ser diferentes** das
de desenvolvimento.

| Variável | O que é |
|---|---|
| `NODE_ENV` | `production` — faz o cookie de sessão exigir HTTPS |
| `SESSION_SECRET` ⚠️ | assina o cookie. Trocar desconecta todo mundo |
| `WEBHOOK_SECRET` ⚠️ | precisa ser idêntico ao configurado no n8n |
| `APP_SENHA` ⚠️ | senha do primeiro administrador |
| `APP_ADMIN_EMAIL` | para onde vai o aviso quando o responsável não é reconhecido |
| `DADOS_DIR` | `/var/data`, depois do disco contratado |
| `FORM_URL` | endereço público do formulário |
| `FORM_ENTRY_*` | identificadores dos campos, para o link pré-preenchido |

Gerar segredos novos:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] Todas as variáveis configuradas no serviço novo
- [ ] `WEBHOOK_SECRET` idêntico no Render e na credencial do n8n
- [ ] Segredos de produção **diferentes** dos de desenvolvimento

---

## 7. Contas de acesso

- [ ] Criar um administrador para cada uma das duas pessoas da De Marchi
- [ ] Criar um corretor para cada corretor, com o **e-mail como login**
- [ ] Entregar login e senha a cada pessoa (a senha aparece uma vez só)
- [ ] Conferir a coluna "Recebe aviso em" — ninguém pode estar com "nenhum"
- [ ] **Desativar o usuário `admin` genérico**
- [ ] Confirmar que um corretor não enxerga Financeiro nem Usuários

---

## 8. Dados reais

- [ ] Apagar os clientes, contratos e documentos de demonstração
- [ ] Cadastrar o empreendimento real com **todos** os campos preenchidos:
      razão social, CNPJ, endereço, CEP, sócio administrador, e-mail
- [ ] Cadastrar as unidades reais
- [ ] Conferir o espelho contra a tabela de vendas da De Marchi

---

## 9. Pendências que o cliente precisa decidir

Estas não são tarefas de programação — são informações ou decisões que só a
De Marchi pode dar.

- [ ] **Dados bancários fixos nos modelos.** Os contratos trazem banco, agência,
      conta e chave PIX escritos direto no arquivo. O Contrato de Compra e Venda
      e o Termo SCP trazem **contas diferentes** — confirmar qual é a correta em
      cada caso. Enquanto forem fixos, o sistema não pode gerar contrato de um
      segundo empreendimento.
- [ ] **Chave PIX do SCP** (`62 255.242/0001-83`) não corresponde ao CNPJ do
      High Tower (`46.625.994/0001-32`). Confirmar.
- [ ] **Intermediadora fixa no modelo.** O contrato traz "VMC FERREIRA
      CORRETORA DE IMÓVEIS" com CNPJ e CRECI escritos no arquivo, mesmo quando o
      formulário informa outra.
- [ ] **RG e CPF do sócio administrador** estão fixos no modelo. Correto
      enquanto for sempre o Alcides.
- [ ] **Modelos que não existem:** Permuta e Reserva. Se forem necessários, o
      cliente precisa fornecer os arquivos `.docx`.
- [ ] **Validação jurídica dos cinco modelos** por quem responde por isso na
      De Marchi.
- [ ] **Backup:** quem faz, com que frequência, para onde.

---

## 10. Entrega formal

- [ ] Entregar o [manual do sistema](manual-do-sistema.md) e o
      [manual do formulário](manual-do-formulario.md)
- [ ] Treinamento com os corretores (o formulário e a tela de contratos)
- [ ] Treinamento com os administradores (financeiro, usuários, empreendimentos)
- [ ] Combinar o período de suporte: até quando a EJOTA responde, e por qual canal
- [ ] Registrar quem é o responsável técnico depois da entrega
- [ ] Termo de aceite assinado

---

## Ordem sugerida

A ordem importa: mover a hospedagem antes do código dá retrabalho, e trocar
segredo depois do n8n publicado derruba a integração.

```
1. GitHub          organização da EJOTA, repositório transferido
2. Google          formulário e planilha na conta do cliente
3. Render          serviço novo na conta do cliente, apontando para o GitHub novo
4. Banco           plano pago + disco + banco fora do git
5. n8n             instância do cliente, credenciais novas, apontando para o Render novo
6. Acessos         usuários reais, admin genérico desativado
7. Dados           demonstração fora, dados reais dentro
8. Entrega         manuais, treinamento, aceite
```

Entre o 5 e o 6, rode uma operação completa de verdade: preencher o formulário,
ver o documento chegar, conferir o e-mail e baixar o arquivo. É o único teste
que prova que a corrente inteira está ligada nas contas certas.
