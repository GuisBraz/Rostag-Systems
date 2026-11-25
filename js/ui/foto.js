/* Foto de perfil: o navegador recorta no centro (quadrado), reduz para 160×160
   e converte em JPEG leve (~10 KB). Fica guardada no próprio perfil (Firestore),
   sem precisar de armazenamento pago. */

export const LIMITE_FOTO = 30000; // caracteres do data URL (o firestore.rules confere o mesmo)

export async function reduzirFoto(arquivo, lado = 160) {
  if (!arquivo || !/^image\//.test(arquivo.type)) throw new Error('Não foi possível ler essa imagem.');
  let bmp;
  try { bmp = await createImageBitmap(arquivo); } catch { throw new Error('Não foi possível ler essa imagem.'); }
  const m = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = lado; c.height = lado;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; // PNG transparente não vira fundo preto
  ctx.fillRect(0, 0, lado, lado);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (bmp.width - m) / 2, (bmp.height - m) / 2, m, m, 0, 0, lado, lado);
  if (bmp.close) bmp.close();
  let q = 0.85;
  let url = c.toDataURL('image/jpeg', q);
  while (url.length > LIMITE_FOTO && q > 0.35) { q -= 0.1; url = c.toDataURL('image/jpeg', q); }
  if (url.length > LIMITE_FOTO) throw new Error('Não foi possível ler essa imagem.');
  return url;
}
