# 🚀 Migration: Add Chat 2.0 - Batch Status Checking

## 📋 O Que Esta Migration Faz?

Esta migration implementa o novo fluxo de processamento em duas fases:

### **ANTES (1.0)**
- Adicionava 1 chat → checava status → adicionava outro → checava...
- Intercalava adição e checagem
- Causava erros por checar muito cedo

### **DEPOIS (2.0)**
- **FASE 1 - ADIÇÃO**: Adiciona TODOS os chats (6 por minuto)
- **ESPERA**: 10 minutos após última adição
- **FASE 2 - CHECAGEM**: Verifica status em lotes de 50 (em paralelo)

---

## 🎯 Mudanças no Banco de Dados

### **Novos Campos na Tabela `workspaces`**
- `last_addition_at`: Timestamp da última adição bem-sucedida
- `checking_started_at`: Timestamp de quando iniciou fase de checagem

### **Novos Estados**

#### `upload_items.state` (novo estado):
- `waiting_batch_check` ← **NOVO**: Adicionado, aguardando checagem em lote

#### `uploads.status` (novo estado):
- `checking` ← **NOVO**: Verificando status em lote

### **Novas Funções SQL**
1. `is_workspace_ready_for_checking(p_workspace_hash)`: Verifica se pode iniciar checagem
2. `get_next_checking_batch(p_workspace_hash, p_batch_size)`: Retorna próximo lote de 50 itens

### **Novos Índices**
- `idx_items_batch_check`: Para encontrar itens aguardando checagem
- `idx_workspaces_checking`: Para workspaces prontos para checagem

---

## 📝 Como Executar

### **Passo 1: Backup (IMPORTANTE!)**
```sql
-- No Supabase SQL Editor, faça backup dos dados
CREATE TABLE workspaces_backup AS SELECT * FROM workspaces;
CREATE TABLE upload_items_backup AS SELECT * FROM upload_items;
CREATE TABLE uploads_backup AS SELECT * FROM uploads;
```

### **Passo 2: Executar Migration**
1. Acesse **Supabase Dashboard** → Seu Projeto
2. Vá em **SQL Editor**
3. Crie uma **New Query**
4. Copie TODO o conteúdo de `01-add-new-states.sql`
5. Cole no editor
6. Clique em **Run**

### **Passo 3: Verificar Resultado**
Você deve ver a mensagem:
```
NOTICE: Migration Add Chat 2.0 executada com sucesso!
```

### **Passo 4: Validar Estrutura**
```sql
-- Verificar novos campos
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workspaces' 
AND column_name IN ('last_addition_at', 'checking_started_at');

-- Verificar funções
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('is_workspace_ready_for_checking', 'get_next_checking_batch');

-- Verificar índices
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('workspaces', 'upload_items') 
AND indexname LIKE '%check%';
```

---

## 🔄 Migração de Dados Existentes

O script automaticamente migra:
- Itens com estado `waiting_status` → `waiting_batch_check`

Se você tem uploads ativos, eles continuarão funcionando com a nova lógica.

---

## ⚠️ Avisos Importantes

1. **Não feche o SQL Editor** durante a execução
2. **Execute em horário de baixo uso** (se possível)
3. **Mantenha o backup** por pelo menos 1 semana
4. **Tempo estimado**: < 1 minuto (depende do volume de dados)

---

## 🛠️ Rollback (Se Necessário)

Caso precise reverter:

```sql
-- Remover novos campos
ALTER TABLE workspaces DROP COLUMN IF EXISTS last_addition_at;
ALTER TABLE workspaces DROP COLUMN IF EXISTS checking_started_at;

-- Remover índices
DROP INDEX IF EXISTS idx_items_batch_check;
DROP INDEX IF EXISTS idx_workspaces_checking;

-- Remover funções
DROP FUNCTION IF EXISTS is_workspace_ready_for_checking;
DROP FUNCTION IF EXISTS get_next_checking_batch;

-- Restaurar estado antigo
UPDATE upload_items 
SET state = 'waiting_status' 
WHERE state = 'waiting_batch_check';

-- Restaurar backup (se necessário)
TRUNCATE workspaces;
INSERT INTO workspaces SELECT * FROM workspaces_backup;
```

---

## 📊 Monitoramento Pós-Migration

### Verificar itens aguardando checagem:
```sql
SELECT 
  w.workspace_hash,
  w.last_addition_at,
  w.checking_started_at,
  COUNT(*) as items_waiting_check
FROM workspaces w
JOIN upload_items ui ON w.workspace_hash = ui.workspace_hash
WHERE ui.state = 'waiting_batch_check'
GROUP BY w.workspace_hash, w.last_addition_at, w.checking_started_at;
```

### Verificar se workspace está pronto para checagem:
```sql
SELECT 
  workspace_hash,
  is_workspace_ready_for_checking(workspace_hash) as ready_for_checking,
  last_addition_at,
  NOW() - last_addition_at as time_since_last_addition
FROM workspaces
WHERE last_addition_at IS NOT NULL;
```

---

## ✅ Checklist Pós-Execução

- [ ] Migration executada sem erros
- [ ] Campos `last_addition_at` e `checking_started_at` criados
- [ ] Funções `is_workspace_ready_for_checking` e `get_next_checking_batch` criadas
- [ ] Índices criados
- [ ] Dados existentes migrados (se houver)
- [ ] Backup mantido por segurança
- [ ] Código da aplicação atualizado para usar novos estados

---

## 📞 Suporte

Se encontrar erros durante a migration:
1. **NÃO execute comandos aleatórios**
2. Copie a mensagem de erro completa
3. Verifique os logs no Supabase Dashboard → Database → Logs
4. Execute o rollback se necessário

---

**Versão**: 2.0  
**Data**: 2025-10-21  
**Compatível com**: PostgreSQL 14+ / Supabase
