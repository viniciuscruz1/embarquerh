require("dotenv").config();
const pool = require("../src/db/pool");
const regras = require("../src/regras/regras.seed.json");

const {
  SEED_COLABORADOR_NOME,
  SEED_COLABORADOR_WHATSAPP,
  SEED_COLABORADOR_EMAIL,
  SEED_COLABORADOR_DATA_NASCIMENTO_FILHO,
} = process.env;

async function main() {
  if (SEED_COLABORADOR_NOME && SEED_COLABORADOR_WHATSAPP && SEED_COLABORADOR_EMAIL) {
    await pool.query(
      `INSERT INTO colaboradores (nome, whatsapp, email, data_nascimento_filho)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (whatsapp) DO UPDATE SET data_nascimento_filho = EXCLUDED.data_nascimento_filho`,
      [
        SEED_COLABORADOR_NOME,
        SEED_COLABORADOR_WHATSAPP,
        SEED_COLABORADOR_EMAIL,
        SEED_COLABORADOR_DATA_NASCIMENTO_FILHO || null,
      ]
    );
    console.log("Colaborador de teste inserido/atualizado a partir das variaveis de ambiente.");
  } else {
    console.log("Nenhum colaborador de teste inserido (defina SEED_COLABORADOR_NOME, SEED_COLABORADOR_WHATSAPP e SEED_COLABORADOR_EMAIL no .env para inserir um).");
  }

  for (const [beneficio, regra] of Object.entries(regras)) {
    await pool.query(
      `INSERT INTO regras (beneficio, parametros, documentos_exigidos, elegibilidade_descricao)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (beneficio) DO UPDATE SET
         parametros = EXCLUDED.parametros,
         documentos_exigidos = EXCLUDED.documentos_exigidos,
         elegibilidade_descricao = EXCLUDED.elegibilidade_descricao,
         atualizado_em = now()`,
      [beneficio, JSON.stringify(regra.parametros), JSON.stringify(regra.documentosExigidos), regra.elegibilidadeDescricao]
    );
  }

  console.log("Seed de regras concluido.");
  await pool.end();
}

main().catch((erro) => {
  console.error("Erro no seed:", erro);
  process.exit(1);
});
