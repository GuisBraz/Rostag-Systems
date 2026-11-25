/* Idiomas. O texto em português é a própria chave; aqui fica a tradução em inglês.
   t('Minhas tarefas') -> 'My tasks'  ·  t('{n} em aberto', { n: 3 }) -> '3 open' */

import { pref } from './prefs.js';

const EN = {
  // Casca / menu
  'Início': 'Home', 'Minhas tarefas': 'My tasks', 'Quadro': 'Board', 'Projetos': 'Projects',
  'Configurações': 'Settings', 'Carregando…': 'Loading…', 'Sair': 'Sign out',
  'Modo demonstração': 'Demo mode', 'dados só neste navegador. Ver como:': 'data only in this browser. View as:',
  'Restaurar exemplo': 'Reset sample data', 'Ver como': 'View as', 'Apagar as mudanças e voltar aos dados de exemplo?': 'Discard changes and go back to the sample data?',
  'Desenvolvido por': 'Developed by', '— Técnico de processos e estudante de engenharia mecânica': '— Process technician and mechanical engineering student',
  'Portfólio': 'Portfolio',

  // Níveis, status, prioridades
  'ADM': 'Admin', 'Gerência': 'Management', 'Líder': 'Leader', 'Analista': 'Analyst', 'Aguardando liberação': 'Awaiting approval',
  'A fazer': 'To do', 'Em andamento': 'In progress', 'Concluída': 'Done',
  'Baixa': 'Low', 'Média': 'Medium', 'Alta': 'High',

  // Login / pendente / convite
  'Entrar': 'Sign in', 'Criar conta': 'Create account', 'Nome': 'Name', 'E-mail': 'Email', 'Senha': 'Password',
  'E-mail ou senha incorretos.': 'Wrong email or password.',
  'Este e-mail já tem conta. Use “Entrar”.': 'This email already has an account. Use “Sign in”.',
  'A senha precisa de pelo menos 6 caracteres.': 'Password must be at least 6 characters.',
  'Olá {nome}': 'Hi {nome}',
  'Sua conta foi criada e está <strong>aguardando liberação da gerência</strong>.': 'Your account was created and is <strong>awaiting approval from management</strong>.',
  'Assim que seu nível for definido, esta tela atualiza sozinha.': 'As soon as your level is set, this screen updates by itself.',
  'Você foi convidado para a equipe de <strong>{equipe}</strong> como <strong>{nivel}</strong>.': 'You were invited to <strong>{equipe}</strong>’s team as <strong>{nivel}</strong>.',
  'Você foi convidado como <strong>{nivel}</strong>.': 'You were invited as <strong>{nivel}</strong>.',
  'Crie sua conta abaixo para entrar.': 'Create your account below to join.',
  'Este convite não vale mais (expirou, já foi usado ou foi cancelado). Peça um novo à gerência.': 'This invite is no longer valid (expired, already used or cancelled). Ask management for a new one.',
  'Verificando convite…': 'Checking invite…',
  'Você já tem conta. Saia primeiro para usar um convite.': 'You already have an account. Sign out first to use an invite.',

  // Início
  'Bom dia': 'Good morning', 'Boa tarde': 'Good afternoon', 'Boa noite': 'Good evening', 'Semana {n}': 'Week {n}',
  'Todas as equipes': 'All teams', 'Equipe de {nome}': '{nome}’s team',
  'Projetos em aberto': 'Open projects', 'Tarefas em aberto': 'Open tasks', 'Tarefas pendentes': 'Overdue tasks',
  'Vencem nesta semana': 'Due this week', 'Concluídas na semana': 'Done this week',
  'Prazo vencido e ainda não concluídas': 'Past due and not done yet',
  'Tarefas por status': 'Tasks by status', 'Tarefas por projeto': 'Tasks by project',
  'Tarefas abertas por responsável': 'Open tasks by assignee', 'Sem projeto': 'No project',
  'Nenhuma tarefa atrasada. 👏': 'No overdue tasks. 👏',

  // Tarefas
  '+ Nova tarefa': '+ New task', 'Nova tarefa': 'New task', 'Título': 'Title', 'Projeto': 'Project', 'Equipe': 'Team',
  'Equipe {nome}': 'Team {nome}', 'Responsável': 'Assignee', 'Escolha…': 'Choose…', 'Prazo': 'Due date', 'Prioridade': 'Priority',
  'Descrição': 'Description', 'Detalhes, links, combinados…': 'Details, links, agreements…', 'Cancelar': 'Cancel', 'Criar tarefa': 'Create task',
  'Tarefa criada': 'Task created', 'Tarefa concluída ✔': 'Task done ✔', 'Tarefa excluída': 'Task deleted',
  'Ainda não há equipes. Cadastre um líder em Equipe.': 'There are no teams yet. Set up a leader under Team.',
  'Atrasadas': 'Overdue', 'Hoje': 'Today', 'Próximos 7 dias': 'Next 7 days', 'Mais adiante': 'Later', 'Sem prazo': 'No due date', 'Concluídas': 'Done',
  '{a} em aberto · {c} concluída(s)': '{a} open · {c} done',
  'A gerência acompanha todas as equipes pelo <a href="#/quadro">Quadro</a> e pelos <a href="#/projetos">Projetos</a>.': 'Management follows every team on the <a href="#/quadro">Board</a> and in <a href="#/projetos">Projects</a>.',
  'Nenhuma tarefa com você por enquanto.': 'No tasks assigned to you for now.',
  'arraste os cartões para mudar o status': 'drag cards to change status',
  'Buscar tarefa…': 'Search tasks…', 'Buscar': 'Search', 'Todos os projetos': 'All projects', 'Todos os responsáveis': 'All assignees',
  'Limpar': 'Clear', 'Nada aqui': 'Nothing here', 'Checklist': 'Checklist', 'Comentários': 'Comments', 'Prioridade alta': 'High priority',
  'Adicionar item…': 'Add item…', 'Adicionar': 'Add', 'Remover item': 'Remove item', 'Nenhum comentário ainda.': 'No comments yet.',
  'Escreva um comentário…': 'Write a comment…', 'Comentar': 'Comment', 'Adicione detalhes, links, combinados…': 'Add details, links, agreements…',
  '! Atrasada': '! Overdue', 'Equipe de <strong>{nome}</strong>': '<strong>{nome}</strong>’s team',
  'Criada por <strong>{nome}</strong>': 'Created by <strong>{nome}</strong>', 'Ver projeto →': 'View project →',
  'Histórico ({n})': 'History ({n})', 'Excluir tarefa': 'Delete task', 'Fechar': 'Close', 'Status': 'Status',
  'Excluir a tarefa “{t}”? Isso não pode ser desfeito.': 'Delete the task “{t}”? This cannot be undone.',

  // Histórico
  'criou a tarefa': 'created the task', 'mudou o status para “{v}”': 'changed status to “{v}”', 'renomeou para “{v}”': 'renamed to “{v}”',
  'editou a descrição': 'edited the description', 'passou a tarefa para {v}': 'assigned the task to {v}',
  'mudou o prazo para {v}': 'changed the due date to {v}', 'removeu o prazo': 'removed the due date',
  'mudou a prioridade para {v}': 'changed priority to {v}', 'moveu para o projeto “{v}”': 'moved to project “{v}”',
  'tirou a tarefa do projeto': 'removed the task from its project', 'adicionou “{v}” ao checklist': 'added “{v}” to the checklist',
  'removeu o item “{v}” do checklist': 'removed “{v}” from the checklist', 'marcou “{v}”': 'checked “{v}”', 'desmarcou “{v}”': 'unchecked “{v}”',

  // Projetos
  '+ Novo projeto': '+ New project', 'Novo projeto': 'New project', 'Editar projeto': 'Edit project',
  '{a} em aberto · {c} concluído(s)': '{a} open · {c} completed', 'Nenhum projeto em aberto.': 'No open projects.', 'Concluídos': 'Completed',
  '{f}/{t} tarefas': '{f}/{t} tasks', '{f}/{t} tarefas da equipe': '{f}/{t} team tasks', '{n} atrasada(s)': '{n} overdue',
  'Projeto não encontrado.': 'Project not found.', 'Voltar': 'Back', '← Projetos': '← Projects',
  'Concluído': 'Completed', 'Em aberto': 'Open', 'Prazo {d}': 'Due {d}', 'Criado por {nome}': 'Created by {nome}',
  '{p}% · {f} de {t} tarefas concluídas': '{p}% · {f} of {t} tasks done', ' (da sua equipe)': ' (your team)',
  'Nenhuma tarefa visível neste projeto.': 'No visible tasks in this project.', 'Situação': 'Status', 'Salvar': 'Save',
  'Criar projeto': 'Create project', 'Projeto salvo': 'Project saved', 'Projeto criado': 'Project created', '{p}% concluído': '{p}% done',

  // Configurações
  'Conta': 'Account', 'Sobre': 'About', 'Minha conta': 'My account', 'Nível': 'Level', 'Aparência': 'Appearance',
  'Claro': 'Light', 'Escuro': 'Dark', 'Idioma': 'Language', 'Nome salvo': 'Name saved', 'Salvar nome': 'Save name',
  'Tema e idioma valem para este aparelho.': 'Theme and language apply to this device.',
  'Pessoa': 'Person', 'Sem líder': 'No leader', 'Sem analistas': 'No analysts', 'Defina pelo menos um líder abaixo.': 'Set at least one leader below.',
  'Nível atualizado': 'Level updated', 'Líder atualizado': 'Leader updated',
  '{l} líder(es) · {a} analista(s)': '{l} leader(s) · {a} analyst(s)', '{n} aguardando liberação': '{n} awaiting approval',
  'Quem cria conta sem convite entra como “Aguardando liberação” e só vê o sistema depois que a gerência definir o nível.': 'People who sign up without an invite start as “Awaiting approval” and only see the system after management sets their level.',
  'Convidar pessoa': 'Invite someone', 'Gerar link de convite': 'Generate invite link', 'Convites ativos': 'Active invites',
  'Copiar link': 'Copy link', 'Cancelar convite': 'Cancel invite', 'Link copiado': 'Link copied', 'Convite criado e link copiado': 'Invite created and link copied', 'Convite criado': 'Invite created',
  'Convite cancelado': 'Invite cancelled', 'Vence em {d}': 'Expires {d}', 'Escolha o líder': 'Choose the leader',
  'Cada link serve para uma pessoa e vale 7 dias. Quem abrir cria a conta e já entra na equipe.': 'Each link is for one person and lasts 7 days. Whoever opens it creates an account and joins the team right away.',
  'Nenhum convite ativo.': 'No active invites.', 'como {nivel}': 'as {nivel}', 'na equipe de {nome}': 'on {nome}’s team',
  'Sua equipe': 'Your team',
  'Rostag Systems é um planner para equipes organizarem projetos e tarefas sem perder nenhuma informação, desenvolvido por Guilherme dos Santos Braz, Técnico de processos de caldeiraria e graduando de Engenharia Mecânica pelo IFMG.':
    'Rostag Systems is a planner for teams to organize projects and tasks without losing any information, developed by Guilherme dos Santos Braz, a boilermaking process technician and Mechanical Engineering undergraduate at IFMG.',
  'Ver meu portfólio ↗': 'See my portfolio ↗', 'LinkedIn ↗': 'LinkedIn ↗', 'Versão {v}': 'Version {v}',

  // Projetos v0.3 / linha do tempo
  'Linha do tempo': 'Timeline', 'Commessa': 'Job number', 'Escopo': 'Scope', 'Ex.: Motorização, Plataforma TP01': 'E.g.: Motorization, Platform TP01',
  'Cliente': 'Client', 'Tipo de serviço': 'Service type', 'Fabricação': 'Fabrication', 'Manutenção': 'Maintenance', 'Serviços gerais': 'General services',
  'Data de início': 'Start date', 'Data de entrega': 'Delivery date', 'Entrega': 'Delivery', 'Entrega {d}': 'Delivery {d}',
  'Líder responsável': 'Lead', 'Analistas responsáveis': 'Assigned analysts', 'Escolha o líder para ver os analistas.': 'Choose the leader to see the analysts.',
  'Este líder ainda não tem analistas.': 'This leader has no analysts yet.', 'Concluído (arquivar)': 'Completed (archive)',
  'A commessa deve ter o formato AAAA-NNN (ex.: 2025-006).': 'The job number must look like YYYY-NNN (e.g. 2025-006).',
  'Preencha todos os campos obrigatórios.': 'Fill in all required fields.', 'A data de entrega não pode ser antes do início.': 'The delivery date can’t be before the start date.',
  '{a} em aberto · {c} arquivado(s)': '{a} open · {c} archived', 'Ver arquivados': 'View archived', 'Arquivado': 'Archived',
  'Projetos em aberto, pela data de entrega': 'Open projects, by delivery date', 'Todos': 'All', 'Só os meus': 'Only mine',
  'Nenhum projeto em aberto com você como responsável.': 'No open projects with you assigned.', 'Sem data de entrega': 'No delivery date',
  'entrega': 'delivery', 'Atrasado {n} dia(s)': '{n} day(s) late', 'Começa em {n} dia(s)': 'Starts in {n} day(s)', 'Entrega hoje': 'Due today',
  'Faltam {n} dia(s)': '{n} day(s) left', 'Tempo decorrido': 'Time elapsed', '{p}% das tarefas concluídas': '{p}% of tasks done',
  'Comece convidando um líder': 'Start by inviting a leader',
  'Toda tarefa pertence à equipe de um líder. Convide o primeiro líder para começar a criar tarefas.': 'Every task belongs to a leader’s team. Invite the first leader to start creating tasks.',

  // Erros
  'Você não tem permissão para isso.': 'You don’t have permission to do that.', 'Algo deu errado.': 'Something went wrong.',
  'No modo demonstração não há cadastro.': 'There is no sign-up in demo mode.'
};

export const idioma = () => (pref('idioma') === 'en' ? 'en' : 'pt');

export function t(pt, vars) {
  let s = idioma() === 'en' && EN[pt] !== undefined ? EN[pt] : pt;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}
