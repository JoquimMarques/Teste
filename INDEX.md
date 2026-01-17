# 📁 Índice do Projeto Linkdireto

## 🚀 Início Rápido

- **[index.html](./index.html)** - Página principal do site
- **[README.md](./README.md)** - Documentação completa do projeto

## 📂 Estrutura Organizada

### 🎨 Frontend (src/)
- **CSS**: `src/css/`
  - [styles.css](./src/css/styles.css) - Estilos principais
  - [auth-styles.css](./src/css/auth-styles.css) - Estilos de autenticação

- **JavaScript**: `src/js/`
  - [script-corrected.js](./src/js/script-corrected.js) - Script principal corrigido
  - [script-fixed.js](./src/js/script-fixed.js) - Script principal fixado
  - [script.js](./src/js/script.js) - Script principal original
  - [supabase-config.js](./src/js/supabase-config.js) - Configuração do Supabase
  - [news-integration.js](./src/js/news-integration.js) - Integração de notícias

- **HTML**: `src/html/`
  - [login.html](./src/html/login.html) - Página de login
  - [register.html](./src/html/register.html) - Página de registro

### 🗄️ Banco de Dados (database/)

#### Configuração Inicial (database/setup/)
- [complete-setup.sql](./database/setup/complete-setup.sql) - Configuração completa
- [database-setup.sql](./database/setup/database-setup.sql) - Configuração básica
- [database-simple.sql](./database/setup/database-simple.sql) - Configuração simplificada
- [final-setup.sql](./database/setup/final-setup.sql) - Configuração final
- [profiles-table.sql](./database/setup/profiles-table.sql) - Tabela de perfis
- [setup-database.sql](./database/setup/setup-database.sql) - Setup do banco
- [setup-policies.sql](./database/setup/setup-policies.sql) - Setup de políticas
- [simple-setup.sql](./database/setup/simple-setup.sql) - Setup simples

#### Correções (database/fixes/)
- [clean-duplicates.sql](./database/fixes/clean-duplicates.sql) - Limpar duplicatas
- [confirm-user.sql](./database/fixes/confirm-user.sql) - Confirmar usuário
- [disable-email-confirmation.sql](./database/fixes/disable-email-confirmation.sql) - Desabilitar confirmação
- [fix-database.sql](./database/fixes/fix-database.sql) - Corrigir banco
- [fix-email-confirmation.sql](./database/fixes/fix-email-confirmation.sql) - Corrigir confirmação
- [fix-policies.sql](./database/fixes/fix-policies.sql) - Corrigir políticas
- [fix-policies-final.sql](./database/fixes/fix-policies-final.sql) - Correção final de políticas

#### Testes (database/tests/)
- [test-without-rls.sql](./database/tests/test-without-rls.sql) - Teste sem RLS

### 📚 Documentação (docs/)

#### Guias (docs/guides/)
- [DISABLE-EMAIL-GUIDE.md](./docs/guides/DISABLE-EMAIL-GUIDE.md) - Guia para desabilitar email
- [DISABLE-EMAIL-NOW.md](./docs/guides/DISABLE-EMAIL-NOW.md) - Desabilitar email agora
- [FIX-EMAIL-LOGIN.md](./docs/guides/FIX-EMAIL-LOGIN.md) - Corrigir login de email
- [FINAL-FIX.md](./docs/guides/FINAL-FIX.md) - Correção final
- [FINAL-TEST.md](./docs/guides/FINAL-TEST.md) - Teste final
- [SUPABASE-SETUP.md](./docs/guides/SUPABASE-SETUP.md) - Setup do Supabase
- [README-USUARIOS.md](./docs/guides/README-USUARIOS.md) - Guia para usuários

#### Markdown (docs/markdown/)
- [README.md](./docs/markdown/README.md) - README original

### 🧪 Testes (tests/)
- [debug-auth.html](./tests/debug-auth.html) - Teste de autenticação
- [debug.js](./tests/debug.js) - Script de debug
- [test-auth.html](./tests/test-auth.html) - Teste de auth
- [test-fixes.html](./tests/test-fixes.html) - Teste de correções
- [test-index.html](./tests/test-index.html) - Teste da página inicial
- [test-simple.html](./tests/test-simple.html) - Teste simples
- [test.html](./tests/test.html) - Teste básico

## 🎯 Ordem de Configuração Recomendada

1. **Configurar Supabase**: Siga o [SUPABASE-SETUP.md](./docs/guides/SUPABASE-SETUP.md)
2. **Executar Scripts de Setup**: Use os arquivos em `database/setup/`
3. **Configurar Credenciais**: Edite `src/js/supabase-config.js`
4. **Testar**: Use os arquivos em `tests/`
5. **Corrigir Problemas**: Use os arquivos em `database/fixes/` se necessário

## 🔧 Solução de Problemas

- **Problemas de Email**: Veja [DISABLE-EMAIL-GUIDE.md](./docs/guides/DISABLE-EMAIL-GUIDE.md)
- **Problemas de Login**: Veja [FIX-EMAIL-LOGIN.md](./docs/guides/FIX-EMAIL-LOGIN.md)
- **Problemas de Banco**: Veja [FINAL-FIX.md](./docs/guides/FINAL-FIX.md)
- **Testes**: Use os arquivos em `tests/` para debug

## 📝 Notas

- Todos os arquivos estão organizados por função
- Os scripts SQL estão separados por propósito (setup, fixes, tests)
- A documentação está organizada por tipo (guides, markdown)
- Os arquivos de teste estão isolados para facilitar o debug

---

**💡 Dica**: Use este índice para navegar rapidamente pelos arquivos do projeto! 