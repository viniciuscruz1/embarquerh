const express = require("express");
const { twiml } = require("twilio");
const pool = require("../db/pool");
const { extrairComprovante } = require("../ia/extrairComprovante");
const { avaliarPrestacao, buscarRegra, verificarDocumentosExigidos, LABEL_PAPEL } = require("../regras/motorRegras");

const router = express.Router();

const estados = new Map();

// Mensagens do mesmo numero podem chegar quase simultaneamente (ex: varios PDFs enviados
// "juntos" no WhatsApp na verdade chegam como mensagens separadas). Sem isso, duas
// mensagens processando ao mesmo tempo podiam checar "documentos faltando" antes uma da
// outra terminar de registrar o seu, causando falso "ainda falta X". Essa fila garante que
// so uma mensagem por numero seja processada de cada vez, na ordem de chegada.
const filasPorNumero = new Map();

function executarEmFila(numero, tarefa) {
  const anterior = filasPorNumero.get(numero) || Promise.resolve();
  const atual = anterior.then(tarefa, tarefa);
  filasPorNumero.set(numero, atual.catch(() => {}));
  return atual;
}

const OPCOES_BENEFICIO = {
  "1": "creche",
  "2": "ocular",
  "3": "subsidio_educacional",
};

const LABEL_BENEFICIO = {
  creche: "Auxílio-creche",
  ocular: "Auxílio ocular",
  subsidio_educacional: "Subsídio educacional",
};

function normalizarWhatsapp(from) {
  return (from || "").replace("whatsapp:", "");
}

// Numeros brasileiros de celular podem chegar com ou sem o "9" extra apos o DDD
// (+55 98 9XXXXXXX vs +55 98 XXXXXXXX), dependendo de como o WhatsApp normaliza.
// Geramos as duas variacoes para nao depender de qual formato foi cadastrado.
function variacoesWhatsapp(whatsapp) {
  const match = whatsapp.match(/^(\+55\d{2})(9?)(\d{8})$/);
  if (!match) return [whatsapp];
  const [, prefixo, nove, restante] = match;
  return [`${prefixo}${nove}${restante}`, `${prefixo}${nove ? "" : "9"}${restante}`];
}

async function buscarColaborador(whatsapp) {
  const resultado = await pool.query("SELECT * FROM colaboradores WHERE whatsapp = ANY($1)", [
    variacoesWhatsapp(whatsapp),
  ]);
  return resultado.rows[0] || null;
}

async function baixarMidia(url) {
  const credenciais = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const resposta = await fetch(url, {
    headers: { Authorization: `Basic ${credenciais}` },
  });
  const arrayBuffer = await resposta.arrayBuffer();
  const mimeType = resposta.headers.get("content-type");
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

function listarDocumentosFaltando(documentosExigidos, documentosRecebidos) {
  const papeisRecebidos = documentosRecebidos.map((doc) => doc.papelDocumento);
  return documentosExigidos.filter((papel) => !papeisRecebidos.includes(papel));
}

async function registrarPrestacao(colaboradorId, beneficio, documentosExtraidos, resultado) {
  await pool.query(
    `INSERT INTO prestacoes_conta (colaborador_id, beneficio, documentos_extraidos, valor_reembolsado, status, motivo_recusa)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      colaboradorId,
      beneficio,
      JSON.stringify(documentosExtraidos),
      resultado.valorReembolsado || null,
      resultado.status,
      resultado.status === "recusado" ? resultado.motivo : null,
    ]
  );
}

async function processarMensagem(req, res, numero, textoRecebido, numMedia) {
  const resposta = new twiml.MessagingResponse();

  try {
    const colaborador = await buscarColaborador(numero);

    if (!colaborador) {
      resposta.message("Este número não está cadastrado como colaborador de teste do EmbarqueRH. Fale com o RH.");
      return res.type("text/xml").send(resposta.toString());
    }

    const estadoAtual = estados.get(numero);

    if (estadoAtual && estadoAtual.etapa === "aguardando_beneficio") {
      const escolha = OPCOES_BENEFICIO[textoRecebido];
      if (!escolha) {
        resposta.message("Não entendi. Responda com 1 (Auxílio-creche), 2 (Auxílio ocular) ou 3 (Subsídio educacional).");
        return res.type("text/xml").send(resposta.toString());
      }

      const regra = await buscarRegra(escolha);
      const listaDocumentos = regra.documentos_exigidos.map((papel) => LABEL_PAPEL[papel] || papel).join(", ");
      estados.set(numero, {
        etapa: "aguardando_documentos",
        beneficio: escolha,
        documentosExigidos: regra.documentos_exigidos,
        documentosRecebidos: [],
      });
      resposta.message(
        `Combinado: ${LABEL_BENEFICIO[escolha]}. Agora me envie: ${listaDocumentos}. Pode mandar tudo junto ou um de cada vez.`
      );
      return res.type("text/xml").send(resposta.toString());
    }

    if (estadoAtual && estadoAtual.etapa === "aguardando_documentos") {
      if (numMedia === 0) {
        const faltando = listarDocumentosFaltando(estadoAtual.documentosExigidos, estadoAtual.documentosRecebidos);
        resposta.message(
          `Ainda estou esperando: ${faltando.map((p) => LABEL_PAPEL[p] || p).join(", ")}. Pode mandar a foto ou o PDF?`
        );
        return res.type("text/xml").send(resposta.toString());
      }

      for (let i = 0; i < numMedia; i++) {
        const { buffer, mimeType } = await baixarMidia(req.body[`MediaUrl${i}`]);
        const dadosExtraidos = await extrairComprovante(buffer, mimeType);
        estadoAtual.documentosRecebidos.push(dadosExtraidos);
      }

      const motivoFaltando = verificarDocumentosExigidos(estadoAtual.documentosExigidos, estadoAtual.documentosRecebidos);
      if (motivoFaltando) {
        resposta.message(`Recebi. ${motivoFaltando}`);
        return res.type("text/xml").send(resposta.toString());
      }

      const resultado = await avaliarPrestacao(colaborador, estadoAtual.beneficio, estadoAtual.documentosRecebidos);
      await registrarPrestacao(colaborador.id, estadoAtual.beneficio, estadoAtual.documentosRecebidos, resultado);
      estados.delete(numero);

      if (resultado.status === "aprovado") {
        resposta.message(`✅ Prestação de contas APROVADA!\n${resultado.motivo}`);
      } else {
        resposta.message(`❌ Prestação de contas REPROVADA.\nMotivo: ${resultado.motivo}`);
      }
      return res.type("text/xml").send(resposta.toString());
    }

    estados.set(numero, { etapa: "aguardando_beneficio" });
    const primeiroNome = colaborador.nome.split(" ")[0];
    resposta.message(
      `Olá, ${primeiroNome}! Essa prestação de contas é referente a qual benefício?\n1 - Auxílio-creche\n2 - Auxílio ocular\n3 - Subsídio educacional`
    );
    return res.type("text/xml").send(resposta.toString());
  } catch (erro) {
    console.error("Erro no webhook do WhatsApp:", erro);
    resposta.message("Tive um problema para processar sua mensagem. Pode tentar novamente em instantes?");
    return res.type("text/xml").send(resposta.toString());
  }
}

router.post("/", async (req, res) => {
  const numero = normalizarWhatsapp(req.body.From);
  const textoRecebido = (req.body.Body || "").trim();
  const numMedia = parseInt(req.body.NumMedia || "0", 10);

  await executarEmFila(numero, () => processarMensagem(req, res, numero, textoRecebido, numMedia));
});

module.exports = router;
