// Testes do firestore.rules contra o emulador. Rode com: npm run test:regras
// (precisa de Java). Não fazem parte do `npm test`, que roda sem emulador.
import { test, before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

firebase.firestore.setLogLevel('silent');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIA = 86400000;

// ADM (A), gerente (G), líderes L1/L2, analistas N1 (de L1) e N2 (de L2), pendente P, novato X.
const A = 'adm', G = 'ger', L1 = 'lid1', L2 = 'lid2', N1 = 'ana1', N2 = 'ana2', P = 'pend', X = 'novo';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rostag-systems',
    firestore: { rules: fs.readFileSync(path.join(raiz, 'firestore.rules'), 'utf8') }
  });
});
after(async () => { if (env) await env.cleanup(); });

const pessoa = (nivel, liderId = null) => ({ nome: nivel, email: `${nivel}@x`, nivel, liderId, criadoEm: 1 });
const tarefa = (equipeId, extra = {}) => ({ titulo: 'T', equipeId, responsavelId: equipeId, status: 'afazer', criadoPor: equipeId, criadoEm: 1, ...extra });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`usuarios/${A}`).set(pessoa('adm'));
    await db.doc(`usuarios/${G}`).set(pessoa('gerente'));
    await db.doc(`usuarios/${L1}`).set(pessoa('lider'));
    await db.doc(`usuarios/${L2}`).set(pessoa('lider'));
    await db.doc(`usuarios/${N1}`).set(pessoa('analista', L1));
    await db.doc(`usuarios/${N2}`).set(pessoa('analista', L2));
    await db.doc(`usuarios/${P}`).set(pessoa('pendente'));
    await db.doc('tarefas/t1').set(tarefa(L1));
    await db.doc('tarefas/t2').set(tarefa(L2));
    await db.doc('convites/bom').set({ nivel: 'analista', liderId: L1, equipeNome: 'L1', criadoPor: G, criadoEm: 1, expiraEm: Date.now() + DIA, usado: false });
    await db.doc('convites/vencido').set({ nivel: 'analista', liderId: L1, criadoPor: G, criadoEm: 1, expiraEm: Date.now() - DIA, usado: false });
    await db.doc('convites/usado').set({ nivel: 'analista', liderId: L1, criadoPor: G, criadoEm: 1, expiraEm: Date.now() + DIA, usado: true, usadoPor: 'alguem' });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();

/* ---------------------------------------------------------------- tarefas */

test('visibilidade das tarefas por nível', async () => {
  await assertSucceeds(como(A).doc('tarefas/t2').get());
  await assertSucceeds(como(G).doc('tarefas/t2').get());
  await assertSucceeds(como(L1).doc('tarefas/t1').get());
  await assertFails(como(L1).doc('tarefas/t2').get());
  await assertSucceeds(como(N1).doc('tarefas/t1').get());
  await assertFails(como(N1).doc('tarefas/t2').get());
  await assertFails(como(P).doc('tarefas/t1').get());
  await assertSucceeds(como(N1).collection('tarefas').where('equipeId', '==', L1).get());
  await assertFails(como(N1).collection('tarefas').get());
});

test('analista edita tarefa da equipe, mas não muda de equipe nem a autoria', async () => {
  await assertSucceeds(como(N1).doc('tarefas/t1').update({ status: 'andamento' }));
  await assertFails(como(N1).doc('tarefas/t1').update({ equipeId: L2 }));
  await assertFails(como(N1).doc('tarefas/t1').update({ criadoPor: N1 }));
  await assertFails(como(N1).doc('tarefas/t2').update({ status: 'andamento' }));
  await assertSucceeds(como(N1).collection('tarefas').add(tarefa(L1, { criadoPor: N1 })));
  await assertFails(como(N1).collection('tarefas').add(tarefa(L2, { criadoPor: N1 })));
});

test('ADM mexe em qualquer tarefa', async () => {
  await assertSucceeds(como(A).doc('tarefas/t2').update({ equipeId: L1 }));
  await assertSucceeds(como(A).collection('tarefas').add(tarefa(L2, { criadoPor: A })));
  await assertSucceeds(como(A).doc('tarefas/t1').delete());
});

/* ---------------------------------------------------------------- pessoas */

test('níveis: só o ADM cria gerentes; gerência não mexe em gerente nem ADM', async () => {
  await assertSucceeds(como(A).doc(`usuarios/${L2}`).update({ nivel: 'gerente' }));
  await assertFails(como(G).doc(`usuarios/${N1}`).update({ nivel: 'gerente' }));
  await assertSucceeds(como(G).doc(`usuarios/${P}`).update({ nivel: 'analista', liderId: L1 }));
  await assertFails(como(G).doc(`usuarios/${A}`).update({ nivel: 'pendente' }));
  await assertFails(como(L1).doc(`usuarios/${N1}`).update({ nivel: 'lider' }));
  await assertSucceeds(como(N1).doc(`usuarios/${N1}`).update({ nome: 'Novo nome' }));
  await assertFails(como(N1).doc(`usuarios/${N1}`).update({ nivel: 'gerente' }));
});

test('conta nova sem convite só entra como pendente', async () => {
  await assertSucceeds(como(X).doc(`usuarios/${X}`).set(pessoa('pendente')));
  await env.clearFirestore();
  await assertFails(como(X).doc(`usuarios/${X}`).set(pessoa('gerente')));
});

/* ---------------------------------------------------------------- convites */

function usarConvite(uid, codigo, perfil) {
  const db = como(uid);
  const lote = db.batch();
  lote.set(db.doc(`usuarios/${uid}`), { ...perfil, convite: codigo });
  lote.update(db.doc(`convites/${codigo}`), { usado: true, usadoPor: uid, usadoEm: Date.now() });
  return lote.commit();
}

test('convite: qualquer um com o link lê; listar só a gerência', async () => {
  await assertSucceeds(env.unauthenticatedContext().firestore().doc('convites/bom').get());
  await assertFails(env.unauthenticatedContext().firestore().collection('convites').get());
  await assertFails(como(N1).collection('convites').get());
  await assertSucceeds(como(G).collection('convites').where('usado', '==', false).get());
});

test('convite válido: entra direto no nível e equipe do convite, uma vez só', async () => {
  await assertSucceeds(usarConvite(X, 'bom', pessoa('analista', L1)));
  await assertFails(usarConvite('outro', 'bom', pessoa('analista', L1)));
});

test('convite não permite escolher outro nível ou equipe', async () => {
  await assertFails(usarConvite(X, 'bom', pessoa('gerente')));
  await assertFails(usarConvite(X, 'bom', pessoa('analista', L2)));
});

test('convite vencido ou já usado não vale', async () => {
  await assertFails(usarConvite(X, 'vencido', pessoa('analista', L1)));
  await assertFails(usarConvite(X, 'usado', pessoa('analista', L1)));
});

test('perfil com convite precisa marcar o convite como usado no mesmo lote', async () => {
  await assertFails(como(X).doc(`usuarios/${X}`).set({ ...pessoa('analista', L1), convite: 'bom' }));
});

test('quem cria convite: gerência (líder/analista); gerente só o ADM', async () => {
  const conv = (nivel, liderId, por) => ({ nivel, liderId, criadoPor: por, criadoEm: 1, expiraEm: Date.now() + DIA, usado: false });
  await assertSucceeds(como(G).doc('convites/c1').set(conv('lider', null, G)));
  await assertSucceeds(como(G).doc('convites/c2').set(conv('analista', L1, G)));
  await assertSucceeds(como(G).doc('convites/c3').set(conv('analista', null, G))); // analista pode vir sem líder
  await assertFails(como(G).doc('convites/c4').set(conv('gerente', null, G)));
  await assertSucceeds(como(A).doc('convites/c5').set(conv('gerente', null, A)));
  await assertFails(como(L1).doc('convites/c6').set(conv('analista', L1, L1)));
  await assertSucceeds(como(G).doc('convites/bom').delete());
});

/* ---------------------------------------------------------------- projetos */

const projeto = (extra = {}) => ({ commessa: '2025-006', nome: 'Motorização', cliente: 'C', tipoServico: 'Fabricação',
  inicio: '2026-01-01', prazo: '2026-02-01', liderId: L1, analistaIds: [N1], status: 'aberto', criadoPor: L1, criadoEm: 1, ...extra });

test('projeto: líder cria com commessa válida; analista não cria', async () => {
  await assertSucceeds(como(L1).collection('projetos').add(projeto()));
  await assertSucceeds(como(L1).collection('projetos').add(projeto({ nome: 'Plataforma TP01' }))); // mesma commessa, outro escopo
  await assertFails(como(L1).collection('projetos').add(projeto({ commessa: '25-6' })));
  await assertFails(como(L1).collection('projetos').add(projeto({ liderId: null })));
  await assertFails(como(N1).collection('projetos').add(projeto({ criadoPor: N1 })));
});

test('projeto: arquivar (concluído) e todos os ativos leem', async () => {
  await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc('projetos/p1').set(projeto()));
  await assertSucceeds(como(N2).doc('projetos/p1').get());
  await assertSucceeds(como(L1).doc('projetos/p1').update({ status: 'concluido' }));
  await assertFails(como(L1).doc('projetos/p1').update({ commessa: 'x' }));
  await assertFails(como(P).doc('projetos/p1').get());
});

/* ---------------------------------------------------------------- foto */

test('foto: cada um troca e remove a própria; ninguém troca a dos outros', async () => {
  const foto = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
  await assertSucceeds(como(N1).doc(`usuarios/${N1}`).update({ foto }));
  await assertSucceeds(como(N1).doc(`usuarios/${N1}`).update({ foto: null }));
  await assertFails(como(N1).doc(`usuarios/${N2}`).update({ foto }));
  await assertFails(como(G).doc(`usuarios/${N1}`).update({ foto }));
  await assertFails(como(A).doc(`usuarios/${N1}`).update({ foto }));
  await assertSucceeds(como(A).doc(`usuarios/${A}`).update({ foto }));
});

test('foto: só JPEG embutido e pequeno', async () => {
  await assertFails(como(N1).doc(`usuarios/${N1}`).update({ foto: 'https://exemplo.com/eu.jpg' }));
  await assertFails(como(N1).doc(`usuarios/${N1}`).update({ foto: 'data:image/svg+xml;base64,PHN2Zz4=' }));
  await assertFails(como(N1).doc(`usuarios/${N1}`).update({ foto: 'data:image/jpeg;base64,' + 'A'.repeat(40000) }));
});

/* ---------------------------------------------------------------- situação do projeto */

test('situação: analista pausa e manda para a lixeira, mas não edita dados', async () => {
  await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc('projetos/p2').set(projeto()));
  await assertSucceeds(como(N2).doc('projetos/p2').update({ status: 'pausado', atualizadoEm: 2 }));
  await assertFails(como(N2).doc('projetos/p2').update({ nome: 'Outro' }));
  await assertFails(como(N2).doc('projetos/p2').update({ status: 'inventado' }));
  await assertSucceeds(como(N2).doc('projetos/p2').update({ status: 'excluido', excluidoEm: 3, excluidoPor: N2 }));
  // Na lixeira: só a gerência restaura
  await assertFails(como(N2).doc('projetos/p2').update({ status: 'aberto' }));
  await assertFails(como(L1).doc('projetos/p2').update({ status: 'aberto' }));
  await assertSucceeds(como(G).doc('projetos/p2').update({ status: 'aberto' }));
});

test('apagar de vez: só gerência/ADM e só da lixeira', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('projetos/vivo').set(projeto());
    await ctx.firestore().doc('projetos/lixo').set(projeto({ status: 'excluido' }));
  });
  await assertFails(como(G).doc('projetos/vivo').delete());
  await assertFails(como(L1).doc('projetos/lixo').delete());
  await assertSucceeds(como(G).doc('projetos/lixo').delete());
});

/* ---------------------------------------------------------------- notificações */

const notif = (extra = {}) => ({ tipo: 'projeto', acao: 'criou', em: Date.now(), expiraEm: Date.now() + DIA, por: N1,
  paraId: null, equipeId: null, projetoId: 'p1', tarefaId: null, titulo: 'X', trecho: null, ...extra });

test('notificações: quem cria e para quem', async () => {
  await assertSucceeds(como(N1).collection('notificacoes').add(notif()));
  await assertSucceeds(como(N1).collection('notificacoes').add(notif({ tipo: 'tarefa_nova', equipeId: L1 })));
  await assertFails(como(N1).collection('notificacoes').add(notif({ tipo: 'tarefa_nova', equipeId: L2 })));
  await assertFails(como(N1).collection('notificacoes').add(notif({ por: N2 })));
  await assertFails(como(N1).collection('notificacoes').add(notif({ tipo: 'qualquer' })));
  await assertFails(como(P).collection('notificacoes').add(notif({ por: P })));
});

test('notificações: cada um lê só as suas, as gerais e as da equipe', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('notificacoes/geral').set(notif());
    await db.doc('notificacoes/eq1').set(notif({ equipeId: L1 }));
    await db.doc('notificacoes/eq2').set(notif({ equipeId: L2 }));
    await db.doc('notificacoes/pN1').set(notif({ paraId: N1 }));
    await db.doc('notificacoes/pN2').set(notif({ paraId: N2 }));
    await db.doc('notificacoes/velha').set(notif({ expiraEm: Date.now() - DIA }));
  });
  const n1 = como(N1);
  await assertSucceeds(n1.doc('notificacoes/geral').get());
  await assertSucceeds(n1.doc('notificacoes/eq1').get());
  await assertSucceeds(n1.doc('notificacoes/pN1').get());
  await assertFails(n1.doc('notificacoes/eq2').get());
  await assertFails(n1.doc('notificacoes/pN2').get());
  await assertSucceeds(n1.collection('notificacoes').where('paraId', '==', N1).get());
  await assertSucceeds(n1.collection('notificacoes').where('paraId', '==', null).where('equipeId', '==', null).get());
  await assertSucceeds(n1.collection('notificacoes').where('paraId', '==', null).where('equipeId', '==', L1).get());
  await assertFails(n1.collection('notificacoes').get());
  await assertSucceeds(como(G).collection('notificacoes').get());
  // limpeza: só vencidas, só gerência
  await assertFails(como(G).doc('notificacoes/geral').delete());
  await assertFails(n1.doc('notificacoes/velha').delete());
  await assertSucceeds(como(G).doc('notificacoes/velha').delete());
});

test('marcar notificações como lidas no próprio perfil', async () => {
  await assertSucceeds(como(N1).doc(`usuarios/${N1}`).update({ notifVistasEm: Date.now() }));
  await assertFails(como(N1).doc(`usuarios/${N2}`).update({ notifVistasEm: Date.now() }));
});

/* ---------------------------------------------------------------- vários líderes / sem líder */

const S = 'semLider', M = 'multi';
async function prepararLideres() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`usuarios/${S}`).set({ ...pessoa('analista'), liderIds: [] });
    await db.doc(`usuarios/${M}`).set({ ...pessoa('analista', L1), liderIds: [L1, L2] });
    await db.doc('tarefas/tS').set(tarefa(S, { responsavelId: S, criadoPor: S }));
  });
}

test('analista sem líder cria e vê as próprias tarefas; líder não vê; gerência vê', async () => {
  await prepararLideres();
  await assertSucceeds(como(S).collection('tarefas').add(tarefa(S, { responsavelId: S, criadoPor: S })));
  await assertSucceeds(como(S).doc('tarefas/tS').get());
  await assertSucceeds(como(S).collection('tarefas').where('equipeId', 'in', [S]).get());
  await assertFails(como(S).collection('tarefas').add(tarefa(L1, { criadoPor: S })));
  await assertFails(como(L1).doc('tarefas/tS').get());
  await assertSucceeds(como(G).doc('tarefas/tS').get());
});

test('gerência move as tarefas "sem líder" para a equipe do líder novo', async () => {
  await prepararLideres();
  await assertFails(como(S).doc('tarefas/tS').update({ equipeId: L1 }));
  await assertSucceeds(como(G).doc(`usuarios/${S}`).update({ liderIds: [L1], liderId: L1 }));
  await assertSucceeds(como(G).doc('tarefas/tS').update({ equipeId: L1 }));
  await assertSucceeds(como(L1).doc('tarefas/tS').get());
  await assertSucceeds(como(S).doc('tarefas/tS').get());
});

test('analista com dois líderes vê as duas equipes; cada líder só a sua', async () => {
  await prepararLideres();
  await assertSucceeds(como(M).doc('tarefas/t1').get());
  await assertSucceeds(como(M).doc('tarefas/t2').get());
  await assertSucceeds(como(M).collection('tarefas').where('equipeId', 'in', [L1, L2, M]).get());
  await assertSucceeds(como(M).collection('tarefas').add(tarefa(L2, { criadoPor: M })));
  await assertFails(como(L1).doc('tarefas/t2').get());
  await assertFails(como(L2).doc('tarefas/t1').get());
  // notificação da equipe do líder 2 chega para o analista dos dois
  await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc('notificacoes/n2').set(notif({ equipeId: L2, por: L2 })));
  await assertSucceeds(como(M).doc('notificacoes/n2').get());
  await assertFails(como(L1).doc('notificacoes/n2').get());
});

test('convite sem líder cria analista "sem líder"', async () => {
  await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc('convites/semlider').set({
    nivel: 'analista', liderId: null, criadoPor: G, criadoEm: 1, expiraEm: Date.now() + DIA, usado: false }));
  const db = como(X);
  const lote = db.batch();
  lote.set(db.doc(`usuarios/${X}`), { ...pessoa('analista'), liderIds: [], convite: 'semlider' });
  lote.update(db.doc('convites/semlider'), { usado: true, usadoPor: X, usadoEm: Date.now() });
  await assertSucceeds(lote.commit());
});

test('convite não deixa forjar a lista de líderes', async () => {
  await assertFails(usarConvite(X, 'bom', { ...pessoa('analista', L1), liderIds: [L1, L2] }));
  await assertSucceeds(usarConvite(X, 'bom', { ...pessoa('analista', L1), liderIds: [L1] }));
});
