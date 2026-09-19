require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/db/pool");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "../src/db/schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Tabelas criadas/atualizadas com sucesso.");
  await pool.end();
}

main().catch((erro) => {
  console.error("Erro ao migrar:", erro);
  process.exit(1);
});
