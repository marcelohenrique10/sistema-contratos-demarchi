# Manual do formulário

O formulário é o único lugar onde os dados de uma operação são digitados. O que
sai dele vira contrato, cadastro de cliente, baixa da unidade no espelho e
parcelas no financeiro.

Para as telas do sistema, veja o [manual do sistema](manual-do-sistema.md).

---

## Antes de começar

**Pegue o link pela tela de Contratos.** Em cada documento aguardando há um
link que já vem com empreendimento, unidade e tipo de documento preenchidos.
Quem recebe só completa os dados do comprador — e não erra o empreendimento.

O link solto também funciona, mas aí tudo é digitado do zero.

**O formulário se adapta.** Ele não mostra as mesmas perguntas para todo mundo:
depende do tipo de contratante, do documento escolhido e da forma de pagamento.
Responder "Pessoa jurídica" pula as perguntas de estado civil; escolher um
Termo pula as perguntas de preço.

---

## O caminho, seção por seção

```
1. Dados gerais
      |
2. Contratante ---- pessoa física --> 3. Dados do comprador --- tem cônjuge? --> 5. Cônjuge
      |                                                              |                |
      +---------- pessoa jurídica --> 4. Dados da empresa            +----------------+
                                              |                                       |
                                              +------> 6. Unidade e documento <-------+
                                                              |
              +-----------------------------------------------+--------------------+
              |                    |                   |                           |
   Compra e Venda            Anexo /            Empréstimo                       SCP
              |              Anuência                 |                           |
      7. Preço                   |             9. Empréstimo              10. Dados da SCP
              |                  |                    |                           |
   parcelado? --> 8. Parcelamento|                    |                8. Parcelamento
              |                  |                    |                           |
              +------------------+--------------------+---------------------------+
                                             |
                                   11. Intermediação --- sim --> 12. Dados da intermediadora
                                             |                              |
                                             +------------------------------+
                                             |
                                   13. Testemunhas  ->  14. Observações  ->  enviar
```

---

## Seção 1 — Dados gerais

Todo mundo passa por aqui.

| Pergunta | Cuidado |
|---|---|
| Empreendimento | Escolha da lista. Se o nome não estiver lá, cadastre no sistema antes — o sistema **recusa** empreendimento que não conhece, para não gerar contrato sem a parte vendedora |
| Número da unidade | Só o número, como no espelho. Ex: `1002` |
| Data do documento | A data que vai constar no contrato |
| Cidade/UF da assinatura | Ex: `Aracruz/ES` |
| Responsável interno pelo preenchimento | Quem está preenchendo. Escreva o nome como está cadastrado no sistema |
| **E-mail do responsável pelo preenchimento** | **Para onde vai o aviso de contrato pronto.** Confira antes de enviar |

Sobre o e-mail: se você errar de um jeito que ainda pareça endereço
(`joao@empresq.com`), o aviso vai para o lugar errado e ninguém percebe. Se
errar de um jeito que não pareça endereço, ou deixar vazio, o sistema usa o
e-mail do seu cadastro. Não achando nenhum, manda para a administração
explicando por quê.

---

## Seção 2 a 5 — Quem está comprando

**Pessoa física** pede: nome, CPF, nacionalidade, estado civil, profissão, RG,
órgão emissor, endereço, CEP, telefone e e-mail.

Depois pergunta se há **cônjuge** que deva constar. Respondendo sim, abre uma
seção com os dados dele (nome, CPF, nacionalidade, profissão, RG, órgão).
Respondendo não, o bloco de cônjuge sai em branco no documento — o que é
correto, e o sistema não reclama disso.

**Pessoa jurídica** pede: razão social, CNPJ, endereço, CEP, telefone e e-mail
da empresa; e depois os dados do **representante legal**, que é quem assina.

Empresa não tem nacionalidade, estado civil nem RG. Esses campos ficam vazios
no documento e o sistema **não** os cobra — ele reconhece que o contratante é
pessoa jurídica.

---

## Seção 6 — Unidade e documento

Pede o tipo da unidade (`apartamento`, `cobertura duplex`) e o número por
extenso (`mil e dois`).

E então **qual documento gerar**. É esta escolha que define o resto do caminho.

Um envio gera **um** documento. Para três documentos da mesma venda, preencha o
formulário três vezes — ou use a tela de Contratos, que abre a operação inteira
de uma vez e depois cada documento é preenchido pelo seu próprio link.

---

## O que cada documento pede

### Contrato de Promessa de Compra e Venda
*O mais completo — 43 campos.*

Caminho: **Preço → Parcelamento → Intermediação → Testemunhas**

Além dos dados do comprador, pede toda a unidade e todo o preço:

- vagas de garagem e números das vagas
- área privativa, área de construção, fração ideal
- descrição da planta
- **preço total** (número e por extenso)
- **valor da fração ideal do terreno** (número e por extenso) — cláusula 1.4
- **custo de construção** (número e por extenso) — cláusula 3.2
- forma de aquisição: à vista ou parcelado

Sobre os dois últimos: o preço total se divide em quanto corresponde ao terreno
e quanto corresponde à construção. São valores **diferentes** do total, e
somados devem dar o total. Quem define a divisão é a incorporadora.

Escolhendo **parcelado**, abre a seção de Parcelamento. Escolhendo **à vista**,
ela é pulada.

Este é o único documento que monta a **tabela de parcelas automaticamente**, a
partir do que for informado no parcelamento.

### Anexo ao Contrato de Promessa de Compra e Venda
*17 campos.*

Caminho: **Intermediação → Testemunhas** (pula preço e parcelamento)

Só os dados do comprador, do cônjuge e o nome do empreendimento. É o documento
mais rápido de preencher.

### Termo de Anuência com Outorga de Poderes
*20 campos.*

Caminho: **Intermediação → Testemunhas** (pula preço e parcelamento)

Dados do comprador e do cônjuge, mais o número da unidade e o número por
extenso.

### Termo de Ciência e Anuência para Empréstimo
*21 campos.*

Caminho: **Empréstimo → Intermediação → Testemunhas**

Abre uma seção com os dados da instituição credora:

- data do compromisso de compra e venda
- nome, CNPJ, endereço e CEP da pessoa jurídica que financia
- endereço do imóvel
- se é residência

### Termo de Adesão Preliminar SCP
*32 campos.*

Caminho: **Dados da SCP → Parcelamento → Intermediação → Testemunhas**

Abre uma seção com razão social, CNPJ, endereço e CEP da empresa, o valor da
entrada e o número de unidades.

**E passa pelo Parcelamento**, porque o documento tem a tabela "CONDIÇÕES E
PRAZOS". Ela tem cinco linhas fixas, preenchidas conforme o que você escrever
no campo *Tipo da parcela*:

| Linha da tabela | Reconhece quando o tipo contém |
|---|---|
| Entrada | `entrada` ou `sinal` |
| Parcela mensal | `mensal` ou `mensais` |
| Parcela intermediária | `intermedi` |
| Parcela anual | `anual`, `anuais` ou `balão` |
| Parcela nas chaves | `chave` |

Linha sem parcela correspondente fica em branco no documento — e entra no aviso
de campos em branco do e-mail.

---

## Seção 8 — Parcelamento

Aparece para Compra e Venda parcelado e para o SCP.

Primeiro informe **quantos tipos de parcelas** existem (1 a 5). Depois preencha
somente essa quantidade de blocos.

Cada bloco pede:

| Campo | O que é |
|---|---|
| Tipo da parcela | `Sinal`, `Mensais`, `Intermediária`, `Balão anual`, `Chaves` |
| Data inicial de vencimento | A da **primeira** parcela desse tipo, em DD/MM/AAAA |
| Valor unitário | O valor de **uma** parcela, não a soma |
| Quantidade | Quantas vezes ela se repete |
| Percentual | Quanto representa do total |
| É reajustável? / Índice | INCC, IGP-M, IPCA |
| Forma de pagamento | Dinheiro, PIX, financiamento... |

Dois pontos que geram erro:

**Valor unitário é de uma parcela.** "Mensais, R$ 5.400,00, quantidade 24"
significa 24 parcelas de R$ 5.400,00 — não R$ 5.400,00 divididos em 24.

**A data é da primeira.** O sistema calcula as demais mês a mês e cria um
lançamento no financeiro para cada uma.

---

## Seções 11 a 14 — Fechamento

**Intermediação** — se houver construtora intermediando, abre uma seção com
razão social, CNPJ, CRECI, endereço e representante.

**Testemunhas** — nome e CPF de até duas. São opcionais; ficando vazias, o
bloco de assinatura sai em branco e o sistema não reclama.

**Observações** — dois campos livres, cada um com uma pergunta sim/não antes:
observação especial da negociação, e personalização da unidade.

---

## Depois de enviar

Em até um minuto o n8n percebe a resposta e o sistema:

1. cadastra o cliente (ou reaproveita, se o CPF já existe)
2. cria ou completa o contrato
3. gera o documento
4. registra as parcelas no financeiro, se for compra e venda
5. manda o e-mail para o endereço que você informou

**Enviar a mesma resposta duas vezes não duplica nada.** O sistema reconhece
pelo carimbo de data/hora e devolve o documento que já existia.

### O e-mail que chega

Traz o tipo de documento, cliente, empreendimento, unidade, quem preencheu e o
link para abrir o arquivo.

Se o assunto começar com **`[CONFERIR]`**, o documento saiu com campo vazio —
a lista dos campos vem no fim do e-mail. Vale abrir antes de mandar para
assinatura.

Campos começando com `EMPREENDIMENTO_` **não** são culpa do formulário: eles
vêm do cadastro do empreendimento no sistema. Peça a um administrador para
completar em Empreendimentos → Editar.

---

## Erros comuns

**"Empreendimento X não existe no sistema."**
O nome digitado não bate com nenhum cadastrado. O sistema aceita variação de
acento, maiúscula e pontuação, e até nome parcial — mas só se sobrar um
candidato. A mensagem lista os nomes aceitos. Nada é criado quando isso
acontece.

**O documento saiu, mas o cliente ficou sem dono.**
O nome em "Responsável interno" não bateu com nenhum usuário ativo. Precisa ser
igual ao cadastrado — acento e espaço extra não atrapalham, mas apelido sim. Se
houver dois usuários com o mesmo nome, o sistema não escolhe nenhum, de
propósito.

**A tabela de parcelas do SCP saiu vazia.**
Ou o parcelamento não foi preenchido, ou os tipos escritos não casam com
nenhuma das cinco linhas. Veja a tabela de palavras reconhecidas acima.

**O aviso não chegou.**
Confira o e-mail que você digitou na primeira seção. Se estava errado mas com
cara de e-mail válido, a mensagem foi para lá. O sistema registra o destino de
cada aviso no log.

**Preciso corrigir uma resposta já enviada.**
Preencha de novo com os dados corretos — vai gerar um documento novo, porque o
carimbo de data/hora é outro. Depois exclua o contrato antigo na tela de
Contratos.

---

## Manutenção do formulário

O formulário é gerado e mantido por um script (`forms/apps-script-formulario.gs`).
Os títulos das perguntas são o contrato com o sistema: **mudar um título no
Google Forms quebra a leitura** daquele campo, sem aviso.

Funções disponíveis no editor do Apps Script:

| Função | Para quê |
|---|---|
| `atualizarFormulario()` | Acrescenta as perguntas que faltam e corrige o roteamento. Use esta no formulário que já está em uso |
| `criarFormularioContratual()` | Cria um formulário novo do zero. Gera planilha nova — o gatilho do n8n precisa ser repontado |
| `sincronizarEmpreendimentos()` | Atualiza a lista de empreendimentos a partir do sistema |
| `verificarDocumentosOferecidos()` | Confere se os cinco tipos com modelo estão no menu |
| `verificarTitulosDuplicados(url)` | Acha títulos repetidos, que fazem o n8n perder dado |

Configure `URL_FORM` em Configurações do projeto → Propriedades do script, com
a URL de edição do formulário.
