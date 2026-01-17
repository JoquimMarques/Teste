/**
 * Sistema de Hashtags e Menções
 * Detecta @algo e #algo e formata com cores diferentes
 */

class HashtagSystem {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Event listeners para os campos de título e conteúdo
        const titleInput = document.getElementById('title');
        const contentTextarea = document.getElementById('content');

        if (titleInput) {
            titleInput.addEventListener('input', (e) => {
                this.handleTextInput(e.target);
            });
        }

        if (contentTextarea) {
            contentTextarea.addEventListener('input', (e) => {
                this.handleTextInput(e.target);
            });
        }
    }

    /**
     * Processa o texto de entrada e detecta hashtags/menções
     */
    handleTextInput(element) {
        const text = element.value;
        const cursorPosition = element.selectionStart;
        
        // Detectar hashtags (#algo) e menções (@algo)
        const hashtagRegex = /#(\w+)/g;
        const mentionRegex = /@(\w+)/g;
        
        // Mostrar preview se estiver digitando uma hashtag ou menção
        this.showPreview(element, text, cursorPosition);
        
        // Salvar a posição do cursor para restaurar depois
        setTimeout(() => {
            element.selectionStart = cursorPosition;
            element.selectionEnd = cursorPosition;
        }, 0);
    }

    /**
     * Mostra preview em tempo real das hashtags/menções
     */
    showPreview(element, text, cursorPosition) {
        // Remover preview anterior
        const existingPreview = element.parentNode.querySelector('.hashtag-preview, .mention-preview');
        if (existingPreview) {
            existingPreview.remove();
        }

        // Verificar se está digitando uma hashtag ou menção
        const textBeforeCursor = text.substring(0, cursorPosition);
        const lastHashtag = textBeforeCursor.lastIndexOf('#');
        const lastMention = textBeforeCursor.lastIndexOf('@');
        
        let preview = null;
        
        // Verificar hashtag
        if (lastHashtag > lastMention && lastHashtag !== -1) {
            const hashtagText = textBeforeCursor.substring(lastHashtag);
            if (hashtagText.match(/^#\w*$/)) {
                preview = this.createPreview('hashtag', hashtagText);
            }
        }
        
        // Verificar menção
        if (lastMention > lastHashtag && lastMention !== -1) {
            const mentionText = textBeforeCursor.substring(lastMention);
            if (mentionText.match(/^@\w*$/)) {
                preview = this.createPreview('mention', mentionText);
            }
        }

        // Mostrar preview se encontrou algo
        if (preview) {
            element.parentNode.appendChild(preview);
            
            // Auto-remover preview após 3 segundos
            setTimeout(() => {
                if (preview && preview.parentNode) {
                    preview.remove();
                }
            }, 3000);
        }
    }

    /**
     * Cria elemento de preview
     */
    createPreview(type, text) {
        const preview = document.createElement('div');
        preview.className = `${type}-preview`;
        
        const formattedText = this.formatText(text);
        
        // Adicionar sugestões populares
        const suggestions = this.getSuggestions(type, text);
        
        preview.innerHTML = `
            <div style="margin-bottom: 8px;">
                <strong>Preview:</strong> ${formattedText}
            </div>
            ${suggestions ? `
                <div style="font-size: 0.8em; color: #666;">
                    <strong>Sugestões:</strong> ${suggestions}
                </div>
            ` : ''}
        `;
        
        return preview;
    }

    /**
     * Retorna sugestões populares de hashtags ou menções
     */
    getSuggestions(type, text) {
        const popularHashtags = [
            '#programacao', '#tecnologia', '#javascript', '#python', '#webdev',
            '#mecanica', '#carros', '#engenharia', '#inovacao', '#briolink'
        ];
        
        const popularMentions = [
            '@admin', '@moderador', '@dev', '@professor', '@amigo'
        ];
        
        if (type === 'hashtag' && text.length <= 2) {
            return popularHashtags.slice(0, 5).join(' ');
        }
        
        if (type === 'mention' && text.length <= 2) {
            return popularMentions.slice(0, 5).join(' ');
        }
        
        return null;
    }

    /**
     * Formata texto com hashtags e menções
     */
    formatText(text) {
        if (!text) return '';
        
        // Formatar hashtags (#algo)
        let formatted = text.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');
        
        // Formatar menções (@algo)
        formatted = formatted.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
        
        return formatted;
    }

    /**
     * Formata texto para exibição em publicações
     */
    formatPublicationText(text) {
        if (!text) return '';
        
        // Converter quebras de linha para <br>
        let formatted = text.replace(/\n/g, '<br>');
        
        // Formatar hashtags e menções
        formatted = this.formatText(formatted);
        
        return formatted;
    }

    /**
     * Extrai hashtags de um texto
     */
    extractHashtags(text) {
        if (!text) return [];
        const matches = text.match(/#\w+/g);
        return matches ? matches.map(tag => tag.toLowerCase()) : [];
    }

    /**
     * Extrai menções de um texto
     */
    extractMentions(text) {
        if (!text) return [];
        const matches = text.match(/@\w+/g);
        return matches ? matches.map(mention => mention.toLowerCase()) : [];
    }

    /**
     * Aplica formatação a um elemento HTML
     */
    applyFormatting(element) {
        if (!element || !element.innerHTML) return;
        
        element.innerHTML = this.formatText(element.innerHTML);
    }
}

// Instanciar o sistema quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.hashtagSystem = new HashtagSystem();
});

// Função global para formatar texto (usada em outros arquivos)
window.formatTextWithHashtags = function(text) {
    if (window.hashtagSystem) {
        return window.hashtagSystem.formatText(text);
    }
    return text;
};

// Função global para formatar texto de publicações
window.formatPublicationText = function(text) {
    if (window.hashtagSystem) {
        return window.hashtagSystem.formatPublicationText(text);
    }
    return text;
};

// Exportar para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HashtagSystem;
}
