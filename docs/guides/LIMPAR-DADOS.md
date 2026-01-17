# 🗑️ Como Limpar Todos os Dados do Supabase

## ⚠️ **ATENÇÃO: OPERAÇÃO IRREVERSÍVEL!**

Este guia explica como **APAGAR TODOS os dados** de todas as tabelas do Supabase para começar do zero.

## 📋 **O que será apagado:**

- ✅ Todos os usuários/perfis
- ✅ Todas as publicações
- ✅ Todas as interações (likes, comentários)
- ✅ Todos os impulsos
- ✅ Todas as notificações
- ✅ Todos os comentários
- ✅ Todos os arquivos de mídia (avatares, imagens)

## 🚀 **Como executar:**

### **Opção 1: Limpeza Rápida (Recomendado)**
1. Abra o **SQL Editor** no Supabase
2. Cole o conteúdo do arquivo `database/quick-clean.sql`
3. Clique em **RUN**
4. Confirme a execução

### **Opção 2: Limpeza Detalhada**
1. Abra o **SQL Editor** no Supabase
2. Cole o conteúdo do arquivo `database/clean-all-data.sql`
3. Clique em **RUN**
4. Confirme a execução

## 📁 **Arquivos disponíveis:**

- **`quick-clean.sql`** - Limpeza rápida e direta
- **`clean-all-data.sql`** - Limpeza com verificações e alternativas

## 🔄 **Após a limpeza:**

### **1. Verificar se funcionou:**
```sql
-- Verificar se as tabelas estão vazias
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM publications;
SELECT COUNT(*) FROM user_interactions;
```

### **2. Testar funcionalidades:**
- ✅ Criar novo usuário
- ✅ Fazer upload de avatar
- ✅ Criar publicação
- ✅ Verificar notificações em tempo real

### **3. Verificar políticas RLS:**
- ✅ As políticas devem continuar funcionando
- ✅ Novos usuários devem conseguir criar perfis
- ✅ Upload de avatares deve funcionar

## 🚨 **AVISOS IMPORTANTES:**

### **⚠️ ANTES de executar:**
1. **Confirme** que está no ambiente correto
2. **Faça backup** se necessário
3. **Teste** em ambiente de desenvolvimento primeiro
4. **Tenha certeza** que quer apagar tudo

### **🚫 NUNCA execute em:**
- ❌ Ambiente de produção
- ❌ Banco com dados importantes
- ❌ Sem confirmação explícita

## 🔧 **Alternativas mais seguras:**

### **Limpar apenas dados específicos:**
```sql
-- Limpar apenas publicações (mantém usuários)
DELETE FROM publications;
DELETE FROM user_interactions;
DELETE FROM impulses;
DELETE FROM notifications;
DELETE FROM comments;
```

### **Limpar apenas um usuário:**
```sql
-- Substitua 'ID_DO_USUARIO' pelo ID real
DELETE FROM notifications WHERE user_id = 'ID_DO_USUARIO';
DELETE FROM comments WHERE author_id = 'ID_DO_USUARIO';
DELETE FROM publications WHERE author_id = 'ID_DO_USUARIO';
DELETE FROM profiles WHERE id = 'ID_DO_USUARIO';
```

## 📱 **Como usar no Supabase:**

1. **Acesse** o painel do Supabase
2. **Vá para** SQL Editor (ícone `</>`)
3. **Cole** o script escolhido
4. **Clique** em RUN
5. **Confirme** a execução
6. **Verifique** o resultado

## 🎯 **Resultado esperado:**

Após a execução, você deve ver:
```
✅ TODOS OS DADOS FORAM APAGADOS!
```

E todas as tabelas devem estar vazias (COUNT = 0).

## 🆘 **Se algo der errado:**

1. **Verifique** se há erros de foreign key
2. **Execute** as queries de limpeza uma por vez
3. **Consulte** os logs do Supabase
4. **Entre em contato** com suporte se necessário

## 💡 **Dicas finais:**

- **Teste sempre** em ambiente de desenvolvimento primeiro
- **Mantenha backups** de dados importantes
- **Documente** o que foi apagado
- **Verifique** se as funcionalidades ainda funcionam após a limpeza

---

**🔴 LEMBRE-SE: Esta operação é IRREVERSÍVEL! Use com responsabilidade!**

