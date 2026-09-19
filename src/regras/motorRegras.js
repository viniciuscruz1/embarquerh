const pool = require("../db/pool");

const LABEL_PAPEL = {
  cobranca: "documento de cobrança (boleto/nota fiscal)",
  pagamento: "comprovante de pagamento",
  receita_medica: "receita médica",
};

function formatarReais(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pegarDoc(documentos, papel) {
  return documentos.find((doc) => doc.papelDocumento === papel);
}

function calcularIdadeAnos(dataNascimentoISO, dataReferencia) {
  const nascimento = new Date(dataNascimentoISO);
  let idade = dataReferencia.getFullYear() - nascimento.getFullYear();
  const aniversarioJaOcorreuEsteAno =
    dataReferencia.getMonth() > nascimento.getMonth() ||
    (dataReferencia.getMonth() === nascimento.getMonth() && dataReferencia.getDate() >= nascimento.getDate());
  if (!aniversarioJaOcorreuEsteAno) idade -= 1;
  return idade;
}

function inicioCicloAnual(dataReferencia, mesDiaRenovacao) {
  const [mes, dia] = mesDiaRenovacao.split("-").map(Number);
  const anoAtual = dataReferencia.getFullYear();
  const renovacaoEsteAno = new Date(anoAtual, mes - 1, dia);
  if (dataReferencia >= renovacaoEsteAno) return renovacaoEsteAno;
  return new Date(anoAtual - 1, mes - 1, dia);
}

async function buscarRegra(beneficio) {
  const resultado = await pool.query(
    "SELECT * FROM regras WHERE beneficio = $1 AND ativo = true",
    [beneficio]
  );
  return resultado.rows[0] || null;
}

function verificarDocumentosExigidos(documentosExigidos, documentosExtraidos) {
  const faltando = documentosExigidos.filter((papel) => !pegarDoc(documentosExtraidos, papel));
  if (faltando.length > 0) {
    return `Ainda faltam os seguintes documentos: ${faltando.map((p) => LABEL_PAPEL[p] || p).join(", ")}.`;
  }
  return null;
}

// Creche e subsidio educacional sao ambos "despesas escolares" e um documento generico
// de mensalidade nao deixa claro qual dos dois e (isso so se define pela idade da crianca,
// ja checada separadamente em avaliarCreche). Por isso ficam no mesmo grupo, para nao gerar
// falso positivo de "documento nao bate com o beneficio declarado".
const GRUPO_BENEFICIO = {
  creche: "educacao",
  subsidio_educacional: "educacao",
  ocular: "ocular",
};

function verificarBeneficioDivergente(beneficioDeclarado, documentosExtraidos) {
  const grupoDeclarado = GRUPO_BENEFICIO[beneficioDeclarado];
  const divergente = documentosExtraidos.find((doc) => {
    if (!doc.beneficioProvavel || doc.beneficioProvavel === "desconhecido") return false;
    return GRUPO_BENEFICIO[doc.beneficioProvavel] !== grupoDeclarado;
  });
  if (divergente) {
    return `Você informou "${beneficioDeclarado}", mas um dos documentos enviados parece se referir a "${divergente.beneficioProvavel}". Confira e envie novamente os documentos corretos.`;
  }
  return null;
}

async function avaliarCreche(colaborador, regra, documentosExtraidos) {
  if (!colaborador.data_nascimento_filho) {
    return { status: "recusado", motivo: "A data de nascimento do seu filho(a) não está cadastrada. Contate o RH para atualizar seu cadastro." };
  }

  const idade = calcularIdadeAnos(colaborador.data_nascimento_filho, new Date());
  if (idade > regra.parametros.idadeMaximaAnos) {
    return {
      status: "recusado",
      motivo: `Seu filho(a) já tem ${idade} anos, acima do limite de ${regra.parametros.idadeMaximaAnos} anos para o auxílio-creche.`,
    };
  }

  const cobranca = pegarDoc(documentosExtraidos, "cobranca");
  const escolaIdentificada = documentosExtraidos.some((doc) => doc.nomeEstabelecimento || doc.cnpjPrestador);
  if (!escolaIdentificada) {
    return { status: "recusado", motivo: "Não foi possível identificar o nome ou CNPJ da escola nos documentos enviados." };
  }

  if (!cobranca.valor || cobranca.valor <= 0) {
    return { status: "recusado", motivo: "Não foi possível identificar o valor no documento de cobrança." };
  }

  const valorReembolsado = Math.min(cobranca.valor, regra.parametros.tetoValorMensal);
  const observacaoTeto =
    cobranca.valor > regra.parametros.tetoValorMensal
      ? ` (valor da nota era ${formatarReais(cobranca.valor)}, acima do teto de ${formatarReais(regra.parametros.tetoValorMensal)})`
      : "";

  return {
    status: "aprovado",
    motivo: `Reembolso de ${formatarReais(valorReembolsado)}${observacaoTeto}.`,
    valorReembolsado,
  };
}

async function avaliarOcular(colaborador, regra, documentosExtraidos) {
  const cobranca = pegarDoc(documentosExtraidos, "cobranca");
  if (!cobranca.valor || cobranca.valor <= 0) {
    return { status: "recusado", motivo: "Não foi possível identificar o valor no documento de cobrança." };
  }

  const valorBruto = cobranca.valor * regra.parametros.percentualReembolso;

  const inicioCiclo = inicioCicloAnual(new Date(), regra.parametros.renovacaoMesDia);
  const resultado = await pool.query(
    `SELECT COALESCE(SUM(valor_reembolsado), 0) AS usado
     FROM prestacoes_conta
     WHERE colaborador_id = $1 AND beneficio = 'ocular' AND status = 'aprovado' AND criado_em >= $2`,
    [colaborador.id, inicioCiclo]
  );
  const jaUsado = Number(resultado.rows[0].usado);
  const saldoRestante = regra.parametros.saldoAnualBase - jaUsado;

  if (saldoRestante <= 0) {
    return {
      status: "recusado",
      motivo: `Seu saldo anual do auxílio ocular (${formatarReais(regra.parametros.saldoAnualBase)}) já foi utilizado integralmente. Renova em 1º de junho.`,
    };
  }

  const valorReembolsado = Math.min(valorBruto, saldoRestante);
  const parcial = valorReembolsado < valorBruto;
  const motivoParcial = parcial
    ? ` Valor limitado ao saldo restante do seu ciclo anual (${formatarReais(saldoRestante)} de ${formatarReais(regra.parametros.saldoAnualBase)}).`
    : "";

  return {
    status: "aprovado",
    motivo: `Reembolso de ${formatarReais(valorReembolsado)} (${regra.parametros.percentualReembolso * 100}% do valor da nota).${motivoParcial}`,
    valorReembolsado,
  };
}

async function avaliarSubsidioEducacional(colaborador, regra, documentosExtraidos) {
  const cobranca = pegarDoc(documentosExtraidos, "cobranca");
  const pagamento = pegarDoc(documentosExtraidos, "pagamento");

  if (!cobranca.valor || !pagamento.valor) {
    return { status: "recusado", motivo: "Não foi possível identificar o valor no documento de cobrança e/ou no comprovante de pagamento." };
  }

  const valorBase = Math.min(cobranca.valor, pagamento.valor);
  const valorReembolsado = valorBase * regra.parametros.percentualReembolso;

  return {
    status: "aprovado",
    motivo: `Reembolso de ${formatarReais(valorReembolsado)} (${regra.parametros.percentualReembolso * 100}% de ${formatarReais(valorBase)}).`,
    valorReembolsado,
  };
}

const AVALIADORES = {
  creche: avaliarCreche,
  ocular: avaliarOcular,
  subsidio_educacional: avaliarSubsidioEducacional,
};

async function avaliarPrestacao(colaborador, beneficioDeclarado, documentosExtraidos) {
  const regra = await buscarRegra(beneficioDeclarado);
  if (!regra) {
    return { status: "recusado", motivo: `Benefício "${beneficioDeclarado}" não é um dos benefícios aceitos atualmente.` };
  }

  const motivoFaltando = verificarDocumentosExigidos(regra.documentos_exigidos, documentosExtraidos);
  if (motivoFaltando) {
    return { status: "recusado", motivo: motivoFaltando };
  }

  const motivoDivergente = verificarBeneficioDivergente(beneficioDeclarado, documentosExtraidos);
  if (motivoDivergente) {
    return { status: "recusado", motivo: motivoDivergente };
  }

  const avaliador = AVALIADORES[beneficioDeclarado];
  return avaliador(colaborador, regra, documentosExtraidos);
}

module.exports = { avaliarPrestacao, buscarRegra, verificarDocumentosExigidos, LABEL_PAPEL };
