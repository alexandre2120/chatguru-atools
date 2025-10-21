# 🚀 Guia de Deploy para Vercel

## ⚠️ IMPORTANTE: Execute ANTES do Deploy

### 1️⃣ Migrar Banco de Dados de Produção

Execute o script de migração no Supabase **ANTES** de fazer deploy:

```sql
-- Abra o SQL Editor no Supabase Dashboard
-- Cole e execute: migration-production-safe.sql
```

Este script irá:
- ✅ Migrar itens em andamento para o novo formato
- ✅ Atualizar estados sem interromper processamento
- ✅ Criar índices para performance
- ✅ Verificar consistência dos dados

### 2️⃣ Configurar Variáveis de Ambiente na Vercel

Acesse o painel da Vercel e configure as seguintes variáveis:

#### Supabase (obrigatório)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
```

#### Secrets (obrigatório)
```bash
# Admin Panel - MUDE PARA UM VALOR FORTE E SEGURO!
ADMIN_SECRET=seu-secret-forte-aqui-use-senha-segura

# Cron Jobs - Para /api/jobs/tick
CRON_SECRET=seu-cron-secret-aqui
```

#### Opcional (desenvolvimento)
```bash
# Para testes locais apenas
MOCK_CHATGURU=false
```

### 3️⃣ Deploy na Vercel

#### Opção A: Via Dashboard
1. Acesse [vercel.com/dashboard](https://vercel.com/dashboard)
2. Clique em "Add New Project"
3. Importe do GitHub: `alexandre2120/chatguru-atools`
4. Configure as variáveis de ambiente (passo 2)
5. Clique em "Deploy"

#### Opção B: Via CLI
```bash
# Instalar Vercel CLI (se necessário)
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 4️⃣ Configurar Cron Job na Vercel

Após o deploy, configure o cron job:

1. Vá em **Project Settings** → **Cron Jobs**
2. Adicione:
   - **Path**: `/api/jobs/tick`
   - **Schedule**: `* * * * *` (a cada minuto)
   - **HTTP Method**: GET
   - **Custom Headers**:
     ```
     x-cron-secret: [seu-CRON_SECRET]
     ```

### 5️⃣ Testar o Painel Admin

1. Acesse: `https://seu-app.vercel.app/admin`
2. Use o `ADMIN_SECRET` configurado para fazer login
3. Verifique se os dados estão sendo exibidos corretamente

---

## 📋 Checklist de Deploy

- [ ] Script de migração executado no Supabase
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] Deploy realizado com sucesso
- [ ] Cron job configurado
- [ ] Painel admin acessível e funcionando
- [ ] Dados sendo exibidos corretamente

---

## 🔧 Troubleshooting

### Erro: "fetch failed" no admin panel
- ✅ Verifique se `NEXT_PUBLIC_SUPABASE_URL` está correto
- ✅ Teste se a URL resolve: `curl -I https://seu-projeto.supabase.co`

### Erro: "Unauthorized" no admin
- ✅ Verifique se `ADMIN_SECRET` está configurado na Vercel
- ✅ Use o mesmo valor no login

### Cron job não está executando
- ✅ Verifique se o `CRON_SECRET` está configurado
- ✅ Veja os logs em **Deployments** → **Functions**

### Itens travados em "adding"
- ✅ Execute o script `migration-production-safe.sql`
- ✅ Aguarde o próximo ciclo do cron job (1 minuto)

---

## 📊 Monitoramento

- **Admin Panel**: `https://seu-app.vercel.app/admin`
- **Vercel Logs**: Dashboard → Deployments → Functions
- **Supabase Logs**: Dashboard → Logs

---

## 🔄 Rollback de Emergência

Se algo der errado na migração, execute no Supabase:

```sql
BEGIN;
UPDATE upload_items SET state = 'adding' 
WHERE state = 'waiting_batch_check';

UPDATE uploads SET status = 'running' 
WHERE status = 'checking';

UPDATE workspaces 
SET last_addition_at = NULL, checking_started_at = NULL;
COMMIT;
```

Depois faça rollback do deploy na Vercel: **Deployments** → deployment anterior → **Promote to Production**
