CREATE TABLE IF NOT EXISTS colaboradores (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  data_nascimento_filho DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regras (
  id SERIAL PRIMARY KEY,
  beneficio TEXT UNIQUE NOT NULL,
  parametros JSONB NOT NULL,
  documentos_exigidos JSONB NOT NULL,
  elegibilidade_descricao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prestacoes_conta (
  id SERIAL PRIMARY KEY,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  beneficio TEXT NOT NULL,
  documentos_extraidos JSONB NOT NULL,
  valor_reembolsado NUMERIC,
  status TEXT NOT NULL,
  motivo_recusa TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
