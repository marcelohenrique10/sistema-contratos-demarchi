# A virada para produção

Hoje o Render está no plano **gratuito**, sem disco. O sistema usa o
`imobiliaria.db` que está no repositório, e a hospedagem gratuita apaga tudo a
cada reinício (depois de 15 minutos parado) e a cada publicação:

> **O que o cliente cadastra some.** O sistema volta ao banco do repositório.

O código já está pronto para o disco. A virada é configuração, sem programar.

## Como funciona depois da virada

Com a variável `DADOS_DIR` apontando para o disco:

- Na **primeira subida**, o disco está vazio e o sistema copia o
  `imobiliaria.db` do repositório para lá. O log mostra
  `Banco novo em /var/data/imobiliaria.db, copiado de ...`.
- Daí em diante, o sistema só usa o banco do disco. O do repositório vira um
  ponto de partida que ninguém mais lê. **Publicar código não toca mais nos
  dados**, mesmo com o `imobiliaria.db` continuando no git.
- Os documentos gerados e enviados também ficam no disco (`/var/data/storage`).
- Todo dia sai uma cópia automática em `/var/data/backups` (ficam as últimas 14).

## Os passos

### 1. Antes de tudo: baixar o backup

Se alguém cadastrou algo que precisa sobreviver, entre como administrador em
**Backup → Baixar backup agora** e guarde o `.zip`. Faça isso logo antes do
passo 2, porque a hospedagem gratuita pode apagar os dados a qualquer momento.

### 2. Contratar o disco

No serviço do Render:

- Trocar o plano de **Free** para **Starter, US$ 7/mês** (disco não existe no
  gratuito, e o gratuito ainda hiberna após 15 minutos sem uso)
- *Disks* → *Add Disk*, montado em `/var/data`, 1 GB já sobra

O disco é **cobrado à parte**: US$ 0,25 por GB por mês. O Render fica em torno
de **US$ 7,25/mês**.

> Serviço com disco não publica sem interrupção: o Render derruba a instância
> antiga antes de subir a nova, e o sistema fica fora do ar por alguns
> segundos a cada publicação. Para uso interno, irrelevante.

### 3. Apontar os dados para o disco

Em *Environment*, acrescentar:

```
DADOS_DIR=/var/data
```

Salvar dispara uma nova publicação. No log (*Logs*), conferir as duas linhas:

```
Banco novo em /var/data/imobiliaria.db, copiado de /opt/render/project/src/imobiliaria.db.
Dados em /var/data
```

Se aparecer `(sem DADOS_DIR: dentro do projeto)`, a variável não pegou.

### 4. Trazer de volta o que foi salvo no passo 1

Entrar em **Backup → Restaurar um backup**, escolher o `.zip`, digitar
`RESTAURAR` e confirmar. Clientes, unidades, contratos, financeiro, usuários e
documentos voltam como estavam. Pode ser preciso entrar de novo.

Se não havia nada a salvar, pule: o sistema começa com os dados do repositório.

### 5. Provar que ficou

Cadastrar um cliente de teste, ir em *Manual Deploy → Restart service* no
Render e conferir se o cliente continua lá. É o único teste que prova que o
disco está ligado. Depois, apagar o cliente de teste.

### 6. Trocar as senhas

O `admin` do repositório tem a senha que circulou durante o desenvolvimento:

- um administrador para cada uma das duas pessoas da De Marchi
- um corretor para cada corretor
- depois **desative o `admin`** genérico

## O backup, depois da virada

| Cópia | Onde fica | Protege contra |
|---|---|---|
| Automática, diária | no disco do Render | engano: apagar ou restaurar o arquivo errado |
| "Antes de restaurar" | no disco do Render | restaurar o backup errado |
| **Baixada pela tela** | **fora do Render** | perder a hospedagem, a conta ou o disco |

As duas primeiras ficam no mesmo disco dos dados: se o disco ou o serviço se
perder, elas vão junto. Por isso alguém da De Marchi precisa **baixar o backup
toda semana** e guardar num lugar da empresa (Google Drive, por exemplo). Essa
responsabilidade precisa ter dono, combinado na entrega.

O `.zip` tem CPF, RG e endereço de clientes. Não pode ir por e-mail aberto nem
ficar em pasta compartilhada com quem não deve ver.

## Sobre tirar o `imobiliaria.db` do git

Deixou de ser necessário para a virada: com `DADOS_DIR`, o arquivo do
repositório não é mais o banco em uso. Continua valendo fazer antes da entrega
final, por outro motivo: o histórico do git guarda dados de teste, e o
repositório vai mudar de dono (ver `checklist-de-entrega.md`).

Atenção ao fazer: sem o arquivo no repositório, um disco novo começaria com os
dados de exemplo escritos no `database.js`. Antes de remover, troque-o por um
banco limpo, só com o empreendimento e as unidades reais.

## Por que não Postgres/Supabase

| | Disco + SQLite | Supabase (Postgres) |
|---|---|---|
| Mudança no código | nenhuma | reescrever todas as consultas |
| Esforço | minutos | dias, com risco |
| Custo | US$ 7,25/mês | grátis no início |
| Backup automático | diário no disco + download pela tela | sim |
| Resolve os documentos `.docx` | sim | **não**: precisaria de disco ou storage assim mesmo |

A última linha é a que decide: **o disco é necessário de qualquer forma**,
porque os contratos gerados são arquivos. Tendo disco, o SQLite não custa nada
a mais.

Postgres passa a valer se houver mais de uma instância do sistema ou se backup
fora do servidor virar exigência formal.
