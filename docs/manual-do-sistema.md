# Manual do sistema

Sistema de contratos da De Marchi Incorporadora. Este documento explica o que
cada tela faz, para que serve e como usar no dia a dia.

Para o formulário de coleta de dados, veja o
[manual do formulário](manual-do-formulario.md).

---

## O que o sistema resolve

Antes, cada contrato era um arquivo do Word aberto a partir de um anterior,
com os dados trocados à mão. Isso custa tempo e erra: sobra o nome do cliente
anterior, falta um campo, o valor por extenso não bate com o número.

Aqui o caminho é outro:

```
Formulário preenchido  ->  n8n  ->  Sistema  ->  Documento .docx pronto
                                       |
                                       +->  Cliente cadastrado
                                       +->  Unidade marcada como negociação
                                       +->  Parcelas no financeiro
                                       +->  E-mail para quem preencheu
```

Uma resposta do formulário produz o documento, o cadastro do cliente, a baixa
da unidade no espelho e o cronograma de recebimentos. Ninguém digita a mesma
informação duas vezes.

---

## Quem enxerga o quê

Há dois papéis. Cada pessoa tem login próprio — não existe login compartilhado.

| | Corretor | Administrador |
|---|---|---|
| Espelho de vendas | sim | sim |
| Clientes | sim, mas telefone e e-mail só dos clientes que ele mesmo cadastrou | sim, tudo |
| Contratos e documentos | sim | sim |
| Empreendimentos | sim | sim |
| Financeiro | **não** | sim |
| Usuários | **não** | sim |

O corretor vê a lista inteira de clientes para não reservar uma unidade de
alguém sem saber. Mas o contato — telefone e e-mail — fica escondido para os
clientes que ele não trouxe. Carteira de um não é carteira do outro.

A sessão do corretor dura 30 dias (ele usa no celular, em campo). A do
administrador dura 12 horas, porque mexe em dinheiro.

**Desativar um usuário derruba a sessão dele na hora.** Não precisa esperar
expirar. O papel é lido do banco a cada requisição.

---

## As telas

### Dashboard
*Só administradores.*

Visão geral: quantos empreendimentos, clientes e contratos existem, e os três
números do financeiro — recebido, a vencer, atrasado. Serve para bater o olho
e saber se tem algo pendente.

### Espelho de vendas

O mapa das unidades. Cada card é uma unidade, com a cor dizendo a situação:

| Cor | Situação | O que significa |
|---|---|---|
| Verde | Livre | Disponível para reservar |
| Amarelo | Negociação | Reservada ou com contrato em andamento |
| Vermelho | Vendido | Fechada |
| Cinza | Permutado / Cancelado | Fora do estoque de venda |

**Para reservar:** clique na unidade livre e escolha o cliente. O cliente
precisa já estar cadastrado — a reserva liga uma coisa à outra, e não dá para
ligar a um nome que não existe.

Ao reservar, a unidade passa a **negociação** e o cliente fica associado a ela.
Ao liberar, os dois voltam a ficar soltos. Essa associação aparece também na
aba de Clientes.

**Quem reservou pode liberar.** Um corretor não desfaz a reserva de outro —
isso é disputa de comissão. O administrador libera qualquer uma.

Unidade que já tem contrato não pode ser liberada. Cancele os contratos antes.

Os filtros no topo (situação e pavimento) mostram a contagem sobre o total, não
sobre o que está filtrado — assim dá para saber quanto sobrou.

### Clientes

Cadastro de quem compra. Pode ser preenchido à mão ou vir do formulário.

CPF e CNPJ são formatados na entrada: digite só os números que o sistema põe a
pontuação. E ele não deixa cadastrar duas vezes a mesma pessoa — a comparação é
feita só pelos dígitos, então `805.337.194-60` e `80533719460` são a mesma.

O campo **unidade** é preenchido pela reserva, não à mão.

### Contratos

O centro da operação. Cada bloco é uma **operação**: um cliente, uma unidade, e
os documentos daquela venda.

**Para iniciar:** escolha cliente, empreendimento, unidade e marque os
documentos. Existem cinco modelos, e três atalhos para os conjuntos mais
pedidos:

- **Compra e Venda (3)** — Contrato + Anexo + Termo de Anuência
- **Compra e Venda com financiamento (4)** — os três acima + Termo de Ciência
  e Anuência para Empréstimo
- **Adesão à SCP (1)** — Termo de Adesão Preliminar

Os atalhos apenas marcam as caixas. Depois de clicar, dá para desmarcar ou
acrescentar o que quiser — inclusive marcar um documento sozinho.

Marcar um documento que já existe naquela operação **não duplica**: ele é
acrescentado à operação em andamento, e a tela avisa o que já existia.

Cada documento tem uma situação:

| Situação | O que está acontecendo | Próximo passo |
|---|---|---|
| **Aguardando** | O documento foi previsto, mas ninguém preencheu o formulário | Enviar o link do formulário, ou anexar o documento assinado |
| **Em preenchimento** | O formulário chegou e o documento está sendo montado | Esperar (é questão de segundos) |
| **Gerado** | Pronto, criado pelo sistema | Baixar e enviar para assinatura |
| **Anexado** | Enviado pela equipe, não gerado aqui | Nada |

Cada linha tem o **link do formulário já preenchido** com empreendimento,
unidade e tipo de documento — quem recebe só completa os dados do comprador.

O botão **Acessar Autentique** leva à plataforma de assinatura.

### Documentos

Todos os arquivos, gerados e anexados, num lugar só. Use para achar um
documento antigo sem precisar lembrar de qual operação ele era.

**Enviar documento** serve para anexar um arquivo que veio de fora — um
contrato assinado, uma procuração. Ele passa a contar como cumprido na
operação.

### Empreendimentos

Cadastro dos empreendimentos e das unidades.

Os dados aqui **entram nos contratos**. Razão social, CNPJ, endereço, CEP,
sócio administrador e e-mail aparecem na qualificação da vendedora. Campo vazio
aqui vira campo vazio no contrato — e o e-mail de aviso denuncia isso.

Dentro de cada empreendimento dá para cadastrar unidades uma a uma ou em lote
(informando faixa de pavimentos e quantidade por pavimento).

### Financeiro
*Só administradores.*

As parcelas de cada venda. Elas nascem sozinhas quando um Contrato de Promessa
de Compra e Venda é gerado: o parcelamento informado no formulário vira um
lançamento por parcela, com a data de vencimento calculada mês a mês.

Cada lançamento identifica **empreendimento, unidade e cliente** — empreendimento
sozinho não diz de quem é o pagamento.

Três situações, calculadas pela data, nunca desatualizadas:

- **A vencer** — ainda no prazo
- **Atrasado** — venceu e não foi confirmado
- **Recebido** — confirmado em caixa

Só o que foi **confirmado** entra no total recebido. Confirmar é um clique em
cada linha; dá para desfazer.

O **lançamento manual** serve para entradas avulsas que não vêm de contrato.
Escolhendo a unidade, o empreendimento e o cliente são preenchidos sozinhos.

### Usuários
*Só administradores.*

Criação de contas. Você define o login e a senha e entrega prontos — não existe
cadastro por conta própria.

**A senha aparece uma única vez**, logo depois de criar. O sistema guarda só o
embaralhado, então não há como consultá-la depois. Se perder, gere outra.

O **login é o e-mail** da pessoa: é para lá que vai o aviso de contrato pronto.
A coluna "Recebe aviso em" mostra o endereço que será usado. Se aparecer
"nenhum" em vermelho, preencha o campo de e-mail ali mesmo.

---

## Como o documento chega até aqui

1. Alguém preenche o formulário do Google
2. A resposta cai numa planilha
3. O n8n percebe a linha nova (verifica a cada minuto)
4. O n8n manda os dados para o sistema, em quatro etapas:
   - cria o cliente (ou reaproveita, se o CPF já existe)
   - cria o contrato
   - gera o documento a partir do modelo `.docx`
   - dispara o e-mail de aviso
5. O sistema registra as parcelas no financeiro

**Reenviar a mesma resposta não duplica nada.** Cada resposta tem um
identificador (o carimbo de data/hora); se ela já foi processada, o sistema
devolve o documento que já existia.

### O e-mail de aviso

Chega para quem preencheu o formulário, no endereço informado ali. Se o campo
vier vazio, o sistema usa o e-mail do cadastro da pessoa; se não achar, manda
para os administradores e diz por quê.

O e-mail traz o tipo de documento, cliente, empreendimento, unidade, o link
para abrir o arquivo — e, quando é o caso, **a lista dos campos que ficaram em
branco**. Documento com buraco continua parecendo pronto; esse aviso é o que
faz alguém notar.

Assunto começando com `[CONFERIR]` significa exatamente isso: tem campo vazio.

---

## Perguntas que aparecem

**Gerei o documento e um campo está vazio. Por quê?**
Ou o formulário não foi preenchido naquele ponto, ou o dado é do cadastro do
empreendimento e está faltando lá. O e-mail diz qual campo é. Nomes começando
com `EMPREENDIMENTO_` vêm da tela de Empreendimentos, não do formulário.

**Preciso de um contrato que não está na lista.**
Só existem os cinco modelos com arquivo `.docx` cadastrado. A tela não oferece
tipo sem modelo de propósito: antes ela oferecia "Permuta" e "Reserva", e os
contratos criados assim ficavam pendentes para sempre porque não havia como
montá-los.

**O cliente já preencheu o formulário antes de eu abrir a operação.**
Sem problema. Ao criar a operação, o sistema procura documentos já gerados para
aquele cliente e aproveita, em vez de deixar pendente à toa.

**Posso apagar um contrato?**
Sim, pelo botão Excluir na linha. O arquivo gerado continua em Documentos.

**Esqueci minha senha.**
Um administrador gera outra em Usuários. Não há como recuperar a antiga.

---

## Limites conhecidos

Coisas que valem saber antes de tropeçar nelas:

- **Os dados bancários e o NIRE estão fixos nos modelos.** Um segundo
  empreendimento geraria contrato com a razão social certa e a conta bancária
  do High Tower. Antes de usar o sistema para outro empreendimento, esses
  blocos precisam virar campos.
- **Não existe modelo para Permuta nem para Reserva.**
- **O banco de dados vai junto com o código.** Cada publicação sobrevive, mas
  o plano atual da hospedagem não guarda arquivo entre reinícios — documentos
  gerados em produção podem sumir. Ver
  [virada para produção](virada-para-producao.md).
- **Os documentos saem em `.docx`**, com os campos preenchidos em vermelho para
  facilitar a conferência. Ver [PDF e Word](pdf-e-word.md).
