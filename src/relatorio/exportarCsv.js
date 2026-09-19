function escaparCampo(valor) {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  if (texto.includes(",") || texto.includes('"') || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function formatarData(data) {
  return new Date(data).toISOString().slice(0, 10);
}

function gerarCsv(prestacoes, labelBeneficio) {
  const cabecalho = ["matricula_colaborador", "nome_colaborador", "beneficio", "valor_reembolsado", "data_aprovacao", "status"];
  const linhas = prestacoes.map((p) =>
    [
      p.colaborador_id,
      p.colaborador_nome,
      labelBeneficio[p.beneficio] || p.beneficio,
      p.valor_reembolsado,
      formatarData(p.criado_em),
      p.status,
    ]
      .map(escaparCampo)
      .join(",")
  );

  return [cabecalho.join(","), ...linhas].join("\n");
}

module.exports = { gerarCsv };
