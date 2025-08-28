# Como aplicar a migration para corrigir o problema de credenciais

## Passos para aplicar a migration no Supabase:

1. Acesse o Supabase Dashboard
2. Vá até o SQL Editor
3. Execute o seguinte comando SQL:

```sql
-- Migration to add credentials column to uploads table
-- This stores encrypted credentials temporarily for cron job processing

ALTER TABLE uploads 
ADD COLUMN IF NOT EXISTS credentials jsonb;

-- Add comment explaining the field
COMMENT ON COLUMN uploads.credentials IS 'Encrypted ChatGuru credentials (key, phoneId) for API calls. Temporarily stored for cron job access.';
```

## O que foi corrigido:

1. **Route tick (`/api/jobs/tick`)**: Agora busca as credenciais da tabela uploads em vez de usar valores hardcoded
2. **Route uploads (`/api/uploads`)**: Agora salva as credenciais (key e phoneId) junto com o upload
3. **Frontend**: Agora envia as credenciais no FormData ao fazer upload

## Importante:

Após aplicar a migration no banco de dados, o sistema começará a funcionar corretamente com as credenciais reais do ChatGuru.