# 🛡️ Admin Panel - ChatGuru Atool

## 📋 Visão Geral

O painel de administração é uma página **oculta** e **protegida por senha** que permite monitorar em tempo real todas as operações do sistema, visualizar logs detalhados e acompanhar o processamento de uploads.

---

## 🔐 Acesso

### **URL**
```
https://seu-dominio.com/admin
```

### **Autenticação**

O acesso é protegido por um **secret** configurado nas variáveis de ambiente:

1. **Desenvolvimento Local**: `.env.local`
2. **Produção**: Vercel Environment Variables

```env
ADMIN_SECRET=sua-senha-super-secreta-aqui
```

⚠️ **IMPORTANTE**: Use uma senha **forte e aleatória** em produção!

### **Gerando um Secret Seguro**

```bash
# No terminal (MacOS/Linux)
openssl rand -base64 32

# Ou use um gerador online (ex: https://randomkeygen.com/)
```

---

## 🎨 Funcionalidades

### **1. Dashboard de Estatísticas** 📊

Visão geral do sistema em tempo real:

- **Total de Uploads**: Todos os uploads já processados
- **Uploads Ativos**: Uploads em estado `queued`, `running` ou `checking`
- **Total de Itens**: Todos os contatos no sistema
- **Na Fila**: Itens aguardando processamento

### **2. Distribuição por Estado** 📈

Visualização de quantos itens estão em cada estado:

- `queued` - Na fila
- `adding` - Sendo adicionados
- `waiting_batch_check` - Aguardando verificação em lote
- `done` - Concluídos
- `error` - Com erro

### **3. Itens Recentes** 👁️

Tabela com os **últimos 50 itens** atualizados no sistema:

| Coluna | Descrição |
|--------|-----------|
| **Row** | Índice da linha na planilha |
| **Chat Number** | Número do WhatsApp |
| **Name** | Nome do contato |
| **Estado** | Estado atual do processamento |
| **Tentativas** | Número de tentativas de adição |
| **Chat Add ID** | ID retornado pelo ChatGuru |
| **Última Atualização** | Timestamp da última mudança |

### **4. Logs do Sistema** 📝

Tabela paginada com **100 logs por página**:

| Coluna | Descrição |
|--------|-----------|
| **ID** | ID único do log |
| **Timestamp** | Data/hora do evento |
| **Phase** | Fase (tick, chat_add, chat_add_status, etc.) |
| **Level** | Nível (info, warn, error) |
| **Message** | Mensagem descritiva |
| **Workspace** | Hash do workspace (8 caracteres) |

**Cores dos Níveis**:
- 🔵 `info` - Azul
- 🟡 `warn` - Amarelo
- 🔴 `error` - Vermelho

### **5. Auto-refresh** 🔄

Botão para ativar atualização automática a cada **5 segundos**.

Útil para:
- Monitorar uploads em andamento
- Detectar erros em tempo real
- Acompanhar progresso sem refresh manual

---

## 🚀 Como Usar

### **Passo 1: Configurar Secret**

```bash
# No arquivo .env.local (desenvolvimento)
ADMIN_SECRET=meu-secret-super-seguro-123

# Ou no Vercel Dashboard (produção)
# Settings → Environment Variables → Add New
# Name: ADMIN_SECRET
# Value: [sua senha]
```

### **Passo 2: Acessar a Página**

```bash
# Desenvolvimento
http://localhost:3000/admin

# Produção
https://seu-dominio.vercel.app/admin
```

### **Passo 3: Fazer Login**

1. Digite o **secret** configurado
2. Clique em **"Acessar Dashboard"**
3. O secret é salvo no **sessionStorage** (válido enquanto aba estiver aberta)

### **Passo 4: Monitorar o Sistema**

- **Auto-refresh**: Ative para atualização automática a cada 5s
- **Atualizar**: Botão manual para refresh imediato
- **Navegar logs**: Use paginação para ver logs antigos
- **Sair**: Remove o secret do sessionStorage

---

## 🔒 Segurança

### **Boas Práticas**

✅ **Use passwords fortes**: Mínimo 32 caracteres aleatórios  
✅ **Não compartilhe o secret**: Cada admin deve ter seu próprio  
✅ **Rotacione periodicamente**: Mude o secret a cada 90 dias  
✅ **Use HTTPS**: Nunca acesse via HTTP em produção  
✅ **Não commite secrets**: Adicione `.env.local` ao `.gitignore`  

### **O Que NÃO Fazer**

❌ Não use senhas óbvias (`admin`, `123456`, etc.)  
❌ Não armazene o secret em código  
❌ Não envie o secret por email/Slack não-criptografado  
❌ Não deixe o secret em arquivos de configuração commitados  

### **Autenticação**

A autenticação funciona em 2 camadas:

1. **Frontend**: Verifica no `/api/admin/auth`
2. **Backend**: Cada API valida o header `x-admin-secret`

Se o secret for inválido:
- Frontend: Mostra erro "Secret inválido"
- Backend: Retorna `401 Unauthorized`

---

## 🛠️ APIs do Admin

Todas as APIs requerem o header `x-admin-secret`.

### **POST /api/admin/auth**

Valida o secret fornecido.

**Request**:
```json
{
  "secret": "seu-secret-aqui"
}
```

**Response**:
```json
{
  "authenticated": true
}
```

### **GET /api/admin/dashboard**

Retorna estatísticas e itens recentes.

**Headers**:
```
x-admin-secret: seu-secret-aqui
```

**Response**:
```json
{
  "stats": {
    "totalUploads": 150,
    "activeUploads": 3,
    "totalItems": 5000,
    "itemsByState": {
      "queued": 100,
      "adding": 5,
      "waiting_batch_check": 50,
      "done": 4800,
      "error": 45
    }
  },
  "recentItems": [ /* últimos 50 itens */ ]
}
```

### **GET /api/admin/logs**

Retorna logs paginados.

**Query Params**:
- `page`: Número da página (padrão: 1)
- `limit`: Itens por página (padrão: 100, máximo: 100)

**Headers**:
```
x-admin-secret: seu-secret-aqui
```

**Response**:
```json
{
  "logs": [ /* array de logs */ ],
  "total": 10500,
  "page": 1,
  "limit": 100,
  "totalPages": 105
}
```

---

## 📊 Casos de Uso

### **1. Monitorar Upload em Andamento**

1. Acesse `/admin`
2. Ative **Auto-refresh**
3. Observe os itens mudando de estado em tempo real
4. Verifique a tabela "Itens Recentes"

### **2. Diagnosticar Erros**

1. Vá para "Logs do Sistema"
2. Filtre por level `error` (badges vermelhos)
3. Leia as mensagens de erro
4. Identifique workspace/upload problemático

### **3. Verificar Performance**

1. Veja "Distribuição por Estado"
2. Compare `queued` vs `done`
3. Se muitos itens em `error`, investigue logs
4. Se processamento lento, verifique rate limiting

### **4. Auditar Sistema**

1. Navegue pelos logs históricos
2. Veja quais workspaces estão ativos
3. Identifique padrões de uso
4. Detecte anomalias

---

## 🐛 Troubleshooting

### **Erro: "Admin secret not configured"**

**Causa**: `ADMIN_SECRET` não está nas env vars  
**Solução**: Adicione a variável e reinicie o servidor

```bash
# .env.local
ADMIN_SECRET=sua-senha
```

### **Erro: "Secret inválido"**

**Causa**: Secret digitado diferente do configurado  
**Solução**: Verifique o valor exato em `.env.local` ou Vercel

### **Dashboard vazio**

**Causa**: Nenhum upload foi feito ainda  
**Solução**: Normal em ambiente novo. Faça um upload de teste.

### **Auto-refresh não funciona**

**Causa**: Navegador bloqueou requests em segundo plano  
**Solução**: Mantenha a aba ativa ou use refresh manual

### **Logs desatualizados**

**Causa**: Cache do navegador  
**Solução**: Force refresh (Cmd/Ctrl + Shift + R)

---

## 📱 Mobile

O painel é **responsivo**, mas otimizado para desktop.

Em mobile:
- Tabelas têm scroll horizontal
- Algumas colunas podem ficar truncadas
- Use landscape para melhor experiência

---

## 🔮 Melhorias Futuras

Possíveis features para próximas versões:

- [ ] Filtros avançados em logs (por workspace, phase, level)
- [ ] Gráficos de throughput em tempo real
- [ ] Alertas quando erro rate > X%
- [ ] Export de logs para CSV
- [ ] Múltiplos usuários admin com diferentes permissões
- [ ] Logs de auditoria de quem acessou o painel
- [ ] Dashboard público (sem dados sensíveis) para status page

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique se `ADMIN_SECRET` está configurado corretamente
2. Veja logs do servidor (Vercel Logs)
3. Teste com secret conhecido (ex: `test123`)
4. Verifique permissões do Supabase

---

**Desenvolvido com ❤️ para ChatGuru Team**  
**Versão**: 2.0.0  
**Data**: 2025-10-21
