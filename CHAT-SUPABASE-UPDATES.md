# Mudanças necessárias no chatBrio.html

## ATENÇÃO: O arquivo foi simplificado

O código antigo tinha muitas referências ao Firebase. Você precisa:

1. **Substituir a função `selectUser`** (linha 701):
```javascript
async function selectUser(userId, userData) {
    selectedUser = { id: userId, ...userData };
    
    document.getElementById('chatHeaderAvatar').textContent = userData.avatar;
    document.getElementById('chatHeaderName').textContent = userData.name;
    document.getElementById('chatHeaderStatus').textContent = 'Online';
    document.getElementById('sendBtn').disabled = false;

    // Obter ou criar conversa
    currentConversationId = await getOrCreateConversation(userId);
    
    loadMessages();
}
```

2. **Substituir a função `loadMessages`** (linha 710):
```javascript
async function loadMessages() {
    console.log('📥 Carregando mensagens...');
    
    // Remover subscription anterior
    if (messagesSubscription) {
        messagesSubscription.unsubscribe();
    }
    
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';

    // Carregar mensagens existentes
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*, profiles:profiles(name)')
        .eq('conversation_id', currentConversationId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('❌ Erro ao carregar mensagens:', error);
        return;
    }

    if (messages && messages.length > 0) {
        messages.forEach(message => {
            displayMessage(message);
        });
    } else {
        container.innerHTML = `
            <div class="empty-chat">
                <div class="empty-chat-icon">💬</div>
                <p>Nenhuma mensagem ainda. Comece a conversar!</p>
            </div>
        `;
    }

    container.scrollTop = container.scrollHeight;

    // Inscrever em novas mensagens
    messagesSubscription = supabase
        .channel(`messages:${currentConversationId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${currentConversationId}`
        }, (payload) => {
            displayMessage(payload.new);
            container.scrollTop = container.scrollHeight;
        })
        .subscribe();
}
```

3. **Adicionar função `getOrCreateConversation`** (nova):
```javascript
async function getOrCreateConversation(otherUserId) {
    // Ordenar IDs para garantir unicidade
    const user1Id = currentUser.id < otherUserId ? currentUser.id : otherUserId;
    const user2Id = currentUser.id < otherUserId ? otherUserId : currentUser.id;

    // Tentar encontrar conversa existente
    const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('user1_id', user1Id)
        .eq('user2_id', user2Id)
        .single();

    if (existing) {
        return existing.id;
    }

    // Criar nova conversa
    const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
            user1_id: user1Id,
            user2_id: user2Id
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Erro ao criar conversa:', error);
        return null;
    }

    return newConv.id;
}
```

4. **Substituir função `sendMessage`** (linha 850):
```javascript
async function sendMessage(text, file = null, type = 'text') {
    if (!selectedUser || !currentConversationId) {
        console.log('⚠️ Nenhum usuário selecionado ou conversa não criada');
        return;
    }

    if (!text && !file) {
        console.log('⚠️ Nenhuma mensagem para enviar');
        return;
    }

    try {
        console.log('📤 Enviando mensagem...');
        
        const messageData = {
            conversation_id: currentConversationId,
            sender_id: currentUser.id,
            message_text: text || '',
            message_type: type || 'text'
        };

        // Se tiver arquivo, fazer upload
        if (file) {
            const fileName = `${Date.now()}_${file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('chat-files')
                .upload(`${currentConversationId}/${fileName}`, file);

            if (uploadError) {
                console.error('❌ Erro ao enviar arquivo:', uploadError);
                alert('Erro ao enviar arquivo. Tente novamente.');
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('chat-files')
                .getPublicUrl(`${currentConversationId}/${fileName}`);

            messageData.file_url = publicUrl;
            messageData.file_name = file.name;
            messageData.file_size = file.size;
        }

        const { error } = await supabase
            .from('messages')
            .insert(messageData);

        if (error) {
            console.error('❌ Erro ao enviar mensagem:', error);
            alert('Erro ao enviar mensagem: ' + error.message);
            return;
        }

        console.log('✅ Mensagem enviada!');
        
        // Atualizar conversa
        await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', currentConversationId);

        // Scroll
        setTimeout(() => {
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 100);

    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
    }
}
```

5. **Atualizar função `displayMessage`** para usar novos campos:
```javascript
function displayMessage(message) {
    console.log('💬 Exibindo mensagem:', message);
    const container = document.getElementById('messagesContainer');
    const isSent = message.sender_id === currentUser.id;
    
    // ... (código existente até "// Conteúdo da mensagem")
    
    let content = message.message_text || '';
    
    // Se tiver arquivo
    if (message.file_url) {
        if (message.message_type === 'image') {
            content += `<img src="${message.file_url}" style="max-width: 100%; border-radius: 8px; margin-top: 8px; display: block;">`;
        } else if (message.message_type === 'pdf') {
            content += `
                <div style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                    <div style="font-size: 13px; font-weight: 600;">${message.file_name}</div>
                    <div style="font-size: 11px; color: #666;">${formatFileSize(message.file_size)}</div>
                </div>
            `;
        }
    }
    
    bubble.innerHTML = content;

    // Timestamp
    const time = document.createElement('div');
    time.style.cssText = `
        font-size: 11px;
        color: #667781;
        margin-top: 4px;
        text-align: ${isSent ? 'right' : 'left'};
        padding: 0 8px;
        opacity: 0.7;
    `;
    
    const timestamp = new Date(message.created_at);
    const timeStr = timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    if (isSent) {
        time.innerHTML = `<i class="fas fa-check-double" style="color: #4fc3f7; margin-right: 4px;"></i> ${timeStr}`;
    } else {
        time.textContent = timeStr;
    }

    messageContent.appendChild(bubble);
    messageContent.appendChild(time);
    messageWrapper.appendChild(messageContent);
    container.appendChild(messageWrapper);
    
    console.log('✅ Mensagem exibida');
}
```

## RESULTADO FINAL

Com essas mudanças, o chatBrio.html usará **100% Supabase**:
- ✅ Conversas salvas na tabela `conversations`
- ✅ Mensagens salvas na tabela `messages`
- ✅ Tempo real com Supabase Realtime
- ✅ Upload de arquivos no Storage do Supabase
