# Sistema de Chat com Firebase - Briolink

## 📋 Configuração do Firebase

Para usar o sistema de chat, você precisa configurar o Firebase no seu projeto. Siga os passos abaixo:

### 1. Criar Projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Criar um projeto"
3. Digite o nome do projeto (ex: "briolink-chat")
4. Ative o Google Analytics (opcional)
5. Clique em "Criar projeto"

### 2. Configurar Authentication

1. No painel do Firebase, vá para "Authentication"
2. Clique em "Começar"
3. Vá para a aba "Sign-in method"
4. Ative "Email/Password"
5. Clique em "Salvar"

### 3. Configurar Firestore Database

1. No painel do Firebase, vá para "Firestore Database"
2. Clique em "Criar banco de dados"
3. Escolha "Modo de teste" (para desenvolvimento)
4. Selecione uma localização (ex: "us-central1")
5. Clique em "Concluído"

### 4. Configurar Regras do Firestore

No Firestore Database, vá para "Regras" e substitua por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir leitura e escrita para usuários autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Regras específicas para o chat global
    match /chat/{messageId} {
      allow read, write: if request.auth != null;
    }
    
    // Regras para chat privado
    match /privateChats/{conversationId}/messages/{messageId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid in conversationId.split('_'));
    }
    
    // Regras para usuários online
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 5. Obter Configurações do Projeto

1. No painel do Firebase, clique no ícone de engrenagem
2. Selecione "Configurações do projeto"
3. Role para baixo até "Seus aplicativos"
4. Clique em "Adicionar aplicativo" > "Web" (ícone `</>`)
5. Digite um nome para o app (ex: "briolink-web")
6. **NÃO** marque "Também configure o Firebase Hosting"
7. Clique em "Registrar aplicativo"
8. Copie as configurações do `firebaseConfig`

### 6. Configurar o Código

Abra o arquivo `/src/js/firebase-config.js` e substitua o objeto `firebaseConfig` pelas suas configurações:

```javascript
const firebaseConfig = {
    apiKey: "sua-api-key-aqui",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto-id",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

### 7. Testar a Configuração

1. Abra o arquivo `index.html` no navegador
2. Clique no botão de chat (ícone de comentários)
3. Se aparecer a mensagem "Login Necessário", a configuração está funcionando
4. Para testar o chat completo, você precisará fazer login

## 🔧 Funcionalidades Implementadas

### ✅ Chat Privado
- Conversas privadas entre usuários
- Mensagens em tempo real
- Interface responsiva
- Integração com sistema de autenticação existente

### ✅ Recursos do Chat
- Envio de mensagens por Enter ou botão
- Timestamps das mensagens
- Diferenciação visual das próprias mensagens
- Scroll automático para novas mensagens
- Estados de erro e loading
- Iniciação de conversa através do botão "Conversar"

### ✅ Design Responsivo
- Layout adaptável para mobile e desktop
- Interface limpa para conversas privadas
- Animações suaves
- Tema consistente com o Briolink

## 🚀 Como Usar

1. **Iniciar Conversa**: Clique no botão "Conversar" em qualquer publicação
2. **Enviar Mensagem**: Digite no campo de texto e pressione Enter ou clique no botão
3. **Fechar Chat**: Clique no X no canto superior direito
4. **Ver Nome do Contato**: O cabeçalho mostra com quem você está conversando

## 🔐 Integração com Autenticação

O sistema está preparado para integrar com o sistema de autenticação existente do Supabase. Quando um usuário fizer login no Supabase, ele será automaticamente sincronizado com o Firebase para usar o chat.

## 📱 Responsividade

- **Desktop**: Layout com sidebar de usuários online
- **Tablet**: Layout compacto
- **Mobile**: Layout vertical com lista horizontal de usuários

## 🛠️ Estrutura de Arquivos

```
src/js/
├── firebase-config.js    # Configuração do Firebase
├── chat-system.js        # Sistema de chat
└── ...

src/css/
└── styles.css            # Estilos do chat (adicionados ao final)
```

## ⚠️ Importante

- **Desenvolvimento**: Use as regras de teste do Firestore
- **Produção**: Configure regras mais restritivas
- **Segurança**: Nunca exponha suas chaves de API publicamente
- **Backup**: Configure backups automáticos do Firestore

## 🐛 Solução de Problemas

### Chat não abre
- Verifique se o Firebase está configurado corretamente
- Abra o console do navegador para ver erros

### Mensagens não aparecem
- Verifique as regras do Firestore
- Confirme se a autenticação está funcionando

### Usuários online não aparecem
- Verifique se o usuário está marcado como online
- Confirme se as regras permitem leitura da coleção `users`

## 📞 Suporte

Se encontrar problemas, verifique:
1. Console do navegador para erros
2. Configurações do Firebase
3. Regras do Firestore
4. Conectividade de internet

---

**Desenvolvido para Briolink** 🚀
