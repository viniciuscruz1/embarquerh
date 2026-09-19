const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const pastaSaida = path.join(__dirname, "exemplos");
fs.mkdirSync(pastaSaida, { recursive: true });

function gerarPdf(nomeArquivo, titulo, linhas) {
  const doc = new PDFDocument({ margin: 50 });
  const caminho = path.join(pastaSaida, nomeArquivo);
  doc.pipe(fs.createWriteStream(caminho));

  doc.fontSize(16).text(titulo, { underline: true });
  doc.moveDown();
  doc.fontSize(11);
  for (const linha of linhas) {
    doc.text(linha);
    doc.moveDown(0.3);
  }

  doc.end();
  console.log("Gerado:", caminho);
}

// --- Auxilio-creche: nota acima do teto de R$800 (testa o CAP) ---
gerarPdf("creche_cobranca.pdf", "NOTA FISCAL DE SERVICOS - MENSALIDADE ESCOLAR", [
  "Colegio Aurora Ltda (fictício, para testes)",
  "CNPJ: 12.345.678/0001-90",
  "Endereco: Rua das Flores, 100 - Sao Luis - MA",
  "",
  "Aluno(a): Joao Pedro Cruz",
  "Referente a: Mensalidade escolar - Outubro/2026",
  "Data de Emissao: 05/10/2026",
  "",
  "Valor do Documento: R$ 950,00",
  "",
  "Chave de acesso: 3110 0912 3456 7800 0190 5500 1000 0000 0123 4567 8901",
]);

gerarPdf("creche_pagamento.pdf", "COMPROVANTE DE PAGAMENTO", [
  "Colegio Aurora Ltda (fictício, para testes)",
  "CNPJ: 12.345.678/0001-90",
  "",
  "Pagador: Vinicius Henrique Cruz",
  "Data do Pagamento: 06/10/2026",
  "Valor Pago: R$ 950,00",
  "Forma de pagamento: PIX",
  "",
  "Comprovante de transacao aprovada.",
]);

// --- Auxilio ocular: 80% de R$1.000 = R$800 de reembolso ---
gerarPdf("ocular_receita.pdf", "RECEITA MEDICA - OFTALMOLOGIA", [
  "Clinica Visao Clara (fictício, para testes)",
  "Dr. Carlos Mendes - CRM 12345-MA",
  "",
  "Paciente: Vinicius Henrique Cruz",
  "Data da Consulta: 01/10/2026",
  "",
  "Prescricao: Lentes com grau OD -2.00 / OE -1.75",
  "Recomenda-se lentes com tratamento anti-reflexo.",
]);

gerarPdf("ocular_cobranca.pdf", "NOTA FISCAL - OTICA", [
  "Otica Novo Olhar Ltda (fictício, para testes)",
  "CNPJ: 98.765.432/0001-10",
  "",
  "Cliente: Vinicius Henrique Cruz",
  "Item: Armacao + lentes com grau",
  "Data de Emissao: 03/10/2026",
  "",
  "Valor do Documento: R$ 1.000,00",
  "",
  "Chave de acesso: 2110 0298 7654 3200 0110 5500 2000 0000 0987 6543 2100",
]);

gerarPdf("ocular_pagamento.pdf", "COMPROVANTE DE PAGAMENTO", [
  "Otica Novo Olhar Ltda (fictício, para testes)",
  "CNPJ: 98.765.432/0001-10",
  "",
  "Pagador: Vinicius Henrique Cruz",
  "Data do Pagamento: 03/10/2026",
  "Valor Pago: R$ 1.000,00",
  "Forma de pagamento: Cartao de credito",
]);

// --- Subsidio educacional: boleto R$500 vs pagamento R$480 (testa o MENOR valor) ---
gerarPdf("subsidio_cobranca.pdf", "BOLETO BANCARIO - FACULDADE HORIZONTE", [
  "Faculdade Horizonte Ltda (fictício, para testes)",
  "CNPJ: 55.444.333/0001-22",
  "",
  "Sacado: Vinicius Henrique Cruz",
  "Referente a: Mensalidade - Outubro/2026",
  "Data do Documento: 01/10/2026",
  "Vencimento: 10/10/2026",
  "",
  "Valor do Documento: R$ 500,00",
  "",
  "Linha digitavel: 00190.00009 02971.131301 04252.510179 1 13230000050000",
]);

gerarPdf("subsidio_pagamento.pdf", "COMPROVANTE DE PAGAMENTO - EXTRATO", [
  "Banco Exemplo S.A. (fictício, para testes)",
  "",
  "Titular: Vinicius Henrique Cruz",
  "Data do Pagamento: 08/10/2026",
  "Descricao: Pagamento de boleto - Faculdade Horizonte",
  "Valor Pago: R$ 480,00",
  "(Desconto de pontualidade aplicado pela instituicao)",
]);

console.log("\nTodos os comprovantes de teste foram gerados em scripts/exemplos/");
