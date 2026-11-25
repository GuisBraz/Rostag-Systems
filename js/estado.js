/* Estado central do app: quem está logado e os dados que ele enxerga.
   Qualquer mudança (local ou de outra pessoa, ao vivo) dispara `aoMudar`. */

import { MODO_DEMO } from './config.js';
import { fonteLocal } from './dados/local.js';
import { fonteFirebase } from './dados/firebase.js';
import { ehGerente } from './dominio/regras.js';

export const fonte = MODO_DEMO ? fonteLocal : fonteFirebase;

export const estado = {
  carregado: false,
  usuario: null,
  usuarios: [],
  projetos: [],
  tarefas: [],
  convites: [],
  notificacoes: []
};

const ouvintes = new Set();
export function aoMudar(cb) { ouvintes.add(cb); return () => ouvintes.delete(cb); }
function avisar() { ouvintes.forEach((cb) => cb(estado)); }

let pararDados = [];
let usuarioAssinado = '';

export function iniciarEstado() {
  fonte.iniciar();
  fonte.aoMudarSessao((usuario) => {
    estado.usuario = usuario;
    estado.carregado = true;
    // Re-assina os dados quando muda a pessoa ou o nível/equipe dela.
    const chave = usuario ? `${usuario.id}|${usuario.nivel}|${usuario.liderId || ''}` : '';
    if (chave !== usuarioAssinado) {
      usuarioAssinado = chave;
      pararDados.forEach((p) => p());
      pararDados = [];
      estado.usuarios = []; estado.projetos = []; estado.tarefas = []; estado.convites = []; estado.notificacoes = [];
      if (usuario && usuario.nivel !== 'pendente') {
        pararDados = [
          fonte.observarUsuarios((l) => { estado.usuarios = l; avisar(); }),
          fonte.observarProjetos((l) => { estado.projetos = l; avisar(); }),
          fonte.observarTarefas(usuario, (l) => { estado.tarefas = l; avisar(); })
        ];
        pararDados.push(fonte.observarNotificacoes(usuario, (l) => { estado.notificacoes = l; avisar(); }));
        if (ehGerente(usuario)) {
          pararDados.push(fonte.observarConvites((l) => { estado.convites = l; avisar(); }));
          fonte.limparNotificacoes().catch(() => { /* limpeza é opcional */ });
        }
      }
    }
    avisar();
  });
}

/** A pessoa (para avatar com foto); quem não existe vira só o nome "—". */
export const pessoaDe = (id) => estado.usuarios.find((u) => u.id === id) || (estado.usuario && estado.usuario.id === id ? estado.usuario : { nome: '—' });
export const nomeDe = (id) => (estado.usuarios.find((u) => u.id === id) || {}).nome || '—';
export const projetoDe = (id) => estado.projetos.find((p) => p.id === id) || null;
