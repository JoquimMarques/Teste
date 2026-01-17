# 🗄️ Configuração Completa do Supabase

## 📋 Passo a Passo para Configurar o Banco de Dados

### 1. Acessar o Supabase
1. Vá para [supabase.com](https://supabase.com)
2. Faça login na sua conta
3. Acesse o projeto: `nvswucwnvshvklqgojcw`

### 2. Configurar Autenticação
1. No menu lateral, clique em **"Authentication"**
2. Vá para **"Settings"**
3. Configure:
   - **Site URL:** `http://localhost:8000` (para desenvolvimento)
   - **Redirect URLs:** `http://localhost:8000/index.html`
   - **Enable email confirmations:** Desativado (para teste)

### 3. Criar a Tabela de Perfis
1. No menu lateral, clique em **"SQL Editor"**
2. Clique em **"New query"**
3. Cole o seguinte código SQL:

```sql
-- Criar tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    turma TEXT,
    description TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
-- Usuários podem ver todos os perfis
CREATE POLICY "Perfis são visíveis para todos os usuários" ON profiles
    FOR SELECT USING (true);

-- Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Usuários podem inserir apenas seu próprio perfil
CREATE POLICY "Usuários podem inserir seu próprio perfil" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Função para atualizar o timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

4. Clique em **"Run"** para executar

### 4. Criar a Tabela de Publicações (se não existir)
1. No SQL Editor, crie uma nova query
2. Cole o seguinte código:

```sql
-- Criar tabela de publicações
CREATE TABLE IF NOT EXISTS publications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'outros',
    likes_count INTEGER DEFAULT 0,
    dislikes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Publicações são visíveis para todos" ON publications
    FOR SELECT USING (true);

CREATE POLICY "Usuários podem criar publicações" ON publications
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Usuários podem atualizar suas publicações" ON publications
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Usuários podem deletar suas publicações" ON publications
    FOR DELETE USING (auth.uid() = author_id);
```

### 5. Verificar as Configurações
1. Vá para **"Table Editor"**
2. Verifique se as tabelas `profiles` e `publications` foram criadas
3. Verifique se as políticas RLS estão ativas

### 6. Testar a Configuração
1. Abra `test-simple.html` no navegador
2. Clique em "Testar Supabase"
3. Clique em "Testar Registro"
4. Verifique se não há erros

## 🔧 Configurações Adicionais

### Habilitar Row Level Security (RLS)
- Todas as tabelas devem ter RLS habilitado
- As políticas garantem que usuários só acessem seus próprios dados

### Configurar Triggers
- O trigger `update_updated_at_column` atualiza automaticamente o campo `updated_at`

### Políticas de Segurança
- **SELECT:** Todos podem ver perfis e publicações
- **INSERT:** Usuários só podem inserir seus próprios dados
- **UPDATE:** Usuários só podem atualizar seus próprios dados
- **DELETE:** Usuários só podem deletar suas próprias publicações

## 🚀 Como Funciona o Sistema

### 1. Registro de Usuário
```
1. Usuário preenche formulário em register.html
2. Sistema chama supabase.auth.signUp()
3. Cria usuário na tabela auth.users
4. Cria perfil na tabela profiles
5. Faz login automático
6. Redireciona para index.html
```

### 2. Login de Usuário
```
1. Usuário preenche formulário em login.html
2. Sistema chama supabase.auth.signInWithPassword()
3. Verifica credenciais na tabela auth.users
4. Busca perfil na tabela profiles
5. Redireciona para index.html logado
```

### 3. Exibição do Usuário
```
1. index.html carrega
2. Sistema verifica se há usuário logado
3. Se logado: busca perfil na tabela profiles
4. Exibe dados do usuário na interface
5. Permite criar publicações
```

## 🐛 Solução de Problemas

### Erro: "relation 'profiles' does not exist"
- Execute o SQL da tabela profiles novamente

### Erro: "permission denied"
- Verifique se as políticas RLS estão configuradas corretamente

### Erro: "invalid email or password"
- Verifique se o usuário foi criado corretamente
- Verifique se o email está confirmado (se habilitado)

### Usuário não aparece na página inicial
- Verifique se a função `checkAuthStatus()` está sendo chamada
- Verifique se o perfil foi criado na tabela profiles

## 📊 Verificar Dados no Supabase

### Ver Usuários Registrados
1. Vá para **"Authentication" > "Users"**
2. Veja todos os usuários registrados

### Ver Perfis
1. Vá para **"Table Editor" > "profiles"**
2. Veja todos os perfis criados

### Ver Publicações
1. Vá para **"Table Editor" > "publications"**
2. Veja todas as publicações criadas

## ✅ Checklist de Configuração

- [ ] Tabela `profiles` criada
- [ ] Tabela `publications` criada
- [ ] RLS habilitado em ambas as tabelas
- [ ] Políticas de segurança configuradas
- [ ] Triggers configurados
- [ ] Autenticação configurada
- [ ] Teste de conexão funcionando
- [ ] Teste de registro funcionando
- [ ] Teste de login funcionando
- [ ] Usuário aparece na página inicial

## 🎯 Próximos Passos

1. Execute o SQL no Supabase
2. Teste o registro de um usuário
3. Teste o login
4. Verifique se o usuário aparece na página inicial
5. Teste a criação de publicações

Se tudo estiver funcionando, o sistema estará completamente configurado! 🎉 