const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ESQUEMA_RESPOSTA = {
  type: "object",
  properties: {
    papelDocumento: {
      type: "string",
      enum: ["cobranca", "pagamento", "receita_medica", "outro"],
      description:
        "cobranca = boleto ou nota fiscal que mostra um valor a pagar (ainda nao pago); pagamento = recibo, extrato de cartao ou comprovante que mostra que o valor JA foi pago; receita_medica = prescricao/receita de oftalmologista para lentes/oculos; outro = nao se encaixa em nenhum desses",
    },
    tipoDocumento: { type: "string", description: "ex: nota fiscal, recibo, boleto, extrato, receita medica" },
    valor: { type: "number", description: "valor nominal/de face do documento, em reais, SEM incluir multa ou juros por atraso" },
    dataTextoOriginal: { type: "string", description: "cite exatamente como a data aparece escrita no documento" },
    data: { type: "string", description: "a mesma data de dataTextoOriginal, convertida para o formato AAAA-MM-DD" },
    cnpjPrestador: { type: "string", description: "CNPJ do prestador/estabelecimento/escola, se houver" },
    nomeEstabelecimento: { type: "string", description: "nome da escola, otica, clinica ou estabelecimento, se houver" },
    beneficiario: { type: "string", description: "nome da pessoa atendida/beneficiada (aluno, paciente), se constar" },
    codigoValidacao: {
      type: "string",
      description: "chave de acesso da nota fiscal (44 digitos) ou linha digitavel/codigo de barras do boleto, se estiver visivel no documento. Deixe vazio se nao encontrar.",
    },
    beneficioProvavel: {
      type: "string",
      enum: ["creche", "ocular", "subsidio_educacional", "desconhecido"],
      description: "qual dos 3 beneficios esse documento provavelmente se refere, com base no conteudo",
    },
    observacoes: { type: "string", description: "qualquer coisa relevante ou estranha notada no documento" },
  },
  required: ["papelDocumento", "tipoDocumento", "valor", "dataTextoOriginal", "data", "beneficioProvavel"],
};

const PROMPT = `Você está analisando UM documento enviado por um colaborador para reembolso de um dos seguintes benefícios da empresa: auxílio-creche, auxílio ocular (óculos, lentes, consultas oftalmológicas) ou subsídio educacional.

O colaborador pode enviar mais de um documento na mesma prestação de contas (ex: um boleto E um comprovante de pagamento). Sua tarefa é analisar APENAS o documento atual e classificar corretamente qual papel ele exerce (campo papelDocumento):
- "cobranca": documento que mostra uma cobrança/débito a pagar (boleto, nota fiscal, fatura) — normalmente NÃO tem indicação de que já foi pago.
- "pagamento": documento que comprova que o valor JÁ foi pago (recibo, extrato de cartão/conta, comprovante de transferência/PIX).
- "receita_medica": prescrição médica/oftalmológica para lentes ou óculos.
- "outro": qualquer coisa que não se encaixe nos anteriores.

Extraia os dados exatamente no formato JSON pedido. Não invente valores que não constam no documento — se não encontrar um campo, deixe-o vazio ("") ou 0, exceto beneficioProvavel e papelDocumento, que devem ser sua melhor estimativa com base no conteúdo do documento.

Para o campo "valor": use o valor NOMINAL/de face do documento (ex: "Valor do Documento"), SEM incluir multa ou juros por atraso, mesmo que exista um "valor cobrado" maior por causa disso.

Para o campo "data": use exclusivamente uma data que esteja visivelmente impressa no conteúdo do documento (ex: "Data Documento", "Data de Emissão"). Nunca use metadados internos do arquivo (como data de criação ou modificação do PDF).

Para o campo "codigoValidacao": procure a chave de acesso da nota fiscal (sequência longa de 44 dígitos, geralmente perto de um código de barras) ou a linha digitável do boleto (números separados em grupos, geralmente acima do código de barras). Se não encontrar nenhum dos dois, deixe vazio.`;

async function extrairComprovante(bufferArquivo, mimeType) {
  const tipoConteudo = mimeType === "application/pdf" ? "document" : "image";

  const interaction = await ai.interactions.create({
    model: "gemini-3.6-flash",
    input: [
      { type: "text", text: PROMPT },
      {
        type: tipoConteudo,
        data: bufferArquivo.toString("base64"),
        mime_type: mimeType,
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: ESQUEMA_RESPOSTA,
    },
  });

  return JSON.parse(interaction.output_text);
}

module.exports = { extrairComprovante };
