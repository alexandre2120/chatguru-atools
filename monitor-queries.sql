-- 🔍 QUERIES PARA MONITORAR SEU UPLOAD ESPECÍFICO
-- Execute no Supabase SQL Editor para verificar se o fix funcionou
-- Workspace: 8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576

-- ============================================================================
-- 1. 📊 STATUS GERAL DO UPLOAD
-- ============================================================================
SELECT 
    '📊 STATUS UPLOAD' as info,
    id,
    filename,
    status,
    total_rows,
    processed_rows,
    succeeded_rows,
    failed_rows,
    ROUND((processed_rows::float / total_rows * 100), 1) as percentage_complete,
    created_at,
    completed_at,
    CASE 
        WHEN status = 'running' AND processed_rows < total_rows THEN '✅ FUNCIONANDO'
        WHEN status = 'completed' AND processed_rows < total_rows THEN '❌ TRAVADO (precisa fix)'  
        WHEN status = 'completed' AND processed_rows = total_rows THEN '🎉 CONCLUÍDO'
        ELSE '⚠️ VERIFICAR'
    END as diagnostic
FROM uploads 
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
ORDER BY created_at DESC 
LIMIT 1;

-- ============================================================================  
-- 2. 📈 DISTRIBUIÇÃO DOS ITENS POR ESTADO
-- ============================================================================
WITH upload_info AS (
    SELECT id, total_rows FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC LIMIT 1
)
SELECT 
    '📈 DISTRIBUIÇÃO ITENS' as info,
    state,
    COUNT(*) as quantidade,
    ROUND((COUNT(*)::float / upload_info.total_rows * 100), 1) as percentage,
    CASE state
        WHEN 'done' THEN '✅'
        WHEN 'queued' THEN '⏳' 
        WHEN 'adding' THEN '🔄'
        WHEN 'waiting_status' THEN '⏱️'
        WHEN 'error' THEN '❌'
        ELSE '❓'
    END as icon
FROM upload_items ui
CROSS JOIN upload_info
WHERE ui.upload_id = upload_info.id
GROUP BY state, upload_info.total_rows
ORDER BY 
    CASE state 
        WHEN 'done' THEN 1
        WHEN 'queued' THEN 2  
        WHEN 'adding' THEN 3
        WHEN 'waiting_status' THEN 4
        WHEN 'error' THEN 5
    END;

-- ============================================================================
-- 3. 🕐 ATIVIDADE RECENTE (últimos logs)
-- ============================================================================
SELECT 
    '🕐 ATIVIDADE RECENTE' as info,
    phase,
    level,
    message,
    at,
    CASE 
        WHEN at > NOW() - INTERVAL '5 minutes' THEN '🟢 RECENTE'
        WHEN at > NOW() - INTERVAL '15 minutes' THEN '🟡 ALGUNS MINS'
        ELSE '🔴 ANTIGO'
    END as recency
FROM run_logs 
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
ORDER BY at DESC 
LIMIT 10;

-- ============================================================================
-- 4. 🤖 STATUS DO WORKSPACE (rate limiting)
-- ============================================================================
SELECT 
    '🤖 WORKSPACE STATUS' as info,
    workspace_hash,
    account_id,
    server,
    last_outbound_at,
    CASE 
        WHEN last_outbound_at IS NULL THEN 'Nunca processou'
        ELSE EXTRACT(EPOCH FROM (NOW() - last_outbound_at))::int || ' segundos atrás'
    END as last_request,
    CASE 
        WHEN last_outbound_at IS NULL OR (NOW() - last_outbound_at) > INTERVAL '1 minute' 
        THEN '✅ PODE PROCESSAR' 
        ELSE '⏳ AGUARDANDO RATE LIMIT'
    END as can_process
FROM workspaces 
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576';

-- ============================================================================
-- 5. 🧮 ESTIMATIVA DE TEMPO
-- ============================================================================
WITH upload_stats AS (
    SELECT 
        total_rows - processed_rows as remaining,
        processed_rows,
        total_rows
    FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC LIMIT 1
)
SELECT 
    '🧮 ESTIMATIVA TEMPO' as info,
    remaining as itens_restantes,
    ROUND(remaining / 60.0, 1) as horas_estimadas,
    CASE 
        WHEN remaining = 0 THEN '🎉 CONCLUÍDO!'
        WHEN remaining < 60 THEN '⚡ Menos de 1 hora'
        WHEN remaining < 360 THEN '⏱️ Algumas horas'  
        ELSE '🌙 Várias horas'
    END as tempo_categoria
FROM upload_stats;

-- ============================================================================
-- 6. 🔧 AÇÃO CORRETIVA (se necessário)
-- ============================================================================

-- Se o upload ainda estiver como 'completed' mas não terminou, descomente e execute:
/*
UPDATE uploads 
SET status = 'running', completed_at = NULL
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576' 
  AND status = 'completed' 
  AND processed_rows < total_rows;

SELECT 'Upload resetado para running!' as resultado;
*/

-- ============================================================================
-- ✅ RESUMO DO QUE ESPERAR APÓS O FIX:
-- ============================================================================
/*
SINAIS DE QUE O FIX FUNCIONOU:
✅ Upload status = 'running' 
✅ Itens no estado 'queued' > 0
✅ Logs recentes (< 5 min atrás)
✅ last_outbound_at sendo atualizado regularmente
✅ processed_rows aumentando gradualmente

PRÓXIMOS PASSOS:
- Execute essas queries a cada 5-10 minutos
- O processamento continua a 1 contato/minuto  
- ~6-7 horas para completar os 6.784 restantes
- Você pode fechar e voltar depois, o processo é automático
*/