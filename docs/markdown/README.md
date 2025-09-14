# Site Estilo Facebook com Sistema de Likes/Dislikes

Um site moderno estilo Facebook com sistema de publicações, likes e dislikes usando HTML, CSS, JavaScript e Supabase.

## 🎨 Características

- **Design Moderno**: Interface limpa com paleta laranja moderna
- **Responsivo**: Funciona perfeitamente em desktop, tablet e mobile
- **Sistema de Likes/Dislikes**: Interações persistentes com contadores automáticos
- **Busca e Filtros**: Encontre publicações por texto ou categoria
- **Tempo Real**: Atualizações automáticas quando há mudanças
- **Menu Mobile**: Menu hambúrguer para dispositivos móveis

## 🚀 Configuração

### 1. Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Vá para **Settings > API** e copie:
   - **Project URL**
   - **anon public key**

### 2. Configurar o Banco de Dados

1. No Supabase, vá para **SQL Editor**
2. Execute o script `database-setup.sql` para criar a tabela de publicações
3. **IMPORTANTE**: Execute o script `database-simple.sql` para criar a tabela de interações

### 3. Configurar as Credenciais

1. Abra o arquivo `supabase-config.js`
2. Substitua as credenciais pelas suas:

```javascript
const SUPABASE_URL = 'SUA_URL_DO_SUPABASE';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANONIMA';
```

### 4. Executar o Projeto

1. Abra o arquivo `index.html` no navegador
2. Ou use um servidor local:
   ```bash
   python -m http.server 8000
   # ou
   npx serve .
   ```

## 📁 Estrutura dos Arquivos

```
├── index.html          # Página principal
├── styles.css          # Estilos CSS
├── script.js           # Lógica JavaScript
├── supabase-config.js  # Configuração do Supabase
├── database-setup.sql  # Script inicial do banco
├── database-simple.sql # Script para likes/dislikes
└── README.md           # Este arquivo
```

## 🔧 Solução de Problemas

### Erro 406 (Not Acceptable)

Se você estiver recebendo erros 406 ao tentar usar likes/dislikes:

1. **Execute o script `database-simple.sql`** no SQL Editor do Supabase
2. Este script desabilita o RLS (Row Level Security) para a tabela `user_interactions`
3. Recarregue a página e teste novamente

### Verificar Estrutura da Tabela

No SQL Editor do Supabase, execute:

```sql
SELECT 
    table_name, 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('publications', 'user_interactions')
ORDER BY table_name, column_name;
```

### Verificar Políticas RLS

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'user_interactions';
```

## 🎯 Funcionalidades

### Publicações
- ✅ Criar publicações com título, autor, conteúdo e categoria
- ✅ Visualizar todas as publicações em cards estilo Facebook
- ✅ Excluir publicações
- ✅ Buscar publicações por texto
- ✅ Filtrar por categoria

### Likes e Dislikes
- ✅ Curtir publicações
- ✅ Não curtir publicações
- ✅ Contadores automáticos
- ✅ Uma interação por usuário por publicação
- ✅ Trocar entre like e dislike
- ✅ Remover interação

### Interface
- ✅ Design responsivo
- ✅ Menu mobile com hambúrguer
- ✅ Loading states
- ✅ Notificações de sucesso/erro
- ✅ Modal para criar publicações

## 🎨 Paleta de Cores

- **Primária**: `#e66d11` (Laranja)
- **Secundária**: `#ff8c42` (Laranja claro)
- **Fundo**: `#f0f2f5` (Cinza claro)
- **Texto**: `#1c1e21` (Preto)
- **Texto secundário**: `#65676b` (Cinza)

## 📱 Responsividade

- **Desktop**: Layout em grid com sidebar
- **Tablet**: Layout adaptado com menu compacto
- **Mobile**: Menu hambúrguer, cards empilhados

## 🔄 Atualizações em Tempo Real

O sistema usa Supabase Realtime para:
- Atualizar contadores automaticamente
- Mostrar novas publicações
- Sincronizar likes/dislikes entre usuários

## 🛠️ Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Backend**: Supabase (PostgreSQL + API REST)
- **Autenticação**: Sistema simples com localStorage
- **Tempo Real**: Supabase Realtime

## 📝 Licença

Este projeto é de código aberto e pode ser usado livremente.

---

**Dica**: Se encontrar problemas, verifique sempre o console do navegador (F12) para ver mensagens de erro detalhadas. 