# 👤 Sistema de Usuários - Linkdireto

Este documento explica como implementar o sistema completo de usuários no seu site Linkdireto.

## 📋 O que foi implementado:

### ✅ **Layout Reorganizado**
- **Sidebar Esquerda**: Perfil do usuário (quando logado) ou tela de login (quando não logado)
- **Sidebar Direita**: Menu rápido (movido da esquerda)
- **Header**: Botões de login/registro ou perfil do usuário logado

### ✅ **Sistema de Autenticação**
- **Registro**: Nome, email, turma, descrição, senha
- **Login**: Email e senha
- **Logout**: Botão no header
- **Sessão persistente**: Mantém usuário logado

### ✅ **Perfil do Usuário**
- **Foto de perfil**: Avatar circular com iniciais
- **Informações**: Nome, turma, descrição
- **Edição**: Modal para atualizar dados
- **Link nas publicações**: Clica na foto → vai para perfil

### ✅ **Publicações Atualizadas**
- **Autor automático**: Usa nome do usuário logado
- **Sem campo autor**: Removido do formulário
- **Link para perfil**: Clica no autor → vai para perfil
- **Exclusão**: Só o autor pode excluir suas publicações

## 🛠️ Como implementar:

### 1. **Configurar Supabase**

Execute o SQL no seu Supabase:

```sql
-- Copie e execute o conteúdo do arquivo profiles-table.sql
-- no SQL Editor do seu projeto Supabase
```

### 2. **Habilitar Autenticação**

No Supabase Dashboard:
1. Vá para **Authentication** → **Settings**
2. Habilite **Email auth**
3. Configure **Site URL** (seu domínio)
4. Opcional: Configure **Redirect URLs**

### 3. **Arquivos já criados:**

- ✅ `index.html` - Layout atualizado
- ✅ `auth-styles.css` - Estilos de autenticação
- ✅ `supabase-config.js` - Serviços de auth
- ✅ `script.js` - Lógica de autenticação
- ✅ `profiles-table.sql` - Estrutura do banco

### 4. **Testar o sistema:**

1. **Abrir o site** - Deve mostrar tela de login
2. **Criar conta** - Clique em "Registrar"
3. **Fazer login** - Use as credenciais criadas
4. **Ver perfil** - Aparece na sidebar esquerda
5. **Criar publicação** - Só aparece quando logado
6. **Editar perfil** - Clique em "Editar Perfil"

## 🎯 **Funcionalidades principais:**

### **Quando não logado:**
- Tela de boas-vindas na sidebar esquerda
- Botões "Entrar" e "Registrar" no header
- Não pode criar publicações
- Pode ver publicações existentes

### **Quando logado:**
- Perfil completo na sidebar esquerda
- Nome e avatar no header
- Botão "Escrever" disponível
- Pode criar, editar e excluir publicações
- Links para perfis de outros usuários

### **Publicações:**
- Mostram autor real (nome do usuário)
- Foto do autor clicável → vai para perfil
- Só o autor pode excluir
- Campo "autor" removido do formulário

## 🔧 **Personalizações possíveis:**

### **Adicionar foto de perfil:**
```javascript
// No AuthService.updateProfile()
const { data, error } = await supabase.storage
    .from('avatars')
    .upload(`${userId}/avatar.jpg`, file);
```

### **Adicionar mais campos:**
```sql
ALTER TABLE profiles ADD COLUMN phone TEXT;
ALTER TABLE profiles ADD COLUMN birth_date DATE;
```

### **Personalizar validações:**
```javascript
// No script.js, função handleRegister()
if (password.length < 6) {
    showNotification('Senha deve ter pelo menos 6 caracteres', 'error');
    return;
}
```

## 📱 **Responsividade:**

O sistema é totalmente responsivo:
- **Desktop**: Layout completo com sidebars
- **Tablet**: Sidebar direita oculta
- **Mobile**: Menu hambúrguer, layout adaptado

## 🔒 **Segurança:**

- **RLS habilitado**: Usuários só acessam seus dados
- **Validação de senha**: Mínimo 6 caracteres
- **Sessão segura**: Gerenciada pelo Supabase
- **Políticas de acesso**: Definidas no banco

## 🚀 **Próximos passos:**

1. **Testar o sistema** completo
2. **Personalizar estilos** se necessário
3. **Adicionar foto de perfil** (opcional)
4. **Implementar notificações** por email
5. **Adicionar recuperação de senha**

## ❓ **Solução de problemas:**

### **Erro de autenticação:**
- Verifique se a autenticação está habilitada no Supabase
- Confirme as credenciais do projeto

### **Erro de perfil:**
- Execute o SQL da tabela profiles
- Verifique as políticas RLS

### **Layout quebrado:**
- Confirme que `auth-styles.css` está carregado
- Verifique se todos os IDs no HTML estão corretos

---

**🎉 Sistema pronto para uso!** O Linkdireto agora tem um sistema completo de usuários com perfis, autenticação e interface moderna! 