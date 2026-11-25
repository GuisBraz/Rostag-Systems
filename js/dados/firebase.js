/* Fonte de dados real: Firebase Auth + Firestore (SDK compat via <script>).
   Coleções: usuarios/{uid}, projetos/{id}, tarefas/{id}.
   Quem vê o quê é garantido pelo firestore.rules; aqui as consultas só pedem
   o que cada nível tem permissão de ler. */

import { FIREBASE_CONFIG } from '../config.js';
import { equipeDe, ehGerente, ativo, VALIDADE_CONVITE_MS, DESTINO_ACAO } from '../dominio/regras.js';

let fb = null;
const db = () => fb.firestore();
const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const uniao = (...itens) => fb.firestore.FieldValue.arrayUnion(...itens);

export const fonteFirebase = {
  modo: 'firebase',

  iniciar() {
    fb = window.firebase;
    if (!fb) throw new Error('Não foi possível carregar o Firebase. Verifique a internet.');
    fb.initializeApp(FIREBASE_CONFIG);
    db().enablePersistence({ synchronizeTabs: true }).catch(() => { /* cache offline opcional */ });
  },

  aoMudarSessao(cb) {
    let pararPerfil = null;
    const pararAuth = fb.auth().onAuthStateChanged((conta) => {
      if (pararPerfil) { pararPerfil(); pararPerfil = null; }
      if (!conta) { cb(null); return; }
      const ref = db().collection('usuarios').doc(conta.uid);
      pararPerfil = ref.onSnapshot((doc) => {
        if (!doc.exists) {
          // Conta recém-criada: o `cadastrar` grava o perfil em seguida. Se for uma
          // conta antiga sem perfil (cadastro interrompido), cria aqui como pendente.
          const idadeMs = Date.now() - Date.parse(conta.metadata.creationTime || 0);
          if (idadeMs > 60000) {
            ref.set({ nome: conta.displayName || conta.email.split('@')[0], email: conta.email,
              nivel: 'pendente', liderId: null, criadoEm: Date.now() }).catch(console.error);
          }
          cb({ id: conta.uid, nome: conta.displayName || conta.email, email: conta.email, nivel: 'pendente', liderId: null });
          return;
        }
        cb({ id: doc.id, ...doc.data() });
      }, (e) => { console.error(e); cb(null); });
    });
    return () => { pararAuth(); if (pararPerfil) pararPerfil(); };
  },

  async entrar(email, senha) { await fb.auth().signInWithEmailAndPassword(email, senha); },
  async cadastrar(nome, email, senha, codigoConvite = null) {
    const cred = await fb.auth().createUserWithEmailAndPassword(email, senha);
    const uid = cred.user.uid;
    await cred.user.updateProfile({ displayName: nome });
    const perfil = db().collection('usuarios').doc(uid);
    const pendente = { nome, email, nivel: 'pendente', liderId: null, criadoEm: Date.now() };
    if (codigoConvite) {
      // Perfil já no nível do convite + convite marcado como usado, na mesma gravação
      // (o firestore.rules confere as duas coisas juntas: o link vale uma vez só).
      try {
        const conv = await db().collection('convites').doc(codigoConvite).get();
        const c = conv.data();
        const lote = db().batch();
        lote.set(perfil, { ...pendente, nivel: c.nivel, liderId: c.liderId || null, convite: codigoConvite });
        lote.update(conv.ref, { usado: true, usadoPor: uid, usadoEm: Date.now() });
        await lote.commit();
        return;
      } catch (e) { console.warn('Convite não aplicado, conta fica aguardando liberação:', e); }
    }
    await perfil.set(pendente);
  },

  async lerConvite(codigo) {
    const doc = await db().collection('convites').doc(codigo).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  observarConvites(cb) {
    return db().collection('convites').where('usado', '==', false)
      .onSnapshot((s) => cb(lista(s)), (e) => { console.error(e); cb([]); });
  },
  async criarConvite(dados, autorId) {
    const codigo = codigoAleatorio();
    const agora = Date.now();
    await db().collection('convites').doc(codigo).set({
      ...dados, criadoPor: autorId, criadoEm: agora, expiraEm: agora + VALIDADE_CONVITE_MS, usado: false
    });
    return codigo;
  },
  async cancelarConvite(codigo) { await db().collection('convites').doc(codigo).delete(); },
  async sair() { await fb.auth().signOut(); },

  observarUsuarios(cb) {
    return db().collection('usuarios').onSnapshot((s) => cb(lista(s)), console.error);
  },
  observarProjetos(cb) {
    return db().collection('projetos').onSnapshot((s) => cb(lista(s)), console.error);
  },
  observarTarefas(usuario, cb) {
    if (!ativo(usuario)) { cb([]); return () => {}; }
    let q = db().collection('tarefas');
    if (!ehGerente(usuario)) {
      const eq = equipeDe(usuario);
      if (!eq) { cb([]); return () => {}; }
      q = q.where('equipeId', '==', eq);
    }
    return q.onSnapshot((s) => cb(lista(s)), console.error);
  },

  async salvarProjeto(dados, id, autorId) {
    const col = db().collection('projetos');
    const agora = Date.now();
    if (id) {
      await col.doc(id).update({ ...dados, atualizadoEm: agora, historico: uniao({ em: agora, por: autorId, acao: 'editou' }) });
      return id;
    }
    const ref = await col.add({ status: 'aberto', criadoEm: agora, ...dados, historico: [{ em: agora, por: autorId, acao: 'criou' }] });
    return ref.id;
  },

  /** Pausar, retomar, finalizar, cancelar, reabrir, excluir (lixeira) ou restaurar. */
  async mudarSituacaoProjeto(id, acao, autorId) {
    const agora = Date.now();
    const dados = { status: DESTINO_ACAO[acao], atualizadoEm: agora, historico: uniao({ em: agora, por: autorId, acao }) };
    if (acao === 'excluir') { dados.excluidoEm = agora; dados.excluidoPor = autorId; }
    await db().collection('projetos').doc(id).update(dados);
  },

  /** Apaga de vez (só da lixeira, pela gerência/ADM): o projeto e as tarefas dele. */
  async apagarProjeto(id, tarefaIds) {
    const ids = [...tarefaIds];
    while (ids.length > 400) {
      const lote = db().batch();
      ids.splice(0, 400).forEach((t) => lote.delete(db().collection('tarefas').doc(t)));
      await lote.commit();
    }
    const lote = db().batch();
    ids.forEach((t) => lote.delete(db().collection('tarefas').doc(t)));
    lote.delete(db().collection('projetos').doc(id));
    await lote.commit();
  },

  /* ---------------------------------------------------------- notificações */
  async criarNotificacao(n) { await db().collection('notificacoes').add(n); },

  /** Junta as consultas que cada nível pode fazer (pessoais, gerais e da equipe). */
  observarNotificacoes(usuario, cb) {
    if (!ativo(usuario)) { cb([]); return () => {}; }
    const col = db().collection('notificacoes');
    const consultas = ehGerente(usuario)
      ? [col]
      : [col.where('paraId', '==', usuario.id), col.where('paraId', '==', null).where('equipeId', '==', null)];
    const eq = equipeDe(usuario);
    if (!ehGerente(usuario) && eq) consultas.push(col.where('paraId', '==', null).where('equipeId', '==', eq));
    const partes = consultas.map(() => []);
    const paradas = consultas.map((q, i) => q.onSnapshot((s) => {
      partes[i] = lista(s);
      const porId = new Map();
      partes.flat().forEach((n) => porId.set(n.id, n));
      cb([...porId.values()]);
    }, (e) => console.error(e)));
    return () => paradas.forEach((p) => p());
  },

  /** Gerência/ADM apaga as notificações vencidas (mais de 30 dias). */
  async limparNotificacoes() {
    const s = await db().collection('notificacoes').where('expiraEm', '<', Date.now()).limit(200).get();
    if (s.empty) return;
    const lote = db().batch();
    s.docs.forEach((d) => lote.delete(d.ref));
    await lote.commit();
  },

  async criarTarefa(dados, autorId) {
    const agora = Date.now();
    const ref = await db().collection('tarefas').add({
      checklist: [], comentarios: [], concluidaEm: null, ...dados,
      criadoPor: autorId, criadoEm: agora, atualizadoEm: agora,
      historico: [{ em: agora, por: autorId, acao: 'criou' }]
    });
    return ref.id;
  },

  async atualizarTarefa(id, patch, autorId, eventos = []) {
    const agora = Date.now();
    const dados = { ...patch, atualizadoEm: agora };
    if (eventos.length) dados.historico = uniao(...eventos.map((ev, i) => ({ em: agora + i, por: autorId, ...ev })));
    await db().collection('tarefas').doc(id).update(dados);
  },

  async comentar(id, texto, autorId) {
    const agora = Date.now();
    await db().collection('tarefas').doc(id).update({
      comentarios: uniao({ em: agora, por: autorId, texto }), atualizadoEm: agora
    });
  },

  async excluirTarefa(id) { await db().collection('tarefas').doc(id).delete(); },
  async atualizarUsuario(id, patch) { await db().collection('usuarios').doc(id).update(patch); }
};

/** Código do convite: 24 caracteres aleatórios (impossível de adivinhar). */
export function codigoAleatorio() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}
