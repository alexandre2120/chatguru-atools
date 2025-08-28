# ChatGuru Atool - Batch Chat Import System

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database-green?style=for-the-badge&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)

Sistema de importação em lote para adicionar contatos ao ChatGuru CRM via API, com processamento assíncrono e rate limiting automático.

[Demo](#demo) • [Instalação](#instalação) • [Configuração](#configuração) • [Uso](#uso) • [Deploy](#deploy)

</div>

## 📋 Sobre o Projeto

O **ChatGuru Atool** é uma ferramenta de integração que permite importar múltiplos contatos para o ChatGuru CRM através de planilhas Excel (XLSX). O sistema processa as requisições respeitando o rate limit da API (1 requisição por minuto por workspace), garantindo conformidade e evitando bloqueios.

### ✨ Principais Funcionalidades

- 📊 **Upload de Planilhas XLSX** - Importe centenas de contatos de uma só vez
- ⏱️ **Rate Limiting Automático** - 1 requisição/minuto por workspace
- 🔄 **Processamento Assíncrono** - Fila automática com Vercel Cron
- 📈 **Progresso em Tempo Real** - Acompanhe o status via Supabase Realtime
- 🔒 **Segurança** - Credenciais não são armazenadas no banco de dados
- 📥 **Export de Falhas** - Baixe relatório de erros em XLSX
- 🗑️ **Limpeza Automática** - Dados deletados após 45 dias
- 🎨 **Interface Minimalista** - Design black & white com shadcn/ui

## 🚀 Demo

![Screenshot](https://via.placeholder.com/800x400?text=ChatGuru+Atool+Screenshot)

## 📦 Pré-requisitos

Antes de começar, você precisará ter instalado:

- [Node.js](https://nodejs.org/) (v18 ou superior)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- Conta no [Supabase](https://supabase.com/) (gratuito)
- Conta no [Vercel](https://vercel.com/) (opcional, para deploy)

## 🛠️ Instalação

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/chatguru-atool.git
cd chatguru-atool
```

### 2. Instale as Dependências

```bash
npm install
# ou
yarn install
```

### 3. Configure o Supabase

#### 3.1 Crie um novo projeto no [Supabase](https://supabase.com/)

#### 3.2 Execute o Script SQL

Acesse o **SQL Editor** do Supabase e execute o conteúdo do arquivo `supabase-setup.sql`:

```sql
-- O arquivo contém:
-- • Tabelas: workspaces, uploads, upload_items, run_logs
-- • Índices para performance
-- • Políticas de segurança (RLS desabilitado para desenvolvimento)
```

### 4. Configure as Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Vercel Cron Configuration
CRON_SECRET=uma-string-secreta-aleatoria

# Development Only - Remove in production
MOCK_CHATGURU=true
```

> **Nota**: As credenciais do Supabase estão em: Settings → API → Project API keys

## 💻 Uso em Desenvolvimento

### 1. Inicie o Servidor de Desenvolvimento

```bash
npm run dev
# ou
yarn dev
```

Acesse: http://localhost:3000

### 2. Inicie o Processador de Fila Local

Em outro terminal, execute:

```bash
npm run cron:local
# ou
yarn cron:local
```

Este comando simula o Vercel Cron, processando a fila a cada minuto.

### 3. Configure e Use

1. **Acesse a aplicação** em http://localhost:3000
2. **Preencha as credenciais** do ChatGuru:
   - Servidor (ex: s10)
   - API Key
   - Account ID
   - Phone ID
3. **Baixe o template XLSX** clicando em "Baixar Template XLSX"
4. **Preencha o template** com os dados:
   ```
   | chat_number    | name         | text            | user_id | dialog_id |
   |---------------|--------------|-----------------|---------|-----------|
   | 5511999887766 | João Silva   | Primeira msg    | usr123  | dlg456    |
   | 5511888776655 | Maria Santos | Olá!           |         |           |
   ```
5. **Faça upload** do arquivo preenchido
6. **Acompanhe o progresso** na tela de detalhes

## 📊 Estrutura do Template XLSX

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `chat_number` | String | ✅ Sim | Número completo com DDI (ex: 5511999887766) |
| `name` | String | ✅ Sim | Nome do contato |
| `text` | String | ❌ Não | Mensagem inicial (envia espaço se vazio) |
| `user_id` | String | ❌ Não | ID do usuário no ChatGuru |
| `dialog_id` | String | ❌ Não | ID do diálogo para vincular |

## 🏗️ Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js   │────▶│  Supabase   │────▶│  ChatGuru   │
│   Frontend  │     │   Database  │     │     API     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    ▲
       │                   │                    │
       ▼                   ▼                    │
┌─────────────┐     ┌─────────────┐            │
│ Upload XLSX │     │ Vercel Cron │────────────┘
│   Handler   │     │  (1 req/min)│
└─────────────┘     └─────────────┘
```

### Fluxo de Dados

1. **Upload**: Usuário faz upload do XLSX
2. **Parse**: Sistema valida e insere no Supabase
3. **Queue**: Items entram na fila com status `queued`
4. **Process**: Cron job processa 1 item/minuto
5. **Status**: Atualiza status para `done` ou `error`
6. **Cleanup**: Após 45 dias, dados são deletados

## 🚀 Deploy

### Deploy no Vercel

1. **Fork este repositório** para sua conta GitHub

2. **Importe no Vercel**:
   ```bash
   vercel
   ```
   Ou use a [interface web do Vercel](https://vercel.com/new)

3. **Configure as variáveis de ambiente** no Vercel Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (gere uma string aleatória)
   - `MOCK_CHATGURU=false` (para produção)

4. **Deploy**:
   ```bash
   vercel --prod
   ```

### Configuração dos Cron Jobs

O arquivo `vercel.json` já está configurado com:

```json
{
  "crons": [
    {
      "path": "/api/jobs/tick",
      "schedule": "* * * * *"  // A cada minuto
    },
    {
      "path": "/api/cleanup/daily",
      "schedule": "0 3 * * *"  // Diariamente às 3h
    }
  ]
}
```

## 🔧 Configuração Avançada

### Modo Mock vs Produção

**Desenvolvimento (Mock)**:
```env
MOCK_CHATGURU=true
```
- Simula respostas da API
- Não requer credenciais válidas
- Perfeito para testes

**Produção (API Real)**:
```env
MOCK_CHATGURU=false
# ou remova a variável
```
- Conecta com ChatGuru real
- Requer credenciais válidas
- Processa contatos de verdade

### Rate Limiting

O sistema implementa rate limiting automático:
- **1 requisição por minuto** por workspace
- **~10 contatos a cada 10 minutos**
- Configurado em `/api/jobs/tick/route.ts`

### Segurança

- ✅ Credenciais armazenadas apenas no localStorage
- ✅ Workspace hash único por conjunto de credenciais
- ✅ Service Role Key apenas no servidor
- ✅ RLS pode ser habilitado no Supabase para produção

## 📝 Scripts Disponíveis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Compila para produção
npm run start        # Inicia servidor de produção
npm run cron:local   # Simula cron jobs localmente
```

## 🐛 Troubleshooting

### Erro no Upload

**Problema**: "Failed to create workspace"
**Solução**: Verifique se executou o SQL no Supabase

### Processamento Parado

**Problema**: Items ficam em "Na fila"
**Solução**: 
1. Verifique se o cron está rodando (`npm run cron:local`)
2. Confira os logs em `run_logs` no Supabase

### Rate Limit

**Problema**: "Você tem processamentos em andamento"
**Solução**: Aguarde conclusão ou marque como `completed` no banco

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/seu-usuario/chatguru-atool/issues)
- **Docs ChatGuru**: [ChatGuru API](https://chatguru.app/docs)
- **Docs Supabase**: [Supabase Docs](https://supabase.com/docs)

## 👥 Autores

- **Seu Nome** - [GitHub](https://github.com/seu-usuario)

## 🙏 Agradecimentos

- [ChatGuru](https://chatguru.app) pela API
- [Supabase](https://supabase.com) pelo backend
- [Vercel](https://vercel.com) pela hospedagem
- [shadcn/ui](https://ui.shadcn.com) pelos componentes

---

<div align="center">
Feito com ❤️ para a comunidade ChatGuru
</div>