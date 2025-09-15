-- Script específico para corrigir o upload travado do Alexandre
-- Workspace Hash: 8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576
-- Account ID: 68b308bf6999e736e4a0fbda

-- PASSO 1: Primeiro diagnóstico
SELECT 
    'DIAGNÓSTICO ATUAL' as step,
    u.id,
    u.filename,
    u.total_rows,
    u.processed_rows,
    u.succeeded_rows,
    u.failed_rows,
    u.status,
    u.completed_at
FROM uploads u
WHERE u.workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
ORDER BY u.created_at DESC
LIMIT 1;

-- PASSO 2: Ver estado dos itens
WITH upload_id AS (
    SELECT id FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    'ESTADO DOS ITENS' as step,
    state,
    COUNT(*) as quantidade
FROM upload_items ui
CROSS JOIN upload_id
WHERE ui.upload_id = upload_id.id
GROUP BY state
ORDER BY state;

-- PASSO 3: Verificar se há problema na tabela usage_tracking
SELECT 
    'VERIFICAR USAGE_TRACKING' as step,
    CASE 
        WHEN COUNT(*) = 0 THEN 'Tabela não existe - este pode ser o problema!'
        ELSE CONCAT('Tabela existe com ', COUNT(*), ' registros')
    END as status
FROM information_schema.tables 
WHERE table_name = 'usage_tracking';

-- PASSO 4: CORREÇÃO IMEDIATA
-- Esta query vai resetar o upload para continuar processamento

UPDATE uploads 
SET 
    status = 'running',
    completed_at = NULL
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
  AND status = 'completed'
  AND (succeeded_rows + failed_rows) < total_rows;

-- PASSO 5: Resetar itens que podem estar travados
WITH upload_id AS (
    SELECT id FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC 
    LIMIT 1
)
UPDATE upload_items 
SET 
    state = 'queued',
    attempts = 0,
    last_error_code = NULL,
    last_error_message = NULL,
    chat_add_id = NULL,
    updated_at = NOW()
FROM upload_id
WHERE upload_items.upload_id = upload_id.id
  AND state IN ('adding', 'waiting_status')
  AND updated_at < NOW() - INTERVAL '10 minutes'; -- Apenas itens travados há mais de 10 min

-- PASSO 6: Criar tabela usage_tracking se não existir (possível causa do problema)
CREATE TABLE IF NOT EXISTS usage_tracking (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT NOT NULL,
    workspace_hash TEXT NOT NULL,
    upload_id UUID,
    chats_added INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_usage_tracking_account ON usage_tracking(account_id);

-- PASSO 7: Verificar resultado da correção
SELECT 
    'RESULTADO DA CORREÇÃO' as step,
    u.id,
    u.filename,
    u.status,
    u.total_rows,
    u.processed_rows,
    u.succeeded_rows,
    u.failed_rows,
    (SELECT COUNT(*) FROM upload_items WHERE upload_id = u.id AND state = 'queued') as itens_na_fila
FROM uploads u
WHERE u.workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
ORDER BY u.created_at DESC
LIMIT 1;