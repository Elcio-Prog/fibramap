-- Drop the endereco unique constraint - multiple contracts can exist at the same address
DROP INDEX IF EXISTS compras_lm_endereco_unique;