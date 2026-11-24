/* Regras do negócio: níveis, visibilidade e indicadores — funções puras.
   As mesmas regras de visibilidade estão no firestore.rules (a trava de verdade). */

import { hojeISO, limitesSemana } from './datas.js';

export const NIVEIS = {
  adm: 'ADM',
  gerente: 'Gerência',
  lider: 'Líder',
  analista: 'Analista',
  pendente: 'Aguardando liberação'
};

export const STATUS = [
  { id: 'afazer', nome: 'A fazer' },
  { id: 'andamento', nome: 'Em andamento' },
  { id: 'concluida', nome: 'Concluída' }
];
export const nomeStatus = (id) => (STATUS.find((s) => s.id === id) || {}).nome || id;

export const PRIORIDADES = [
  { id: 'baixa', nome: 'Baixa' },
  { id: 'media', nome: 'Média' },
  { id: 'alta', nome: 'Alta' }
];
export const nomePrioridade = (id) => (PRIORIDADES.find((p) => p.id === id) || {}).nome || id;

/** Equipe de um usuário: o líder é a própria equipe; o analista é a equipe do seu líder. */
export function equipeDe(usuario) {
  if (!usuario) return null;
  if (usuario.nivel === 'lider') return usuario.id;
  if (usuario.nivel === 'analista') return usuario.liderId || null;
  return null;
}

/** ADM (só o criador, para testes) fica acima da gerência e tem tudo liberado. */
export const ehAdm = (u) => !!u && u.nivel === 'adm';
/** Gerência ou ADM: vê todas as equipes. */
export const ehGerente = (u) => !!u && (u.nivel === 'gerente' || u.nivel === 'adm');
export const podeCriarProjeto = (u) => !!u && ['adm', 'gerente', 'lider'].includes(u.nivel);
export const ativo = (u) => !!u && ['adm', 'gerente', 'lider', 'analista'].includes(u.nivel);

/** Níveis que `quem` pode dar a outra pessoa. Só o ADM cria gerentes. */
export function niveisQuePodeDar(quem) {
  if (ehAdm(quem)) return ['gerente', 'lider', 'analista', 'pendente'];
  if (ehGerente(quem)) return ['lider', 'analista', 'pendente'];
  return [];
}

/** `quem` pode mudar o nível/líder de `alvo`? Gerência não mexe em gerentes nem no ADM. */
export function podeEditarPessoa(quem, alvo) {
  if (!quem || !alvo || quem.id === alvo.id) return false;
  if (ehAdm(quem)) return true;
  return ehGerente(quem) && !['gerente', 'adm'].includes(alvo.nivel);
}

/** O ADM fica escondido das listas para todo mundo menos ele mesmo. */
export const pessoasVisiveis = (quem, usuarios) => (ehAdm(quem) ? usuarios : usuarios.filter((u) => u.nivel !== 'adm'));

export const VALIDADE_CONVITE_MS = 7 * 86400000;
/** Convite ainda pode ser usado? */
export function conviteValido(c, agora = Date.now()) {
  return !!c && !c.usado && typeof c.expiraEm === 'number' && c.expiraEm > agora;
}

/** O usuário enxerga esta tarefa? Gerente vê tudo; os demais só a própria equipe. */
export function podeVerTarefa(usuario, tarefa) {
  if (!ativo(usuario) || !tarefa) return false;
  if (ehGerente(usuario)) return true;
  const eq = equipeDe(usuario);
  return !!eq && tarefa.equipeId === eq;
}

export function tarefasVisiveis(usuario, tarefas) {
  return tarefas.filter((t) => podeVerTarefa(usuario, t));
}

/** Pessoas que podem ser responsáveis numa tarefa da equipe (o líder e seus analistas). */
export function membrosDaEquipe(equipeId, usuarios) {
  return usuarios.filter((u) =>
    (u.nivel === 'lider' && u.id === equipeId) || (u.nivel === 'analista' && u.liderId === equipeId));
}

/** Pendente = atrasada: prazo vencido e ainda não concluída. */
export function atrasada(tarefa, hoje = hojeISO()) {
  return tarefa.status !== 'concluida' && !!tarefa.prazo && tarefa.prazo < hoje;
}

export function indicadores(tarefas, projetos, agora = new Date()) {
  const hoje = hojeISO(agora);
  const { inicio, fim } = limitesSemana(agora);
  const abertas = tarefas.filter((t) => t.status !== 'concluida');
  const porStatus = { afazer: 0, andamento: 0, concluida: 0 };
  tarefas.forEach((t) => { if (porStatus[t.status] !== undefined) porStatus[t.status]++; });
  return {
    projetosAbertos: projetos.filter((p) => p.status !== 'concluido').length,
    tarefasAbertas: abertas.length,
    pendentes: abertas.filter((t) => atrasada(t, hoje)).length,
    venceSemana: abertas.filter((t) => t.prazo && t.prazo >= hoje && t.prazo <= fim).length,
    concluidasSemana: tarefas.filter((t) => t.status === 'concluida' && t.concluidaEm &&
      ymdDe(t.concluidaEm) >= inicio && ymdDe(t.concluidaEm) <= fim).length,
    porStatus
  };
}

function ymdDe(ms) { return hojeISO(new Date(ms)); }

/** Tarefas abertas agrupadas por um campo (projetoId ou responsavelId), com contagem por status. */
export function abertasPor(campo, tarefas) {
  const mapa = new Map();
  tarefas.forEach((t) => {
    const k = t[campo] || '';
    if (!mapa.has(k)) mapa.set(k, { afazer: 0, andamento: 0, concluida: 0, atrasadas: 0 });
    const g = mapa.get(k);
    g[t.status] = (g[t.status] || 0) + 1;
    if (atrasada(t)) g.atrasadas++;
  });
  return mapa;
}
