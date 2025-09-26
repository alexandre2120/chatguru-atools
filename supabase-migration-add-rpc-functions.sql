-- Migração para adicionar função RPC get_account_usage
-- Esta função é chamada no código mas pode não existir no banco

-- 1. Criar função para contar uso por account_id
CREATE OR REPLACE FUNCTION get_account_usage(p_account_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_usage integer;
BEGIN
    -- Primeira tentativa: usar tabela usage_tracking se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'usage_tracking'
    ) THEN
        SELECT COALESCE(SUM(chats_added), 0) 
        INTO total_usage
        FROM usage_tracking 
        WHERE account_id = p_account_id;
    ELSE
        -- Fallback: contar diretamente dos uploads
        -- Somar succeeded_rows de todos os uploads completed para este account_id
        SELECT COALESCE(SUM(u.succeeded_rows), 0)
        INTO total_usage
        FROM uploads u
        INNER JOIN workspaces w ON u.workspace_hash = w.workspace_hash
        WHERE w.account_id = p_account_id
          AND u.status = 'completed';
    END IF;
    
    RETURN total_usage;
END;
$$;

-- 2. Garantir que a tabela usage_tracking existe
CREATE TABLE IF NOT EXISTS usage_tracking (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT NOT NULL,
    workspace_hash TEXT NOT NULL,
    upload_id UUID REFERENCES uploads(id) ON DELETE CASCADE,
    chats_added INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Adicionar campos que estão sendo usados no código mas podem estar faltando
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS server TEXT;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS credentials JSONB;

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_usage_tracking_account ON usage_tracking(account_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_account ON workspaces(account_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);

-- 5. Comentários para documentação
COMMENT ON FUNCTION get_account_usage(text) IS 'Conta o número total de chats adicionados com sucesso para um account_id específico';
COMMENT ON TABLE usage_tracking IS 'Rastreamento detalhado de uso por account_id para controle de limites';
COMMENT ON COLUMN workspaces.account_id IS 'Account ID do ChatGuru para controle de limite de 50k contatos';
COMMENT ON COLUMN workspaces.server IS 'Servidor ChatGuru (s10, s18, etc.) para API calls';
COMMENT ON COLUMN uploads.credentials IS 'Credenciais criptografadas (key, phoneId) para processamento via cron';