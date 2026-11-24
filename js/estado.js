/* Estado central do app: quem está logado e os dados que ele enxerga.
   Qualquer mudança (local ou de outra pessoa, ao vivo) dispara `aoMudar`. */

import { MODO_DEMO } from './config.js';
import { fonteLocal } from './dados/local.js';
import { fonteFirebase } from './dados/firebase.js';

export const fonte = MODO_DEMO ? fonteLocal : fonteFirebase;

export const estado = {
  carregado: false,
  usuario: null,
  usuarios: [],
  projetos: [],
  tarefas: []
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
      estado.usuarios = []; estado.projetos = []; estado.tarefas = [];
      if (usuario && usuario.nivel !== 'pendente') {
        pararDados = [
          fonte.observarUsuarios((l) => { estado.usuarios = l; avisar(); }),
          fonte.observarProjetos((l) => { estado.projetos = l; avisar(); }),
          fonte.observarTarefas(usuario, (l) => { estado.tarefas = l; avisar(); })
        ];
      }
    }
    avisar();
  });
}

export const nomeDe = (id) => (estado.usuarios.find((u) => u.id === id) || {}).nome || '—';
export const projetoDe = (id) => estado.projetos.find((p) => p.id === id) || null;
