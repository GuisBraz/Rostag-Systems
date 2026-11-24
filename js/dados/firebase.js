/* Fonte de dados real: Firebase Auth + Firestore (SDK compat via <script>).
   Coleções: usuarios/{uid}, projetos/{id}, tarefas/{id}.
   Quem vê o quê é garantido pelo firestore.rules; aqui as consultas só pedem
   o que cada nível tem permissão de ler. */

import { FIREBASE_CONFIG } from '../config.js';
import { equipeDe, ehGerente, ativo } from '../dominio/regras.js';

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
  async cadastrar(nome, email, senha) {
    const cred = await fb.auth().createUserWithEmailAndPassword(email, senha);
    await cred.user.updateProfile({ displayName: nome });
    await db().collection('usuarios').doc(cred.user.uid).set({
      nome, email, nivel: 'pendente', liderId: null, criadoEm: Date.now()
    });
  },
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

  async salvarProjeto(dados, id) {
    const col = db().collection('projetos');
    if (id) await col.doc(id).update(dados);
    else await col.add({ status: 'aberto', criadoEm: Date.now(), ...dados });
  },

  async criarTarefa(dados, autorId) {
    const agora = Date.now();
    const ref = await db().collection('tarefas').add({
      checklist: [], comentarios: [], concluidaEm: null, ...dados,
      criadoPor: autorId, criadoEm: agora, atualizadoEm: agora,
      historico: [{ em: agora, por: autorId, texto: 'criou a tarefa' }]
    });
    return ref.id;
  },

  async atualizarTarefa(id, patch, autorId, eventos = []) {
    const agora = Date.now();
    const dados = { ...patch, atualizadoEm: agora };
    if (eventos.length) dados.historico = uniao(...eventos.map((texto, i) => ({ em: agora + i, por: autorId, texto })));
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
