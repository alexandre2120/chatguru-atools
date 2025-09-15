-- 🚨 INVESTIGAÇÃO PROFUNDA DO PROBLEMA PERSISTENTE
-- O upload chegou a 1000/7784 e foi marcado como completed NOVAMENTE

-- ============================================================================================
-- 1. 🔍 ANÁLISE DETALHADA DO UPLOAD ATUAL
-- ============================================================================================
SELECT 
    '🔍 UPLOAD ATUAL' as step,
    id,
    filename,
    status,
    total_rows,
    processed_rows,
    succeeded_rows,
    failed_rows,
    started_at,
    completed_at,
    created_at
FROM uploads 
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
ORDER BY created_at DESC 
LIMIT 1;

-- ============================================================================================
-- 2. 📊 CONTAGEM EXATA POR ESTADO
-- ============================================================================================
WITH current_upload AS (
    SELECT id FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    '📊 ESTADOS DETALHADOS' as step,
    state,
    COUNT(*) as count,
    MIN(row_index) as primeiro_item,
    MAX(row_index) as ultimo_item,
    COUNT(CASE WHEN attempts > 0 THEN 1 END) as tentativas_feitas
FROM upload_items ui
CROSS JOIN current_upload cu
WHERE ui.upload_id = cu.id
GROUP BY state
ORDER BY state;

-- ============================================================================================
-- 3. 🕵️ LOGS DETALHADOS RECENTES
-- ============================================================================================
SELECT 
    '🕵️ LOGS RECENTES' as step,
    at,
    phase,
    level,
    message,
    upload_id,
    item_id
FROM run_logs 
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
ORDER BY at DESC 
LIMIT 15;

-- ============================================================================================
-- 4. 🔬 AMOSTRA DE ITENS PROBLEMÁTICOS
-- ============================================================================================
WITH current_upload AS (
    SELECT id FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    '🔬 AMOSTRA ITENS' as step,
    row_index,
    chat_number,
    name,
    state,
    attempts,
    chat_add_id,
    last_error_code,
    last_error_message,
    created_at,
    updated_at
FROM upload_items ui
CROSS JOIN current_upload cu
WHERE ui.upload_id = cu.id
  AND (state != 'done' OR row_index <= 1005) -- Itens não processados ou primeiros processados
ORDER BY row_index
LIMIT 20;

-- ============================================================================================
-- 5. 📈 VERIFICAR TABELA USAGE_TRACKING
-- ============================================================================================
SELECT 
    '📈 USAGE TRACKING' as step,
    COUNT(*) as total_records,
    SUM(chats_added) as total_chats_tracked,
    MAX(created_at) as last_record
FROM usage_tracking 
WHERE account_id = '68b308bf6999e736e4a0fbda';

-- ============================================================================================
-- 6. 🔧 CORREÇÃO IMEDIATA E DIAGNÓSTICO
-- ============================================================================================

-- Primeiro: Resetar o upload para running
UPDATE uploads 
SET 
    status = 'running',
    completed_at = NULL
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
  AND status = 'completed'
  AND processed_rows < total_rows;

-- Segundo: Verificar se há itens travados há muito tempo
WITH current_upload AS (
    SELECT id FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    '🔧 ITENS TRAVADOS' as step,
    COUNT(*) as items_stuck,
    state,
    MIN(updated_at) as oldest_update
FROM upload_items ui
CROSS JOIN current_upload cu
WHERE ui.upload_id = cu.id
  AND state IN ('adding', 'waiting_status')
  AND updated_at < NOW() - INTERVAL '15 minutes'
GROUP BY state;

-- Resetar itens que estão travados há mais de 15 minutos
WITH current_upload AS (
    SELECT id FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC 
    LIMIT 1
)
UPDATE upload_items 
SET 
    state = 'queued',
    attempts = 0,
    chat_add_id = NULL,
    last_error_code = NULL,
    last_error_message = NULL,
    updated_at = NOW()
FROM current_upload cu
WHERE upload_items.upload_id = cu.id
  AND state IN ('adding', 'waiting_status') 
  AND updated_at < NOW() - INTERVAL '15 minutes';

-- ============================================================================================
-- 7. ✅ VERIFICAÇÃO FINAL
-- ============================================================================================
WITH current_upload AS (
    SELECT id FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    '✅ STATUS FINAL' as step,
    u.status as upload_status,
    COUNT(CASE WHEN ui.state = 'queued' THEN 1 END) as items_queued,
    COUNT(CASE WHEN ui.state = 'done' THEN 1 END) as items_done,
    COUNT(CASE WHEN ui.state = 'error' THEN 1 END) as items_error,
    u.total_rows,
    u.processed_rows
FROM uploads u
CROSS JOIN current_upload cu
LEFT JOIN upload_items ui ON ui.upload_id = cu.id
WHERE u.id = cu.id
GROUP BY u.status, u.total_rows, u.processed_rows;

-- ============================================================================================
-- 💡 TEORIAS SOBRE O PROBLEMA:
-- ============================================================================================
/*
POSSÍVEIS CAUSAS:

1. 🚨 DEPLOY NÃO CHEGOU NA VERCEL
   - O código corrigido pode não ter sido deployado ainda
   - Vercel pode estar usando versão antiga em cache

2. 🐛 PROBLEMA NA LÓGICA DE CONTAGEM
   - A lógica pode estar contando errado o total de itens processados
   - Alguma condição específica está marcando como completed

3. 📊 PROBLEMA NO SUPABASE RPC
   - A função get_account_usage pode ter problema
   - Limite de 10k pode estar sendo atingido incorretamente

4. ⏱️ PROBLEMA DE TIMING/CONCORRÊNCIA  
   - Rate limit muito restritivo
   - Conflitos entre múltiplas execuções do cron

PRÓXIMOS PASSOS:
1. Execute este script completo
2. Aguarde 5 minutos e monitore se voltou a processar
3. Se não funcionar, vamos forçar um novo deploy na Vercel
*/