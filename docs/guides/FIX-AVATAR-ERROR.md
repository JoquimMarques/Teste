# 🔧 Como Resolver o Erro "new row violates row-level security policy" no Avatar

## 🚨 Problema Identificado

O erro **"new row violates row-level security policy"** está acontecendo quando você tenta atualizar sua foto de perfil (avatar). Este é um problema de configuração das políticas RLS (Row Level Security) no Supabase.

## 🔍 Causa do Problema

O erro ocorre devido a **conflitos entre políticas RLS** na tabela `profiles`:

1. **Inconsistência de tipos**: Algumas políticas usam `auth.uid() = id` (comparação direta de UUIDs)
2. **Outras políticas usam**: `auth.uid()::text = id::text` (conversão para texto)
3. **Conflito de permissões**: As políticas não estão alinhadas corretamente

## ✅ Solução

### Passo 1: Executar o Script de Correção

Execute o arquivo SQL que criamos: `database/fixes/fix-avatar-policy.sql`

Este script:
- Remove todas as políticas conflitantes
- Cria novas políticas consistentes
- Padroniza todas as comparações usando `::text`

### Passo 2: Verificar no Supabase

1. Acesse o painel do Supabase
2. Vá para **SQL Editor**
3. Execute o script de correção
4. Verifique se as políticas foram criadas corretamente

### Passo 3: Testar a Funcionalidade

1. Faça login na aplicação
2. Tente atualizar sua foto de perfil
3. O erro RLS não deve mais aparecer

## 🛠️ Políticas Corrigidas

Após a correção, você terá estas políticas na tabela `profiles`:

```sql
-- SELECT: Todos podem ver perfis
CREATE POLICY "Perfis são visíveis para todos" ON profiles
    FOR SELECT USING (true);

-- INSERT: Usuários podem criar seu próprio perfil
CREATE POLICY "Usuários podem inserir seu próprio perfil" ON profiles
    FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- UPDATE: Usuários podem atualizar seu próprio perfil
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON profiles
    FOR UPDATE USING (auth.uid()::text = id::text);

-- DELETE: Usuários podem deletar seu próprio perfil
CREATE POLICY "Usuários podem deletar seu próprio perfil" ON profiles
    FOR DELETE USING (auth.uid()::text = id::text);
```

## 🔧 Por Que Funciona

1. **Consistência de tipos**: Todas as políticas agora usam `::text`
2. **Permissões claras**: Cada operação tem sua política específica
3. **Segurança mantida**: Usuários só podem modificar seus próprios perfis
4. **Compatibilidade**: Funciona com o sistema de autenticação do Supabase

## 🚀 Próximos Passos

1. Execute o script de correção
2. Teste o upload de avatar
3. Se ainda houver problemas, verifique os logs do Supabase
4. Considere executar o script completo `fix-policies-final.sql` se necessário

## 📞 Suporte

Se o problema persistir após executar a correção:

1. Verifique os logs do console do navegador
2. Confirme se as políticas foram criadas no Supabase
3. Verifique se o usuário está autenticado corretamente
4. Teste com um usuário recém-criado

---

**Nota**: Este erro é comum em projetos Supabase quando há mistura de políticas RLS antigas e novas. A correção padroniza todas as políticas para funcionar corretamente.
