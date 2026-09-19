require("dotenv").config();
const fs = require("fs");
const { criarBucketSeNaoExistir, uploadArquivo, gerarUrlAssinada } = require("../src/storage/supabaseStorage");

async function main() {
  console.log("Criando bucket (se nao existir)...");
  await criarBucketSeNaoExistir();
  console.log("Bucket OK.");

  const buffer = fs.readFileSync("scripts/exemplos/creche_cobranca.pdf");
  const caminho = "teste/creche_cobranca.pdf";
  console.log("Enviando arquivo de teste...");
  await uploadArquivo(caminho, buffer, "application/pdf");
  console.log("Upload OK:", caminho);

  const url = await gerarUrlAssinada(caminho);
  console.log("URL assinada (valida por 1h):", url);
}

main().catch((erro) => {
  console.error("Erro no teste de storage:", erro);
  process.exit(1);
});
