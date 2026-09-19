// Testa o fluxo real (extracao via Gemini + motor de regras) usando arquivos locais,
// sem passar pelo WhatsApp/Twilio. Uso:
//   node scripts/testarFluxoCompleto.js <beneficio> <arquivo1> <arquivo2> [arquivo3]
// Exemplo:
//   node scripts/testarFluxoCompleto.js creche scripts/exemplos/creche_cobranca.pdf scripts/exemplos/creche_pagamento.pdf

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/db/pool");
const { extrairComprovante } = require("../src/ia/extrairComprovante");
const { avaliarPrestacao } = require("../src/regras/motorRegras");

const MIME_POR_EXTENSAO = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

const [, , beneficio, ...arquivos] = process.argv;

if (!beneficio || arquivos.length === 0) {
  console.error("Uso: node scripts/testarFluxoCompleto.js <beneficio> <arquivo1> [arquivo2] [arquivo3]");
  console.error("Beneficios: creche | ocular | subsidio_educacional");
  process.exit(1);
}

async function main() {
  const colaboradorResultado = await pool.query(
    "SELECT * FROM colaboradores WHERE whatsapp = $1",
    [process.env.SEED_COLABORADOR_WHATSAPP]
  );
  const colaborador = colaboradorResultado.rows[0];
  if (!colaborador) {
    console.error("Colaborador de teste nao encontrado. Rode 'npm run seed' primeiro.");
    process.exit(1);
  }

  const documentosExtraidos = [];
  for (const arquivo of arquivos) {
    const extensao = path.extname(arquivo).toLowerCase();
    const mimeType = MIME_POR_EXTENSAO[extensao];
    if (!mimeType) {
      console.error(`Extensao "${extensao}" nao suportada (${arquivo})`);
      process.exit(1);
    }
    console.log(`Extraindo ${arquivo}...`);
    const buffer = fs.readFileSync(arquivo);
    const dados = await extrairComprovante(buffer, mimeType);
    console.log(`  -> papel: ${dados.papelDocumento} | valor: ${dados.valor} | beneficioProvavel: ${dados.beneficioProvavel}`);
    documentosExtraidos.push(dados);
  }

  console.log("\nAvaliando prestacao de contas...");
  const resultado = await avaliarPrestacao(colaborador, beneficio, documentosExtraidos);

  console.log(`\n${resultado.status.toUpperCase()}: ${resultado.motivo}`);
  if (resultado.valorReembolsado) {
    console.log(`Valor a reembolsar: R$ ${resultado.valorReembolsado}`);
  }

  await pool.end();
}

main().catch((erro) => {
  console.error("Erro no teste:", erro);
  process.exit(1);
});
