require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { extrairComprovante } = require("../src/ia/extrairComprovante");

const caminhoArquivo = process.argv[2];

if (!caminhoArquivo) {
  console.error("Uso: node scripts/testarExtracao.js caminho/para/arquivo.jpg");
  process.exit(1);
}

const extensao = path.extname(caminhoArquivo).toLowerCase();
const mimePorExtensao = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};
const mimeType = mimePorExtensao[extensao];

if (!mimeType) {
  console.error(`Extensao "${extensao}" nao suportada. Use .jpg, .jpeg, .png ou .pdf`);
  process.exit(1);
}

async function main() {
  const buffer = fs.readFileSync(caminhoArquivo);
  console.log("Enviando para o Gemini, aguarde...");
  const resultado = await extrairComprovante(buffer, mimeType);
  console.log(JSON.stringify(resultado, null, 2));
}

main().catch((erro) => {
  console.error("Erro ao extrair:", erro);
  process.exit(1);
});
