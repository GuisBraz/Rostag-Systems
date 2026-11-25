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
  await assertFails(como(G).doc('convites/c3').set(conv('analista', null, G)));
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
