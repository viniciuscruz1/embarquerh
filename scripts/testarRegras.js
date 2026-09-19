require("dotenv").config();
const pool = require("../src/db/pool");
const { avaliarPrestacao } = require("../src/regras/motorRegras");

const docCobranca = (valor, extra = {}) => ({
  papelDocumento: "cobranca",
  tipoDocumento: "boleto",
  valor,
  beneficioProvavel: "desconhecido",
  ...extra,
});
const docPagamento = (valor) => ({
  papelDocumento: "pagamento",
  tipoDocumento: "recibo",
  valor,
  beneficioProvavel: "desconhecido",
});
const docReceita = () => ({ papelDocumento: "receita_medica", tipoDocumento: "receita medica", valor: 0, beneficioProvavel: "desconhecido" });

const casos = [
  {
    nome: "Creche: filho com 6 anos, nota abaixo do teto -> aprovado pelo valor da nota",
    colaborador: { id: 1, data_nascimento_filho: "2020-01-01" },
    beneficio: "creche",
    documentos: [docCobranca(500, { nomeEstabelecimento: "Escola Exemplo" }), docPagamento(500)],
  },
  {
    nome: "Creche: nota acima do teto -> aprovado, capado em R$800",
    colaborador: { id: 1, data_nascimento_filho: "2020-01-01" },
    beneficio: "creche",
    documentos: [docCobranca(1200, { cnpjPrestador: "00.000.000/0001-00" }), docPagamento(1200)],
  },
  {
    nome: "Creche: filho com mais de 7 anos -> recusado",
    colaborador: { id: 1, data_nascimento_filho: "2015-01-01" },
    beneficio: "creche",
    documentos: [docCobranca(500, { nomeEstabelecimento: "Escola Exemplo" }), docPagamento(500)],
  },
  {
    nome: "Creche: sem data de nascimento cadastrada -> recusado",
    colaborador: { id: 1, data_nascimento_filho: null },
    beneficio: "creche",
    documentos: [docCobranca(500, { nomeEstabelecimento: "Escola Exemplo" }), docPagamento(500)],
  },
  {
    nome: "Creche: falta comprovante de pagamento -> recusado (documento faltando)",
    colaborador: { id: 1, data_nascimento_filho: "2020-01-01" },
    beneficio: "creche",
    documentos: [docCobranca(500, { nomeEstabelecimento: "Escola Exemplo" })],
  },
  {
    nome: "Ocular: dentro do saldo -> aprovado 80%",
    colaborador: { id: 99999, data_nascimento_filho: null },
    beneficio: "ocular",
    documentos: [docReceita(), docCobranca(1000), docPagamento(1000)],
  },
  {
    nome: "Subsidio educacional: valores diferentes -> usa o menor e aplica 70%",
    colaborador: { id: 1, data_nascimento_filho: null },
    beneficio: "subsidio_educacional",
    documentos: [docCobranca(300), docPagamento(250)],
  },
];

async function main() {
  for (const caso of casos) {
    const resultado = await avaliarPrestacao(caso.colaborador, caso.beneficio, caso.documentos);
    console.log(`\n${caso.nome}`);
    console.log(`  -> ${resultado.status.toUpperCase()}: ${resultado.motivo}`);
    if (resultado.valorReembolsado) console.log(`     valorReembolsado: ${resultado.valorReembolsado}`);
  }
  await pool.end();
}

main();
