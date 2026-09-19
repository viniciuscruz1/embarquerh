const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "comprovantes";

function headersBase() {
  return {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
  };
}

async function criarBucketSeNaoExistir() {
  const resposta = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    headers: headersBase(),
  });
  if (resposta.status === 200) return;

  const criar = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...headersBase(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
  if (!criar.ok && criar.status !== 409) {
    throw new Error(`Erro ao criar bucket: ${criar.status} ${await criar.text()}`);
  }
}

async function uploadArquivo(caminho, buffer, mimeType) {
  const resposta = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${caminho}`, {
    method: "POST",
    headers: { ...headersBase(), "Content-Type": mimeType },
    body: buffer,
  });
  if (!resposta.ok) {
    throw new Error(`Erro ao enviar arquivo: ${resposta.status} ${await resposta.text()}`);
  }
  return caminho;
}

async function gerarUrlAssinada(caminho, expiraSegundos = 3600) {
  const resposta = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${caminho}`, {
    method: "POST",
    headers: { ...headersBase(), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: expiraSegundos }),
  });
  if (!resposta.ok) {
    throw new Error(`Erro ao gerar URL assinada: ${resposta.status} ${await resposta.text()}`);
  }
  const dados = await resposta.json();
  return `${SUPABASE_URL}/storage/v1${dados.signedURL}`;
}

module.exports = { criarBucketSeNaoExistir, uploadArquivo, gerarUrlAssinada };
