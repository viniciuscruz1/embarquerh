const express = require("express");
const pool = require("../db/pool");
const { gerarUrlAssinada } = require("../storage/supabaseStorage");
const { gerarCsv } = require("../relatorio/exportarCsv");

const router = express.Router();

const LABEL_BENEFICIO = {
  creche: "Auxílio-creche",
  ocular: "Auxílio ocular",
  subsidio_educacional: "Subsídio educacional",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function exigirLogin(req, res, next) {
  if (req.session && req.session.autenticado) return next();
  return res.redirect("/admin/login");
}

router.get("/login", (req, res) => {
  res.render("login", { erro: null });
});

router.post("/login", (req, res) => {
  if (req.body.senha === process.env.ADMIN_PASSWORD) {
    req.session.autenticado = true;
    return res.redirect("/admin/prestacoes");
  }
  res.render("login", { erro: "Senha incorreta." });
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

router.get("/", exigirLogin, (req, res) => res.redirect("/admin/prestacoes"));

router.get("/prestacoes", exigirLogin, async (req, res) => {
  const { ano, mes, beneficio, status } = req.query;

  const condicoes = [];
  const valores = [];
  if (ano) {
    valores.push(ano);
    condicoes.push(`EXTRACT(YEAR FROM p.criado_em) = $${valores.length}`);
  }
  if (mes) {
    valores.push(mes);
    condicoes.push(`EXTRACT(MONTH FROM p.criado_em) = $${valores.length}`);
  }
  if (beneficio) {
    valores.push(beneficio);
    condicoes.push(`p.beneficio = $${valores.length}`);
  }
  if (status) {
    valores.push(status);
    condicoes.push(`p.status = $${valores.length}`);
  }
  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

  const resultado = await pool.query(
    `SELECT p.*, c.nome AS colaborador_nome
     FROM prestacoes_conta p
     JOIN colaboradores c ON c.id = p.colaborador_id
     ${where}
     ORDER BY p.criado_em DESC`,
    valores
  );

  const anosResultado = await pool.query(
    "SELECT DISTINCT EXTRACT(YEAR FROM criado_em)::int AS ano FROM prestacoes_conta ORDER BY ano DESC"
  );

  res.render("prestacoes", {
    prestacoes: resultado.rows,
    anos: anosResultado.rows.map((r) => r.ano),
    meses: MESES,
    labelBeneficio: LABEL_BENEFICIO,
    filtros: { ano, mes, beneficio, status },
  });
});

router.get("/prestacoes/:id", exigirLogin, async (req, res) => {
  const resultado = await pool.query(
    `SELECT p.*, c.nome AS colaborador_nome, c.whatsapp, c.email
     FROM prestacoes_conta p
     JOIN colaboradores c ON c.id = p.colaborador_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  const prestacao = resultado.rows[0];
  if (!prestacao) return res.status(404).send("Prestação não encontrada.");

  const documentos = await Promise.all(
    prestacao.documentos_extraidos.map(async (doc) => ({
      ...doc,
      url: doc.arquivoPath ? await gerarUrlAssinada(doc.arquivoPath) : null,
    }))
  );

  res.render("detalhe", {
    prestacao,
    documentos,
    labelBeneficio: LABEL_BENEFICIO,
  });
});

router.get("/regras", exigirLogin, async (req, res) => {
  const resultado = await pool.query("SELECT * FROM regras ORDER BY beneficio");
  res.render("regras", { regras: resultado.rows, labelBeneficio: LABEL_BENEFICIO, salvo: req.query.salvo });
});

router.post("/regras/:beneficio", exigirLogin, async (req, res) => {
  const { beneficio } = req.params;
  const { elegibilidadeDescricao, ...camposParametros } = req.body;

  const parametros = {};
  for (const [chave, valor] of Object.entries(camposParametros)) {
    const numero = Number(valor);
    parametros[chave] = Number.isNaN(numero) ? valor : numero;
  }

  await pool.query(
    `UPDATE regras SET parametros = $1, elegibilidade_descricao = $2, atualizado_em = now() WHERE beneficio = $3`,
    [JSON.stringify(parametros), elegibilidadeDescricao, beneficio]
  );

  res.redirect("/admin/regras?salvo=1");
});

router.get("/relatorio.csv", exigirLogin, async (req, res) => {
  const { ano, mes } = req.query;

  const condicoes = [];
  const valores = [];
  if (ano) {
    valores.push(ano);
    condicoes.push(`EXTRACT(YEAR FROM p.criado_em) = $${valores.length}`);
  }
  if (mes) {
    valores.push(mes);
    condicoes.push(`EXTRACT(MONTH FROM p.criado_em) = $${valores.length}`);
  }
  condicoes.push(`p.status = 'aprovado'`);
  const where = `WHERE ${condicoes.join(" AND ")}`;

  const resultado = await pool.query(
    `SELECT p.*, c.nome AS colaborador_nome
     FROM prestacoes_conta p
     JOIN colaboradores c ON c.id = p.colaborador_id
     ${where}
     ORDER BY p.criado_em ASC`,
    valores
  );

  const csv = gerarCsv(resultado.rows, LABEL_BENEFICIO);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="relatorio-embarquerh.csv"`);
  res.send(csv);
});

module.exports = router;
