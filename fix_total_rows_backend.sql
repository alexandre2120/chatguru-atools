-- 🎯 CORREÇÃO DEFINITIVA: Backend está vendo total=1000 em vez de 7784

-- 1. Verificar o problema atual
SELECT 
    '🔍 PROBLEMA ATUAL' as info,
    id,
    workspace_hash,
    total_rows as backend_sees,
    (SELECT COUNT(*) FROM upload_items WHERE upload_id = uploads.id) as real_count,
    processed_rows,
    status
FROM uploads 
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
ORDER BY created_at DESC 
LIMIT 1;

-- 2. CORRIGIR o total_rows para o valor real
UPDATE uploads 
SET 
    total_rows = (
        SELECT COUNT(*) 
        FROM upload_items 
        WHERE upload_id = uploads.id
    ),
    updated_at = NOW()
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
  AND id = (
    SELECT id FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC 
    LIMIT 1
  );

-- 3. Forçar recálculo completo de todos os contadores
UPDATE uploads 
SET 
    processed_rows = (
        SELECT COUNT(*) 
        FROM upload_items 
        WHERE upload_id = uploads.id 
          AND state IN ('done', 'error')
    ),
    succeeded_rows = (
        SELECT COUNT(*) 
        FROM upload_items 
        WHERE upload_id = uploads.id 
          AND state = 'done'
    ),
    failed_rows = (
        SELECT COUNT(*) 
        FROM upload_items 
        WHERE upload_id = uploads.id 
          AND state = 'error'
    ),
    status = CASE 
        WHEN (SELECT COUNT(*) FROM upload_items WHERE upload_id = uploads.id AND state IN ('queued', 'adding', 'waiting_status')) > 0 
        THEN 'running'
        WHEN (SELECT COUNT(*) FROM upload_items WHERE upload_id = uploads.id AND state IN ('done', 'error')) = 
             (SELECT COUNT(*) FROM upload_items WHERE upload_id = uploads.id)
        THEN 'completed'
        ELSE 'running'
    END,
    updated_at = NOW()
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576';

-- 4. Verificar correção
SELECT 
    '✅ APÓS CORREÇÃO' as info,
    id,
    total_rows as backend_will_see,
    processed_rows,
    succeeded_rows,
    failed_rows,
    status,
    (SELECT COUNT(*) FROM upload_items WHERE upload_id = uploads.id) as real_total,
    (SELECT COUNT(*) FROM upload_items WHERE upload_id = uploads.id AND state IN ('queued', 'adding', 'waiting_status')) as pending_items
FROM uploads 
WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
ORDER BY created_at DESC 
LIMIT 1;

-- 5. Verificar status detalhado dos items restantes
SELECT 
    '📊 STATUS DOS ITEMS' as info,
    state,
    COUNT(*) as count
FROM upload_items 
WHERE upload_id = (
    SELECT id FROM uploads 
    WHERE workspace_hash = '8a5f094c51306ff9a29af0f5b5555a49c85fa7f52809b11e9e4a4c9f31bfb576'
    ORDER BY created_at DESC 
    LIMIT 1
)
GROUP BY state
ORDER BY count DESC;