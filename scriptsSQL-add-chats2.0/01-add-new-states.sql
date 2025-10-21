-- Migration: Add Chat 2.0 - Batch Status Checking
-- Adiciona novos estados para separar fase de adição da fase de checagem
-- Execute este script no Supabase SQL Editor

-- ============================================================
-- PARTE 1: Adicionar novo campo para controle de timing
-- ============================================================

-- Adiciona campo para rastrear quando foi a última adição bem-sucedida
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS last_addition_at timestamptz;

-- Adiciona campo para controlar quando iniciou a fase de checagem
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS checking_started_at timestamptz;

COMMENT ON COLUMN workspaces.last_addition_at IS 'Timestamp da última adição bem-sucedida (chat_add)';
COMMENT ON COLUMN workspaces.checking_started_at IS 'Timestamp de quando iniciou a fase de checagem em lote';

-- ============================================================
-- PARTE 2: Atualizar constraints e validações
-- ============================================================

-- Nota: PostgreSQL não tem CHECK constraints em ENUMs nativamente,
-- mas documentamos os novos valores aceitos:
-- 
-- upload_items.state: 
--   - 'queued' (na fila para adicionar)
--   - 'adding' (enviando chat_add)
--   - 'waiting_batch_check' (adicionado, aguardando checagem em lote) *** NOVO ***
--   - 'done' (confirmado como adicionado)
--   - 'error' (falhou)
--
-- uploads.status:
--   - 'queued' (aguardando início)
--   - 'running' (adicionando chats)
--   - 'checking' (verificando status em lote) *** NOVO ***
--   - 'completed' (finalizado)
--   - 'failed' (falhou)
--   - 'canceled' (cancelado)

-- ============================================================
-- PARTE 3: Migrar dados existentes (se houver)
-- ============================================================

-- Migrar itens antigos que estavam em 'waiting_status' para 'waiting_batch_check'
-- (caso você tenha dados existentes no banco)
UPDATE upload_items 
SET state = 'waiting_batch_check' 
WHERE state = 'waiting_status';

-- ============================================================
-- PARTE 4: Índices para performance
-- ============================================================

-- Índice para encontrar rapidamente itens aguardando checagem em lote
CREATE INDEX IF NOT EXISTS idx_items_batch_check 
ON upload_items(upload_id, state) 
WHERE state = 'waiting_batch_check';

-- Índice para workspaces prontos para checagem
CREATE INDEX IF NOT EXISTS idx_workspaces_checking 
ON workspaces(workspace_hash, last_addition_at, checking_started_at);

-- ============================================================
-- PARTE 5: Função helper para verificar se workspace está pronto para checagem
-- ============================================================

CREATE OR REPLACE FUNCTION is_workspace_ready_for_checking(p_workspace_hash text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_addition timestamptz;
  v_has_pending_additions boolean;
  v_has_items_to_check boolean;
BEGIN
  -- Buscar última adição
  SELECT last_addition_at INTO v_last_addition
  FROM workspaces
  WHERE workspace_hash = p_workspace_hash;
  
  -- Verificar se há itens ainda sendo adicionados
  SELECT EXISTS(
    SELECT 1 FROM upload_items
    WHERE workspace_hash = p_workspace_hash
    AND state IN ('queued', 'adding')
  ) INTO v_has_pending_additions;
  
  -- Verificar se há itens aguardando checagem
  SELECT EXISTS(
    SELECT 1 FROM upload_items
    WHERE workspace_hash = p_workspace_hash
    AND state = 'waiting_batch_check'
  ) INTO v_has_items_to_check;
  
  -- Pronto para checagem se:
  -- 1. Não há itens pendentes de adição
  -- 2. Há itens aguardando checagem
  -- 3. Passou 10 minutos desde última adição
  RETURN (
    NOT v_has_pending_additions 
    AND v_has_items_to_check 
    AND (v_last_addition IS NULL OR (NOW() - v_last_addition) >= INTERVAL '10 minutes')
  );
END;
$$;

COMMENT ON FUNCTION is_workspace_ready_for_checking IS 'Verifica se workspace completou adições e está pronto para iniciar checagem em lote (após 10min)';

-- ============================================================
-- PARTE 6: Função para obter próximo lote de checagem
-- ============================================================

CREATE OR REPLACE FUNCTION get_next_checking_batch(
  p_workspace_hash text,
  p_batch_size int DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  chat_add_id text,
  chat_number text,
  row_index int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ui.id,
    ui.chat_add_id,
    ui.chat_number,
    ui.row_index
  FROM upload_items ui
  WHERE ui.workspace_hash = p_workspace_hash
    AND ui.state = 'waiting_batch_check'
    AND ui.chat_add_id IS NOT NULL
  ORDER BY ui.row_index ASC
  LIMIT p_batch_size;
END;
$$;

COMMENT ON FUNCTION get_next_checking_batch IS 'Retorna próximo lote de até 50 itens para checagem de status';

-- ============================================================
-- PARTE 7: Verificações finais
-- ============================================================

-- Verificar se migração foi bem-sucedida
DO $$
BEGIN
  -- Verifica se colunas foram adicionadas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'last_addition_at'
  ) THEN
    RAISE EXCEPTION 'Coluna last_addition_at não foi criada!';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'checking_started_at'
  ) THEN
    RAISE EXCEPTION 'Coluna checking_started_at não foi criada!';
  END IF;
  
  RAISE NOTICE 'Migration Add Chat 2.0 executada com sucesso!';
END $$;
