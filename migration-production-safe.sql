-- ============================================================
-- MIGRAÇÃO SEGURA PARA PRODUÇÃO - Add Chats 2.0
-- ============================================================
-- Este script migra dados existentes para o novo formato
-- SEM interromper processamentos em andamento
-- Execute este ANTES de fazer deploy na Vercel
-- ============================================================

BEGIN;

-- Passo 1: Adicionar colunas se não existirem (já foi feito, mas garante)
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS last_addition_at timestamptz;

ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS checking_started_at timestamptz;

-- Passo 2: Migrar itens com estados antigos para novos estados
-- waiting_status -> waiting_batch_check
UPDATE upload_items 
SET state = 'waiting_batch_check' 
WHERE state = 'waiting_status';

-- Passo 3: Identificar e migrar estados inconsistentes
-- Itens que têm chat_add_id mas estão em 'adding' -> mover para 'waiting_batch_check'
UPDATE upload_items 
SET state = 'waiting_batch_check',
    updated_at = NOW()
WHERE state = 'adding' 
  AND chat_add_id IS NOT NULL
  AND chat_add_id != '';

-- Passo 4: Corrigir uploads que estão em estados antigos
-- Uploads em 'running' com todos itens processados -> 'checking'
UPDATE uploads u
SET status = 'checking',
    started_at = COALESCE(started_at, NOW())
WHERE status = 'running'
  AND NOT EXISTS (
    SELECT 1 FROM upload_items ui
    WHERE ui.upload_id = u.id
    AND ui.state IN ('queued', 'adding')
  )
  AND EXISTS (
    SELECT 1 FROM upload_items ui
    WHERE ui.upload_id = u.id
    AND ui.state = 'waiting_batch_check'
  );

-- Passo 5: Atualizar last_addition_at para workspaces ativos
-- Usa o último updated_at de itens em waiting_batch_check
UPDATE workspaces w
SET last_addition_at = (
  SELECT MAX(ui.updated_at)
  FROM upload_items ui
  WHERE ui.workspace_hash = w.workspace_hash
    AND ui.state = 'waiting_batch_check'
    AND ui.chat_add_id IS NOT NULL
)
WHERE EXISTS (
  SELECT 1 FROM upload_items ui
  WHERE ui.workspace_hash = w.workspace_hash
    AND ui.state = 'waiting_batch_check'
);

-- Passo 6: Limpar estados órfãos (opcional, seguro)
-- Itens sem upload_id válido -> marcar como erro
UPDATE upload_items
SET state = 'error',
    last_error_message = 'Migração: upload não encontrado',
    updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM uploads u
  WHERE u.id = upload_items.upload_id
);

-- Passo 7: Criar índices se não existirem (performance)
CREATE INDEX IF NOT EXISTS idx_items_batch_check 
ON upload_items(upload_id, state) 
WHERE state = 'waiting_batch_check';

CREATE INDEX IF NOT EXISTS idx_workspaces_checking 
ON workspaces(workspace_hash, last_addition_at, checking_started_at);

-- Passo 8: Verificar resultado da migração
DO $$
DECLARE
  v_items_migrated INT;
  v_uploads_checking INT;
  v_workspaces_updated INT;
BEGIN
  -- Contar itens migrados
  SELECT COUNT(*) INTO v_items_migrated
  FROM upload_items
  WHERE state = 'waiting_batch_check';
  
  -- Contar uploads em checking
  SELECT COUNT(*) INTO v_uploads_checking
  FROM uploads
  WHERE status = 'checking';
  
  -- Contar workspaces com last_addition_at
  SELECT COUNT(*) INTO v_workspaces_updated
  FROM workspaces
  WHERE last_addition_at IS NOT NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Itens em waiting_batch_check: %', v_items_migrated;
  RAISE NOTICE 'Uploads em checking: %', v_uploads_checking;
  RAISE NOTICE 'Workspaces atualizados: %', v_workspaces_updated;
  RAISE NOTICE '========================================';
  
  -- Alertar se houver itens órfãos
  IF EXISTS (
    SELECT 1 FROM upload_items 
    WHERE state NOT IN ('queued', 'adding', 'waiting_batch_check', 'done', 'error')
  ) THEN
    RAISE WARNING 'Atenção: Há itens com estados desconhecidos!';
  END IF;
END $$;

-- Passo 9: Verificar consistência
SELECT 
  'upload_items' as tabela,
  state,
  COUNT(*) as total
FROM upload_items
GROUP BY state
ORDER BY state;

SELECT 
  'uploads' as tabela,
  status,
  COUNT(*) as total
FROM uploads
GROUP BY status
ORDER BY status;

COMMIT;

-- ============================================================
-- ROLLBACK (caso algo dê errado)
-- ============================================================
-- Se precisar reverter, execute:
-- 
-- BEGIN;
-- UPDATE upload_items SET state = 'adding' 
-- WHERE state = 'waiting_batch_check';
-- 
-- UPDATE uploads SET status = 'running' 
-- WHERE status = 'checking';
-- 
-- UPDATE workspaces 
-- SET last_addition_at = NULL, checking_started_at = NULL;
-- COMMIT;
-- ============================================================
