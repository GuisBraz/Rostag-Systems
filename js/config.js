/* ---------------------------------------------------------------------------
   Configuração do Firebase.
   Enquanto `apiKey` estiver vazio, o sistema roda em MODO DEMONSTRAÇÃO:
   os dados ficam só neste navegador (localStorage), com pessoas de exemplo,
   e dá para trocar de usuário para ver o que cada nível enxerga.

   Para usar de verdade com a equipe, crie um projeto no Firebase e cole aqui
   o bloco `firebaseConfig` (passo a passo no README.md). Esses valores são
   públicos por natureza: a segurança está no login e no firestore.rules.
--------------------------------------------------------------------------- */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDQzhhIQoQcNDe-I30QiLT7sl9rYYTkzCU',
  authDomain: 'rostag-systems.firebaseapp.com',
  projectId: 'rostag-systems',
  storageBucket: 'rostag-systems.firebasestorage.app',
  messagingSenderId: '91027548094',
  appId: '1:91027548094:web:53dc3dbe1f0b41da4a7bef'
};

// No computador (localhost), `?demo` na URL força o modo demonstração para testar
// sem mexer nos dados reais: http://localhost:5200/?demo
const forcarDemo = typeof location !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(location.hostname)
  && new URLSearchParams(location.search).has('demo');
export const MODO_DEMO = !FIREBASE_CONFIG.apiKey || forcarDemo;

export const VERSAO = '0.2.0';
export const LINKS = {
  linkedin: 'https://www.linkedin.com/in/guilherme-santos-66b8162a0',
  portfolio: 'https://guisbraz.github.io/portifolio/'
};
