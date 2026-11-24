# Rostag Systems

Planner da equipe: projetos, tarefas e o histórico de tudo num lugar só, para
que nenhuma informação se perca.

Site estático (HTML + JS, sem etapa de build). Os dados ficam no Firebase
(Firestore), sincronizados ao vivo entre todos.

## Níveis

| Nível | Vê | Pode |
|---|---|---|
| **ADM** | Tudo | Tudo, inclusive promover gerentes. Só o criador, para testes; fica escondido nas listas |
| **Gerência** | Tudo, de todas as equipes | Tudo; define o nível de cada pessoa e o líder de cada analista |
| **Líder** | A própria equipe | Criar projetos; criar, editar, dar baixa, comentar e excluir tarefas da equipe |
| **Analista** | A equipe do seu líder | Criar, editar, dar baixa, comentar e mexer no checklist das tarefas da equipe |

- Cada analista pertence a um líder; uma equipe **não vê** as tarefas da outra.
- **Projetos** são visíveis para todos; só gerência e líderes criam.
- Toda tarefa tem um **responsável** obrigatório.
- Cada tarefa guarda **checklist**, **comentários** e um **histórico automático**
  (quem criou, quem mudou status, prazo, responsável…).
- **Tarefa pendente** = prazo vencido e ainda não concluída.

A trava de verdade fica no [`firestore.rules`](firestore.rules): mesmo que
alguém mexa no navegador, o banco recusa o que o nível da pessoa não permite.

## Telas

- **Início** — saudação, data e hora ao vivo, semana do ano, indicadores e gráficos.
- **Minhas tarefas** — o que está com você, agrupado por prazo.
- **Quadro** — Kanban (A fazer · Em andamento · Concluída) com filtros; arraste para mudar o status.
- **Projetos** — progresso de cada projeto e suas tarefas.
- **Configurações** (clique no seu nome, no canto superior direito):
  - **Conta** — nome, tema claro/escuro e idioma (português/inglês).
  - **Equipe** — quem está na equipe; a gerência gera **links de convite** e define níveis.
  - **Sobre** — o que é o app, quem criou, portfólio e LinkedIn.

## Convites

A gerência gera o link em **Configurações → Equipe**, escolhendo o nível (e o
líder, se for analista). Quem abre o link cria a conta e já entra na equipe.
Cada link serve para **uma pessoa** e vale **7 dias**. Quem cria conta sem
convite fica em “Aguardando liberação”.

## Rodar no computador

```powershell
python -m http.server 5200 --bind 127.0.0.1
```

Abra http://localhost:5200. Para testar sem mexer nos dados reais, use
http://localhost:5200/?demo (modo demonstração, só no computador).

Testes: `npm test` (regras de negócio) e `npm run test:regras` (permissões do
Firestore no emulador; precisa de Java).

## Modo demonstração

Enquanto o Firebase não estiver configurado (`apiKey` vazio em
[`js/config.js`](js/config.js)), o sistema roda em **modo demonstração**: dados
de exemplo guardados só no navegador, e uma faixa no topo deixa trocar de
pessoa para ver o que cada nível enxerga.

## Configurar o Firebase (uso real com a equipe)

Plano gratuito (Spark) é suficiente.

1. Em **console.firebase.google.com**, crie um projeto (ex.: `rostag-systems`).
2. Clique em **`</>`** (Web), registre um app e copie o bloco `firebaseConfig`
   para [`js/config.js`](js/config.js).
3. **Build → Authentication → Começar → E-mail/senha → Ativar.**
4. **Build → Firestore Database → Criar banco** (região `southamerica-east1`).
5. Na aba **Regras** do Firestore, cole o conteúdo de `firestore.rules` e publique.
6. **ADM / primeiro gerente:** abra o site, crie sua conta (vai aparecer “aguardando
   liberação”). No console, em **Firestore → usuarios → (seu documento)**, mude
   o campo `nivel` de `pendente` para `adm` (ou `gerente`). A tela atualiza sozinha.
7. Daí em diante, a gerência convida as pessoas por link em **Configurações → Equipe**.

## Estrutura

```
index.html          casca da página
css/app.css         visual (branco gelo, azul royal, azul celeste)
js/config.js        configuração do Firebase / modo demonstração
js/estado.js        estado central e assinatura ao vivo dos dados
js/dados/           fonte Firebase e fonte local (demo), mesma interface
js/dominio/         regras puras: datas, níveis, visibilidade, indicadores
js/i18n.js          textos em inglês (o português é a chave)
js/prefs.js         tema e idioma deste aparelho
js/ui/              telas: início, tarefas/quadro, projetos, configurações
firestore.rules     permissões no banco
tests/              testes (node --test)
```
