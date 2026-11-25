/* Dispara notificações. Cada uma diz quem fez (por), o que (tipo/acao) e para
   quem vale: geral (equipeId e paraId nulos), da equipe (equipeId) ou pessoal (paraId).
   Falha ao notificar nunca atrapalha a ação principal. */

import { estado, fonte } from './estado.js';
import { nomeProjeto, VALIDADE_NOTIFICACAO_MS } from './dominio/regras.js';

export function notificar(tipo, { projetoId = null, tarefaId = null, equipeId = null, paraId = null, titulo = '', acao = null, trecho = null } = {}) {
  const u = estado.usuario;
  if (!u) return;
  if (paraId && paraId === u.id) return; // ninguém se notifica
  const em = Date.now();
  fonte.criarNotificacao({
    tipo, acao, em, por: u.id, projetoId, tarefaId, equipeId, paraId,
    titulo: String(titulo || '').slice(0, 160), trecho: trecho ? String(trecho).slice(0, 120) : null,
    expiraEm: em + VALIDADE_NOTIFICACAO_MS
  }).catch((e) => console.warn('Notificação não enviada:', e));
}

/** Projeto criado, editado, pausado, finalizado… (vale para todos). */
export function notificarProjeto(acao, p) {
  notificar('projeto', { projetoId: acao === 'apagar' ? null : p.id, titulo: nomeProjeto(p), acao });
}

/** Tarefa nova (para a equipe) e, se tiver outro responsável, "atribuída a você". */
export function notificarTarefaNova(t) {
  const base = { tarefaId: t.id, projetoId: t.projetoId || null, titulo: t.titulo };
  notificar('tarefa_nova', { ...base, equipeId: t.equipeId });
  notificarAtribuida(t);
}

export function notificarAtribuida(t) {
  if (!t.responsavelId) return;
  notificar('tarefa_atribuida', { tarefaId: t.id, projetoId: t.projetoId || null, titulo: t.titulo, paraId: t.responsavelId });
}

export function notificarComentario(t, texto) {
  notificar('comentario', { tarefaId: t.id, projetoId: t.projetoId || null, titulo: t.titulo, equipeId: t.equipeId, trecho: texto });
}
