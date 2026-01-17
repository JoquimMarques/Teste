// Supabase Configuration - Initialize only if not already done
(function initSupabase() {
    if (window.supabaseClient) {
        return; // Already initialized
    }

    // Check if Supabase SDK is loaded
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        console.error('Supabase SDK not loaded! Make sure the CDN script is included before this script.');
        return;
    }

    try {
        var SUPABASE_URL = 'https://nvswucwnvshvklqgojcw.supabase.co';
        var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52c3d1Y3dudnNodmtscWdvamN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNTY0MjAsImV4cCI6MjA2NjYzMjQyMH0.axU4sYS4G9b_Ebo1oiXVcVP933gcWytAb80hPEEQPBA';
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    } catch (error) {
        console.error('Error initializing Supabase client:', error);
    }
})();

var supabase = window.supabaseClient;

// Variáveis globais
let publications = [];
let currentFilter = 'all';
let searchTimeout;
let realtimeSubscription;
let currentUser = null;
let notificationsCountInterval = null;
// Realtime de notificações - controle
let notificationsChannel = null;
let notificationsPollInterval = null;
let previousUnreadCount = 0;
let audioEnabled = false;
let unreadNotificationsCount = 0;
let isFetchingNotificationsCount = false;

// Habilita áudio após primeira interação do usuário (política de autoplay)
function unlockAudioOnFirstInteraction() {
    function enable() {
        audioEnabled = true;

        // Remover todos os event listeners
        document.removeEventListener('click', enable);
        document.removeEventListener('keydown', enable);
        document.removeEventListener('touchstart', enable);
        document.removeEventListener('mousedown', enable);
        document.removeEventListener('scroll', enable);
        document.removeEventListener('touchend', enable, { passive: true });

        // Testar se o áudio funciona
        setTimeout(() => {
            playNotificationSound();
        }, 100);
    }

    // Adicionar múltiplos event listeners para garantir que funcione
    document.addEventListener('click', enable);
    document.addEventListener('keydown', enable);
    document.addEventListener('touchstart', enable, { passive: true });
    document.addEventListener('mousedown', enable);
    document.addEventListener('scroll', enable);
    document.addEventListener('touchend', enable, { passive: true });

    // Para dispositivos móveis, tentar habilitar imediatamente
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        // Dispositivo touch - tentar habilitar áudio
        setTimeout(() => {
            audioEnabled = true;
        }, 1000);
    }
}

// Variáveis para armazenar arquivos selecionados
let selectedPhoto = null;
let selectedVideo = null;

// Serviços de publicações (definido primeiro para evitar erros)
const PublicationsService = {
    // Buscar todas as publicações - OTIMIZADO com limite
    async getAllPublications() {
        try {
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .order('impulses_count', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(50); // Limitar a 50 publicações para melhor performance

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Erro ao buscar publicações:', error);
            return [];
        }
    },

    // Buscar publicações por categoria
    async getPublicationsByCategory(category) {
        try {
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .eq('category', category)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Erro ao buscar publicações por categoria:', error);
            return [];
        }
    },

    // Criar nova publicação
    async createPublication(publicationData) {
        try {
            if (!currentUser) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase
                .from('publications')
                .insert([{
                    title: publicationData.title,
                    author: currentUser.name,
                    author_id: currentUser.id,
                    content: publicationData.content,
                    category: publicationData.category,
                    photo_url: publicationData.photo_url || null,
                    video_url: publicationData.video_url || null,
                    likes_count: 0,
                    dislikes_count: 0,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao criar publicação:', error);
            throw error;
        }
    },

    // Atualizar publicação
    async updatePublication(id, updates) {
        try {
            const { data, error } = await supabase
                .from('publications')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao atualizar publicação:', error);
            throw error;
        }
    },

    // Deletar publicação
    async deletePublication(id) {
        try {
            const { error } = await supabase
                .from('publications')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Erro ao deletar publicação:', error);
            throw error;
        }
    },

    // Buscar publicações por termo
    async searchPublications(searchTerm) {
        try {
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
                .order('impulses_count', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Erro ao buscar publicações:', error);
            return [];
        }
    },

    // Buscar ranking de usuários por impulsos recebidos
    async getUsersRanking() {
        try {
            const { data, error } = await supabase
                .from('publications')
                .select(`
                    author_id,
                    author,
                    impulses_count,
                    profiles!inner(name, turma, short_description)
                `)
                .not('impulses_count', 'is', null)
                .gt('impulses_count', 0)
                .order('impulses_count', { ascending: false });

            if (error) throw error;

            // Agrupar por usuário e somar impulsos
            const userRanking = {};
            data.forEach(pub => {
                if (!userRanking[pub.author_id]) {
                    userRanking[pub.author_id] = {
                        id: pub.author_id,
                        name: pub.author,
                        turma: pub.profiles?.turma || 'Não definida',
                        short_description: pub.profiles?.short_description || 'Profissão ou área',
                        total_impulses: 0,
                        publications_count: 0
                    };
                }
                userRanking[pub.author_id].total_impulses += pub.impulses_count || 0;
                userRanking[pub.author_id].publications_count += 1;
            });

            return Object.values(userRanking).sort((a, b) => b.total_impulses - a.total_impulses);
        } catch (error) {
            console.error('Erro ao buscar ranking:', error);
            return [];
        }
    },

    // Verificar interação do usuário
    async getUserInteraction(publicationId) {
        try {
            if (!currentUser) return null;
            if (!publicationId) {
                console.warn('publicationId é undefined');
                return null;
            }

            // Verificar se a tabela user_interactions existe e tem RLS habilitado
            const { data, error } = await supabase
                .from('user_interactions')
                .select('*')
                .eq('publication_id', publicationId)
                .eq('user_id', currentUser.id)
                .single();

            if (error) {
                // Se der erro 406, significa que RLS está bloqueando
                if (error.code === '406' || error.message.includes('406')) {
                    return null;
                }
                if (error.code !== 'PGRST116') throw error;
            }
            return data;
        } catch (error) {
            console.error('Erro ao verificar interação:', error);
            return null;
        }
    },

    // Adicionar like
    async addLike(publicationId) {
        try {
            if (!currentUser) throw new Error('Usuário não autenticado');

            // Verificar se já existe interação
            const existingInteraction = await this.getUserInteraction(publicationId);

            if (existingInteraction) {
                if (existingInteraction.interaction_type === 'like') {
                    // Remover like
                    await this.removeInteraction(publicationId, 'like');
                } else {
                    // Mudar de dislike para like
                    await this.updateInteraction(publicationId, 'dislike', 'like');
                }
            } else {
                // Adicionar nova interação
                const { error } = await supabase
                    .from('user_interactions')
                    .insert([{
                        publication_id: publicationId,
                        user_id: currentUser.id,
                        interaction_type: 'like',
                        created_at: new Date().toISOString()
                    }]);

                if (error) throw error;
            }

            // Retornar a publicação atualizada com contadores
            return await this.getPublicationWithCounts(publicationId);
        } catch (error) {
            console.error('Erro ao adicionar like:', error);
            throw error;
        }
    },

    // Adicionar dislike
    async addDislike(publicationId) {
        try {
            if (!currentUser) throw new Error('Usuário não autenticado');

            // Verificar se já existe interação
            const existingInteraction = await this.getUserInteraction(publicationId);

            if (existingInteraction) {
                if (existingInteraction.interaction_type === 'dislike') {
                    // Remover dislike
                    await this.removeInteraction(publicationId, 'dislike');
                } else {
                    // Mudar de like para dislike
                    await this.updateInteraction(publicationId, 'like', 'dislike');
                }
            } else {
                // Adicionar nova interação
                const { error } = await supabase
                    .from('user_interactions')
                    .insert([{
                        publication_id: publicationId,
                        user_id: currentUser.id,
                        interaction_type: 'dislike',
                        created_at: new Date().toISOString()
                    }]);

                if (error) throw error;
            }

            // Retornar a publicação atualizada com contadores
            return await this.getPublicationWithCounts(publicationId);
        } catch (error) {
            console.error('Erro ao adicionar dislike:', error);
            throw error;
        }
    },

    // Buscar publicação com contadores atualizados
    async getPublicationWithCounts(publicationId) {
        try {
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .eq('id', publicationId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao buscar publicação:', error);
            throw error;
        }
    },

    // Remover interação
    async removeInteraction(publicationId, interactionType) {
        try {
            const { error } = await supabase
                .from('user_interactions')
                .delete()
                .eq('publication_id', publicationId)
                .eq('user_id', currentUser.id)
                .eq('interaction_type', interactionType);

            if (error) throw error;
        } catch (error) {
            console.error('Erro ao remover interação:', error);
            throw error;
        }
    },

    // Atualizar interação
    async updateInteraction(publicationId, oldType, newType) {
        try {
            const { error } = await supabase
                .from('user_interactions')
                .update({ interaction_type: newType })
                .eq('publication_id', publicationId)
                .eq('user_id', currentUser.id)
                .eq('interaction_type', oldType);

            if (error) throw error;
        } catch (error) {
            console.error('Erro ao atualizar interação:', error);
            throw error;
        }
    }
};


function toggleMobileMenu() {
    const nav = document.getElementById('nav');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const overlay = document.getElementById('menuOverlay');
    const icon = mobileMenuBtn.querySelector('i');

    if (nav.classList.contains('active')) {
        closeMobileMenu();
    } else {
        nav.classList.add('active');
        if (overlay) overlay.classList.add('active');
        // Trocar ícone para X
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
        mobileMenuBtn.classList.add('active');
    }
}

function closeMobileMenu() {
    const nav = document.getElementById('nav');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const overlay = document.getElementById('menuOverlay');
    const icon = mobileMenuBtn.querySelector('i');

    nav.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    // Voltar para ícone de barras
    icon.classList.remove('fa-times');
    icon.classList.add('fa-bars');
    mobileMenuBtn.classList.remove('active');

    // Fechar submenu de categorias também
    const submenu = document.getElementById('mobileCategoriesSubmenu');
    const arrow = document.querySelector('.mobile-category-arrow');
    if (submenu) submenu.style.display = 'none';
    if (arrow) arrow.classList.remove('rotated');
}

// Toggle do submenu de categorias no menu mobile
function toggleMobileCategories(event) {
    event.preventDefault();
    event.stopPropagation();

    const submenu = document.getElementById('mobileCategoriesSubmenu');
    const arrow = document.querySelector('.mobile-category-arrow');

    if (submenu) {
        if (submenu.style.display === 'none' || !submenu.style.display) {
            submenu.style.display = 'flex';
            if (arrow) arrow.classList.add('rotated');
        } else {
            submenu.style.display = 'none';
            if (arrow) arrow.classList.remove('rotated');
        }
    }
}

function toggleSearch() {
    const searchContainer = document.querySelector('.search-container');
    searchContainer.classList.toggle('active');
}

// Fechar menu ao clicar no overlay
document.addEventListener('DOMContentLoaded', function () {
    const overlay = document.getElementById('menuOverlay');
    if (overlay) {
        overlay.addEventListener('click', function () {
            closeMobileMenu();
        });
    }
});

// Fechar busca ao clicar fora dela
document.addEventListener('click', function (event) {
    const searchContainer = document.querySelector('.search-container');
    if (!searchContainer.contains(event.target)) {
        searchContainer.classList.remove('active');
    }
});

// Fechar menu ao pressionar ESC
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeMobileMenu();
    }
});


// Funções de loading
function showLoading() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.style.display = 'none';
    }
}

// Funções de modal
function openModal() {
    const modal = document.getElementById('publicationModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const modal = document.getElementById('publicationModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        publicationForm.reset();
    }
}

// Funções utilitárias foram movidas para src/js/app-utils.js

// Função para verificar interação do usuário
async function getUserInteraction(publicationId) {
    try {
        if (!currentUser) return null;
        const { data, error } = await supabase
            .from('user_interactions')
            .select('*')
            .eq('publication_id', publicationId)
            .eq('user_id', currentUser.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    } catch (error) {
        console.error('Erro ao verificar interação:', error);
        return null;
    }
}

// Função para converter URLs em links clicáveis e formatar o texto
function formatPublicationContent(text) {
    if (!text) return '';

    // Primeiro converter URLs em links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let formattedText = text.replace(urlRegex, '<a href="$1" target="_blank" style="color:rgb(123, 52, 255); text-decoration: underline;">$1</a>');

    // Converter quebras de linha em <br> para manter a formatação
    formattedText = formattedText.replace(/\n/g, '<br>');

    // Formatar hashtags (#algo)
    formattedText = formattedText.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');

    // Formatar menções (@algo)
    formattedText = formattedText.replace(/@(\w+)/g, '<span class="mention">@$1</span>');

    return formattedText;
}

// Função para criar card de publicação
async function createPublicationCard(publication) {
    // Validações básicas
    if (!publication || !publication.id) {
        console.error('Publicação inválida:', publication);
        return '';
    }

    // Valores padrão para campos que podem estar undefined
    const author = publication.author || 'Usuário Desconhecido';
    const title = publication.title || 'Sem título';
    const content = publication.content || 'Sem conteúdo';
    const category = publication.category || 'outros';
    const created_at = publication.created_at || new Date().toISOString();
    const likes_count = publication.likes_count || 0;
    const dislikes_count = publication.dislikes_count || 0;
    const photoUrl = publication.photo_url;
    const videoUrl = publication.video_url;

    // Remover quebras de linha e espaços do início do conteúdo ANTES de formatar
    let cleanRawContent = content.replace(/^[\n\r\s]+/, '');
    // Converter para HTML formatado
    const formattedContent = formatPublicationContent(cleanRawContent);
    // Limitar tamanho se necessário
    let cleanContent = '';
    if (formattedContent.length > 70) {
        // Gera um id único para o conteúdo (pode ser o id da publicação)
        const contentId = `pub-content-${publication.id}`;
        cleanContent = `
        <div class="incury">
            <p id="${contentId}-short">
                ${formattedContent.substring(0, 70)}... 
                <a href="#" style="color:rgba(123, 52, 255, 0.65);text-decoration:underline;cursor:pointer;" onclick="mostrarConteudoCompleto('${contentId}'); return false;">ver mais</a>
            </p>
            <p id="${contentId}-full" style="display:none;">
                ${formattedContent} 
                <a href="#" style="color: rgba(116, 45, 246, 0.79)text-decoration:underline;cursor:pointer;" onclick="esconderConteudoCompleto('${contentId}'); return false;">ver menos</a>
            </p>
        </div>
        `;
    } else {
        cleanContent = formattedContent;
    }

    // Funções globais para mostrar/esconder conteúdo completo
    window.mostrarConteudoCompleto = function (contentId) {
        document.getElementById(contentId + '-short').style.display = 'none';
        document.getElementById(contentId + '-full').style.display = '';
    };
    window.esconderConteudoCompleto = function (contentId) {
        document.getElementById(contentId + '-short').style.display = '';
        document.getElementById(contentId + '-full').style.display = 'none';
    };

    // HTML para mídia
    let mediaHTML = '';
    if (photoUrl) {
        mediaHTML = `<div class="publication-media">
            <img src="${photoUrl}" alt="Foto da publicação" class="publication-image">
        </div>`;
    } else if (videoUrl) {
        mediaHTML = `<div class="publication-media">
            <video controls class="publication-video video-js vjs-theme-city" data-setup='{}'>
                <source src="${videoUrl}" type="video/mp4">
                Seu navegador não suporta vídeos.
            </video>
        </div>`;
    }

    return `
        <article class="publication-card" data-id="${publication.id}" data-category="${category}">
            <div class="publication-header">
                <div class="publication-avatar" data-author-id="${publication.author_id || ''}">
                    ${renderAvatarHTML(publication.author_id || '', author)}
                </div>
                <div class="publication-info">
                    <div class="publication-author" data-author-id="${publication.author_id || ''}">${author}</div>
                    <div class="publication-meta">
                        <span>${formatDate(created_at)}</span>
                        <span class="publication-category">${getCategoryName(category)}</span>
                    </div>
                </div>
            </div>
            <div class="publication-content">
                <h3 style="margin-bottom: 0; font-size: 1.1rem;">${title}</h3>
                <p>${cleanContent}</p>
            </div>
            ${mediaHTML}
            <div class="publication-actions">
                <button class="publication-action like-btn" onclick="handleLike('${publication.id}')">
                    <i class="fas fa-thumbs-up" style="color:rgba(8, 188, 23, 0.74);"></i>
                    <span class="action-text"></span>
                    <span class="action-count">${likes_count}</span>
                </button>
                <button class="publication-action dislike-btn" onclick="handleDislike('${publication.id}')">
                    <i class="fas fa-thumbs-down" style="color:rgba(248, 62, 37, 0.78);"></i>
                    <span class="action-text"></span>
                    <span class="action-count">${dislikes_count}</span>
                </button>
                
                <button class="publication-action comment-btn" onclick="openCommentModal('${publication.id}')">
                    <i class="fas fa-comment" style="color:rgba(102, 0, 255, 0.79);"></i>
                    <span class="action-text">Comentar</span>
                    <span class="action-count" id="comment-count-${publication.id}">0</span>
                </button>
                ${currentUser && publication.author_id === currentUser.id ?
            `<button class="publication-action delete-btn" onclick="deletePublication('${publication.id}')" style="color: #e74c3c; margin-left: 10px">
                        <i class="fas fa-trash"></i>
                        <span class="action-text">Excluir</span>
                    </button>` :
            `<button class="publication-action impulse-btn" onclick="handleImpulse('${publication.id}')">
                        <i class="fas fa-fire" style="color:rgba(255, 107, 53, 0.8);"></i>
                        <span class="action-text">Impulsar</span>
                        <span class="action-count">${publication.impulses_count || 0}</span>
                    </button>`
        }
            </div>
        </article>
    `;
}

// Função para renderizar as publicações - OTIMIZADA
async function renderPublications(publicationsToRender = publications) {
    if (publicationsToRender.length === 0) {
        publicationsGrid.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #65676b; background: white; border-radius: 8px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                <i class="fas fa-newspaper" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; color:rgb(91, 9, 213);"></i>
                <h3>Nenhuma publicação encontrada</h3>
                <p>Clique em "Escrever" para criar sua primeira publicação!</p>
            </div>
        `;
        return;
    }

    // Renderizar cards primeiro (sem esperar comentários)
    const cardPromises = publicationsToRender.map(createPublicationCard);
    const cards = await Promise.all(cardPromises);
    publicationsGrid.innerHTML = cards.join('');
    setupUserProfileClickEvents();

    // IMPORTANTE: Carregar interações do usuário IMEDIATAMENTE após renderizar os cards
    // Isso garante que os likes/dislikes anteriores sejam marcados corretamente
    if (currentUser) {
        try {
            await loadUserInteractions();
        } catch (err) {
            console.error('Erro ao carregar interações:', err);
        }
    }

    // Carregar contadores de comentários em paralelo (sem bloquear renderização)
    loadCommentCounts(publicationsToRender).catch(err => console.error('Erro ao carregar comentários:', err));

    // Inicializar Plyr em todos os vídeos de publicação (lazy)
    if (window.Plyr) {
        // Usar requestAnimationFrame para não bloquear
        requestAnimationFrame(() => {
            document.querySelectorAll('.publication-video').forEach(video => {
                if (!video.classList.contains('plyr-initialized')) {
                    new Plyr(video, {});
                    video.classList.add('plyr-initialized');
                }
            });
        });
    }
}

// Função para carregar publicações - COM CACHE LOCAL
async function loadPublications() {
    try {
        showLoading();

        // Dados de exemplo para funcionar sem Supabase
        const examplePublications = [
            {
                id: 1,
                title: "Meu Primeiro Projeto",
                author: "João Silva",
                author_id: "user1",
                content: "Este é um projeto incrível desenvolvido em React e Node.js.\n\nFuncionalidades principais:\n- Dashboard interativo\n- Gestão de usuários\n- Relatórios em tempo real\n- API RESTful\n\nTecnologias: React, Node.js, PostgreSQL, Docker\n\nLinks importantes:\nGitHub: https://github.com/joao/projeto\nDocumentação: https://docs.projeto.com\nDemo: https://demo.projeto.com",
                category: "tecnologia",
                likes_count: 5,
                dislikes_count: 1,
                created_at: "2024-01-15T10:30:00Z"
            },
            {
                id: 2,
                title: "Sistema de Gestão Empresarial",
                author: "Maria Santos",
                author_id: "user2",
                content: "Sistema completo para gestão de empresas.\n\nFuncionalidades:\n- Controle financeiro\n- Gestão de estoque\n- Relatórios gerenciais\n- Interface responsiva\n\nTecnologias: Vue.js, Laravel, MySQL\n\nLinks:\nGitHub: https://github.com/maria/sistema\nDemo: https://demo.sistema.com",
                category: "negocios",
                likes_count: 8,
                dislikes_count: 0,
                created_at: "2024-01-14T15:45:00Z"
            }
        ];

        // CACHE: Tentar carregar do cache primeiro
        const cachedPublications = window.CacheService?.get('publications');
        if (cachedPublications && cachedPublications.length > 0) {

            publications = cachedPublications;
            await renderPublications();
            hideLoading();

            // Atualizar em background (stale-while-revalidate)
            refreshPublicationsInBackground();

            // Mostrar o elemento de criar publicação
            const createPostElement = document.getElementById('createPost');
            if (createPostElement && currentUser) {
                createPostElement.style.display = 'block';
            }

            // Carregar outros dados em paralelo
            loadSupportingData();
            return;
        }

        // Tentar carregar do Supabase
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 5000);
            });

            const loadPromise = PublicationsService.getAllPublications();
            publications = await Promise.race([loadPromise, timeoutPromise]);

            // CACHE: Salvar no cache
            if (window.CacheService && publications.length > 0) {
                window.CacheService.set('publications', publications, window.CacheService.TTL.publications);
            }
        } catch (error) {
            console.warn('Erro ao carregar do Supabase, usando dados de exemplo:', error);
            publications = examplePublications;
        }

        await renderPublications();

        // Mostrar o elemento de criar publicação quando carregar as publicações (se estiver logado)
        const createPostElement = document.getElementById('createPost');
        if (createPostElement && currentUser) {
            createPostElement.style.display = 'block';
        }

        // Carregar dados de suporte
        loadSupportingData();

    } catch (error) {
        console.error('Erro ao carregar publicações:', error);
        showNotification('Erro ao carregar publicações: ' + error.message, 'error');

        // Mostrar mensagem de erro mais amigável
        publicationsGrid.innerHTML = `
            <div style="text-align: center; padding: 3rem; color:rgb(255, 255, 255); background: white; border-radius: 8px; box-shadow: 0 1px 2px rgba(149, 9, 255, 0.56);">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; color: #e74c3c;"></i>
                <h3>Erro ao carregar publicações</h3>
                <p>${error.message}</p>
                <button onclick="loadPublications()" style="margin-top: 1rem; padding: 10px 20px; background:rgb(104, 3, 162); color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Tentar Novamente
                </button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// Função auxiliar para carregar dados de suporte em background
function loadSupportingData() {
    if (currentUser) {
        Promise.all([
            loadUserInteractions().catch(err => console.error('Erro ao carregar interações:', err)),
            preloadAuthorsAvatars(publications).catch(_ => { }),
            loadAdvertisements().catch(err => console.error('Erro ao carregar anúncios:', err))
        ]);
    } else {
        preloadAuthorsAvatars(publications).catch(_ => { });
        loadAdvertisements().catch(err => console.error('Erro ao carregar anúncios:', err));
    }
}

// Função para atualizar publicações em background (stale-while-revalidate)
async function refreshPublicationsInBackground() {
    try {
        const freshData = await PublicationsService.getAllPublications();
        if (freshData && freshData.length > 0) {
            // Atualizar cache com dados frescos
            window.CacheService?.set('publications', freshData, window.CacheService.TTL.publications);

            // Verificar se há diferenças significativas
            if (JSON.stringify(freshData) !== JSON.stringify(publications)) {
                console.log('[Cache] Dados atualizados em background');
                publications = freshData;
                // Não re-renderizar imediatamente para não incomodar o usuário
                // Os dados serão mostrados na próxima navegação
            }
        }
    } catch (error) {
        console.warn('[Cache] Erro ao atualizar em background:', error);
    }
}

// Função para carregar e exibir anúncios na sidebar - COM CACHE
async function loadAdvertisements() {
    const adsContainer = document.getElementById('adsContainer');
    if (!adsContainer) return;

    // Função para renderizar anúncios
    function renderAds(ads) {
        if (!ads || ads.length === 0) {
            adsContainer.innerHTML = `
                <div class="ads-empty">
                    <i class="fas fa-ad"></i>
                    <p>Nenhum anúncio disponível</p>
                </div>
            `;
            return;
        }

        adsContainer.innerHTML = ads.map(ad => `
            <div class="ad-card">
                ${ad.image_url ? `<img src="${ad.image_url}" alt="${ad.title}" class="ad-card-image">` : ''}
                <div class="ad-card-content">
                    <h4 class="ad-card-title">${ad.title}</h4>
                    <p class="ad-card-description">${ad.description}</p>
                    ${ad.link_url ? `
                        <a href="${ad.link_url}" target="_blank" rel="noopener noreferrer" class="ad-card-link">
                            <i class="fas fa-external-link-alt"></i>
                            Saiba mais
                        </a>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    try {
        // CACHE: Tentar carregar do cache primeiro
        const cachedAds = window.CacheService?.get('advertisements');
        if (cachedAds) {

            renderAds(cachedAds);
            return;
        }

        const { data: ads, error } = await supabase
            .from('advertisements')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // CACHE: Salvar no cache (15 minutos para anúncios)
        if (window.CacheService) {
            window.CacheService.set('advertisements', ads || [], window.CacheService.TTL.advertisements);
        }

        renderAds(ads);
    } catch (error) {
        console.error('Erro ao carregar anúncios:', error);
        adsContainer.innerHTML = `
            <div class="ads-empty">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro ao carregar anúncios</p>
            </div>
        `;
    }
}

// Função para carregar interações do usuário
async function loadUserInteractions() {
    try {
        if (!currentUser) return;

        // Buscar todas as interações do usuário de uma vez
        const { data: interactions, error } = await supabase
            .from('user_interactions')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        if (!interactions || interactions.length === 0) return;

        // Atualizar botões com base nas interações
        interactions.forEach(interaction => {
            const pubId = String(interaction.publication_id);
            const card = document.querySelector(`[data-id="${pubId}"]`);

            if (!card) return;

            const likeBtn = card.querySelector('.like-btn');
            const dislikeBtn = card.querySelector('.dislike-btn');

            if (likeBtn && dislikeBtn) {
                likeBtn.classList.remove('active');
                dislikeBtn.classList.remove('active');

                if (interaction.interaction_type === 'like') {
                    likeBtn.classList.add('active');
                } else if (interaction.interaction_type === 'dislike') {
                    dislikeBtn.classList.add('active');
                }
            }
        });
    } catch (error) {
        console.error('Erro ao carregar interações:', error);
    }
}

// Função para adicionar publicação
async function addPublication(publicationData) {
    try {
        if (!currentUser) {
            throw new Error('Usuário não autenticado');
        }

        // Upload de foto se selecionada
        let photoUrl = null;
        if (selectedPhoto) {
            photoUrl = await uploadFileToStorage(selectedPhoto, 'photos');
        }

        // Upload de vídeo se selecionado
        let videoUrl = null;
        if (selectedVideo) {
            videoUrl = await uploadFileToStorage(selectedVideo, 'videos');
        }

        const newPublication = await PublicationsService.createPublication({
            ...publicationData,
            author: currentUser.name,
            author_id: currentUser.id,
            photo_url: photoUrl,
            video_url: videoUrl
        });

        // Criar notificações para todos os outros usuários
        await criarNotificacoesNovaPublicacao(newPublication);

        // CACHE: Invalidar cache de publicações
        window.CacheService?.invalidate('publications');

        publications.unshift(newPublication);
        await renderPublications();

        // Limpar arquivos selecionados
        selectedPhoto = null;
        selectedVideo = null;
        removePhoto();
        removeVideo();

        // Notificação de sucesso
        showNotification('Publicação criada com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao criar publicação:', error);
        showNotification('Erro ao criar publicação', 'error');
    }
}

// Função para deletar publicação
let deleteInProgress = false;

async function deletePublication(id) {
    if (deleteInProgress) return;
    deleteInProgress = true;

    if (!currentUser) {
        showNotification('Faça login para excluir publicações', 'warning');
        deleteInProgress = false;
        return;
    }

    try {
        const publication = publications.find(pub => String(pub.id) === String(id));

        if (!publication) {
            showNotification('Publicação não encontrada', 'error');
            return;
        }

        if (publication.author_id !== currentUser.id) {
            showNotification('Você só pode excluir suas próprias publicações', 'error');
            return;
        }

        // Deletar no Supabase
        const { error } = await supabase
            .from('publications')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // CACHE: Invalidar cache de publicações
        window.CacheService?.invalidate('publications');

        // Remover da lista local
        publications = publications.filter(pub => String(pub.id) !== String(id));
        await renderPublications();
        showNotification('Publicação excluída com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao deletar publicação:', error);
        showNotification('Erro ao excluir publicação', 'error');
    } finally {
        deleteInProgress = false;
    }
}

// Função para lidar com like
async function handleLike(publicationId) {
    try {
        if (!currentUser) {
            showNotification('Faça login para curtir publicações', 'warning');
            return;
        }

        if (!publicationId) {
            console.error('publicationId é undefined');
            return;
        }

        // Feedback visual imediato
        const likeBtn = document.querySelector(`[data-id="${publicationId}"] .like-btn`);
        const dislikeBtn = document.querySelector(`[data-id="${publicationId}"] .dislike-btn`);
        const likeCount = document.querySelector(`[data-id="${publicationId}"] .like-btn .action-count`);
        const dislikeCount = document.querySelector(`[data-id="${publicationId}"] .dislike-btn .action-count`);

        // Estado atual dos botões
        const wasLiked = likeBtn.classList.contains('active');
        const wasDisliked = dislikeBtn.classList.contains('active');

        // Atualização visual imediata
        if (wasLiked) {
            // Remover like
            likeBtn.classList.remove('active');
            likeCount.textContent = parseInt(likeCount.textContent) - 1;
        } else {
            // Adicionar like
            likeBtn.classList.add('active');
            likeCount.textContent = parseInt(likeCount.textContent) + 1;

            // Se estava com dislike, remover
            if (wasDisliked) {
                dislikeBtn.classList.remove('active');
                dislikeCount.textContent = parseInt(dislikeCount.textContent) - 1;
            }
        }

        // Atualizar dados locais
        const index = publications.findIndex(pub => String(pub.id) === String(publicationId));
        if (index !== -1) {
            if (wasLiked) {
                publications[index].likes_count--;
            } else {
                publications[index].likes_count++;
                if (wasDisliked) {
                    publications[index].dislikes_count--;
                }
            }
        }

        // Tentar salvar no Supabase (opcional)
        try {
            await PublicationsService.addLike(publicationId);
            // Notificar o autor da publicação sobre o like
            if (currentUser) {
                criarNotificacaoLike(publicationId, currentUser);
            }
        } catch (error) {
        }

    } catch (error) {
        console.error('Erro ao dar like:', error);
        showNotification('Erro ao curtir publicação', 'error');

        // Reverter mudanças visuais em caso de erro
        await renderPublications();
    }
}

// Função para lidar com dislike
async function handleDislike(publicationId) {
    try {
        if (!currentUser) {
            showNotification('Faça login para descurtir publicações', 'warning');
            return;
        }

        if (!publicationId) {
            console.error('publicationId é undefined');
            return;
        }

        // Feedback visual imediato
        const likeBtn = document.querySelector(`[data-id="${publicationId}"] .like-btn`);
        const dislikeBtn = document.querySelector(`[data-id="${publicationId}"] .dislike-btn`);
        const likeCount = document.querySelector(`[data-id="${publicationId}"] .like-btn .action-count`);
        const dislikeCount = document.querySelector(`[data-id="${publicationId}"] .dislike-btn .action-count`);

        // Estado atual dos botões
        const wasLiked = likeBtn.classList.contains('active');
        const wasDisliked = dislikeBtn.classList.contains('active');

        // Atualização visual imediata
        if (wasDisliked) {
            // Remover dislike
            dislikeBtn.classList.remove('active');
            dislikeCount.textContent = parseInt(dislikeCount.textContent) - 1;
        } else {
            // Adicionar dislike
            dislikeBtn.classList.add('active');
            dislikeCount.textContent = parseInt(dislikeCount.textContent) + 1;

            // Se estava com like, remover
            if (wasLiked) {
                likeBtn.classList.remove('active');
                likeCount.textContent = parseInt(likeCount.textContent) - 1;
            }
        }

        // Atualizar dados locais
        const index = publications.findIndex(pub => String(pub.id) === String(publicationId));
        if (index !== -1) {
            if (wasDisliked) {
                publications[index].dislikes_count--;
            } else {
                publications[index].dislikes_count++;
                if (wasLiked) {
                    publications[index].likes_count--;
                }
            }
        }

        // Tentar salvar no Supabase (opcional)
        try {
            await PublicationsService.addDislike(publicationId);
        } catch (error) {
        }

    } catch (error) {
        console.error('Erro ao dar dislike:', error);
        showNotification('Erro ao descurtir publicação', 'error');

        // Reverter mudanças visuais em caso de erro
        await renderPublications();
    }
}

// Função para lidar com impulso
async function handleImpulse(publicationId) {
    try {
        if (!currentUser) {
            showNotification('Faça login para impulsionar publicações', 'warning');
            return;
        }

        if (!publicationId) {
            console.error('publicationId é undefined');
            return;
        }

        // Verificar se já impulsionou hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count, error } = await supabase
            .from('impulses')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('publication_id', publicationId)
            .gte('created_at', today.toISOString());

        if (error) {
            console.error('Erro ao verificar impulsos:', error);
            showNotification('Erro ao verificar impulsos', 'error');
            return;
        }

        if (count > 0) {
            showNotification('Você já impulsionou esta publicação hoje!', 'warning');
            return;
        }

        // Registrar impulso
        const { error: insertError } = await supabase
            .from('impulses')
            .insert([{
                user_id: currentUser.id,
                publication_id: publicationId,
                created_at: new Date().toISOString()
            }]);

        if (insertError) {
            console.error('Erro ao registrar impulso:', insertError);
            showNotification('Erro ao impulsionar publicação', 'error');
            return;
        }

        // Buscar valor atual de impulses_count
        const { data: pub, error: pubError } = await supabase
            .from('publications')
            .select('impulses_count')
            .eq('id', publicationId)
            .single();

        if (pubError) {
            console.error('Erro ao buscar publicação:', pubError);
            showNotification('Erro ao atualizar contador', 'error');
            return;
        }

        const newCount = (pub.impulses_count || 0) + 1;

        // Atualizar contador na publicação
        await supabase
            .from('publications')
            .update({ impulses_count: newCount })
            .eq('id', publicationId);

        showNotification('Publicação impulsionada! 🔥', 'success');

        // Recarregar publicações para atualizar contadores
        await loadPublications();

    } catch (error) {
        console.error('Erro ao impulsionar:', error);
        showNotification('Erro ao impulsionar publicação', 'error');
    }
}
window.handleImpulse = handleImpulse;

// Função para buscar publicações
async function searchPublications(query) {
    try {
        if (query.trim() === '') {
            await renderPublications();
            return;
        }

        const searchResults = await PublicationsService.searchPublications(query);
        await renderPublications(searchResults);
    } catch (error) {
        console.error('Erro na busca:', error);
        showNotification('Erro ao buscar publicações', 'error');
    }
}

// Variável para controlar o filtro ativo de mídia
let activeMediaFilter = null;

// Função para filtrar publicações por tipo de mídia
async function filterByMedia(mediaType) {
    try {
        // Se o mesmo filtro for clicado novamente, desativar o filtro
        if (activeMediaFilter === mediaType) {
            activeMediaFilter = null;
            clearMediaFilters();

            // Voltar a mostrar todas as publicações baseado no filtro de categoria atual
            if (currentFilter === 'all') {
                await loadPublications();
            } else {
                publications = await PublicationsService.getPublicationsByCategory(currentFilter);
                await renderPublications();
            }

            return;
        }

        // Carregar todas as publicações se não estiverem carregadas
        if (!publications || publications.length === 0) {
            await loadPublications();
        }

        let filteredPublications = [];

        if (mediaType === 'photo') {
            // Filtrar publicações que têm foto
            filteredPublications = publications.filter(pub => {
                return pub.photo_url && pub.photo_url.trim() !== '';
            });
        } else if (mediaType === 'video') {
            // Filtrar publicações que têm vídeo
            filteredPublications = publications.filter(pub => {
                return pub.video_url && pub.video_url.trim() !== '';
            });
        }

        // Definir filtro ativo
        activeMediaFilter = mediaType;

        // Atualizar estado visual dos botões
        updateMediaFilterButtons(mediaType);

        // Renderizar publicações filtradas
        await renderPublications(filteredPublications);

    } catch (error) {
        console.error('Erro ao filtrar por mídia:', error);
        showNotification('Erro ao filtrar publicações', 'error');
    }
}

// Função para atualizar o estado visual dos botões de filtro de mídia
function updateMediaFilterButtons(activeType) {
    // Remover classe active de todos os botões de categoria
    document.querySelectorAll('.sidebar-item[data-filter]').forEach(item => {
        item.classList.remove('active');
    });

    // Adicionar classe active ao botão "Todos" se estivermos filtrando por mídia
    const allButton = document.querySelector('.sidebar-item[data-filter="all"]');
    if (allButton) {
        allButton.classList.add('active');
    }

    // Atualizar estilo dos botões de mídia
    const photoBtn = document.querySelector('.create-post-btn[onclick*="photo"]');
    const videoBtn = document.querySelector('.create-post-btn[onclick*="video"]');

    if (photoBtn && videoBtn) {
        // Remover classes ativas
        photoBtn.classList.remove('media-filter-active');
        videoBtn.classList.remove('media-filter-active');

        // Aplicar classe ativa ao botão selecionado
        if (activeType === 'photo') {
            photoBtn.classList.add('media-filter-active');
        } else if (activeType === 'video') {
            videoBtn.classList.add('media-filter-active');
        }
    }
}

// Função para limpar filtros de mídia e voltar ao estado normal
function clearMediaFilters() {
    activeMediaFilter = null;

    const photoBtn = document.querySelector('.create-post-btn[onclick*="photo"]');
    const videoBtn = document.querySelector('.create-post-btn[onclick*="video"]');

    if (photoBtn && videoBtn) {
        photoBtn.classList.remove('media-filter-active');
        videoBtn.classList.remove('media-filter-active');
    }
}

// Função para fazer scroll suave para o topo da página
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Função para mostrar ranking de usuários
async function showUsersRanking() {
    try {
        showLoading();

        // Ocultar o elemento de criar publicação quando estiver no ranking
        const createPostElement = document.getElementById('createPost');
        if (createPostElement) {
            createPostElement.style.display = 'none';
        }

        const ranking = await PublicationsService.getUsersRanking();

        if (ranking.length === 0) {
            publicationsGrid.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #65676b; background: white; border-radius: 8px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                    <i class="fas fa-trophy" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; color:rgb(91, 9, 213);"></i>
                    <h3>Nenhum ranking disponível</h3>
                    <p>Ainda não há impulsos registrados!</p>
                </div>
            `;
            return;
        }

        // Detectar modo escuro
        const isDarkMode = document.body.classList.contains('dark-mode');

        const rankingHTML = ranking.map((user, index) => {
            // Definir cores e bordas vibrantes baseadas na posição
            let cardBackground, cardBorder, borderColor, positionBg;

            if (index === 0) {
                // 1º lugar - Dourado vibrante
                cardBackground = 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)';
                cardBorder = '3px solid #ffb800';
                borderColor = '#ffb800';
                positionBg = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 237, 78, 0.4))';
            } else if (index === 1) {
                // 2º lugar - Prata vibrante
                cardBackground = 'linear-gradient(135deg,rgb(211, 209, 209) 0%,rgb(207, 205, 205) 100%)';
                cardBorder = '3px solid #c0c0c0';
                borderColor = '#c0c0c0';
                positionBg = 'linear-gradient(135deg, rgba(192, 192, 192, 0.3), rgba(229, 229, 229, 0.4))';
            } else if (index === 2) {
                // 3º lugar - Bronze vibrante
                cardBackground = 'linear-gradient(135deg, #cd7f32 0%, #e8a55d 100%)';
                cardBorder = '3px solid #b87333';
                borderColor = '#b87333';
                positionBg = 'linear-gradient(135deg, rgba(205, 127, 50, 0.3), rgba(232, 165, 93, 0.4))';
            } else {
                // Outros lugares - Ajustar para modo escuro
                if (isDarkMode) {
                    cardBackground = 'linear-gradient(135deg, #1f1f1f 0%, #1a1a1a 100%)';
                } else {
                    cardBackground = 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)';
                }
                cardBorder = '2px solid #7b00ff';
                borderColor = '#7b00ff';
                positionBg = 'rgba(123, 0, 255, 0.15)';
            }

            // Cores do texto baseadas no modo escuro
            let nameColor, descColor, turmaColor, pubColor;
            if (index <= 2) {
                // Top 3 - texto branco no modo escuro, texto escuro no modo claro
                if (isDarkMode) {
                    nameColor = '#ffffff';
                    descColor = 'rgba(255, 255, 255, 0.9)';
                    turmaColor = 'rgba(255, 255, 255, 0.85)';
                    pubColor = 'rgba(255, 255, 255, 0.9)';
                } else {
                    nameColor = '#1a0d33';
                    descColor = '#333';
                    turmaColor = '#555';
                    pubColor = '#555';
                }
            } else {
                // Outros lugares ajustam conforme modo escuro
                if (isDarkMode) {
                    nameColor = '#e0e0e0';
                    descColor = '#b0b0b0';
                    turmaColor = '#b0b0b0';
                    pubColor = '#b0b0b0';
                } else {
                    nameColor = '#2d1b4e';
                    descColor = '#666';
                    turmaColor = '#888';
                    pubColor = '#888';
                }
            }

            return `
            <div class="publication-card" style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: ${cardBackground}; border: ${cardBorder}; border-radius: 16px; box-shadow: 0 4px 20px rgba(${index === 0 ? '255, 215, 0' : index === 1 ? '192, 192, 192' : index === 2 ? '205, 127, 50' : '123, 0, 255'}, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15);">
                <div style="font-size: 1.5rem; font-weight: bold; color: ${index === 0 ? '#ffb800' : index === 1 ? '#9e9e9e' : index === 2 ? '#b87333' : '#7b00ff'}; min-width: 2rem; text-align: center; background: ${positionBg}; border: 2px solid ${borderColor}; border-radius: 12px; padding: 0.5rem; display: flex; align-items: center; justify-content: center;">
                    ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                </div>
                <div class="publication-avatar" onclick="viewUserProfile('${user.id}')" style="cursor: pointer;">
                    ${renderAvatarHTML(user.id, user.name)}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <h3 style="margin: 0; color: ${nameColor}; font-size: 1rem; font-weight: ${index <= 2 ? '800' : '700'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.name}</h3>
                    <p style="margin: 0.25rem 0; color: ${descColor}; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.short_description}</p>
                    <p style="margin: 0; color: ${turmaColor}; font-size: 0.75rem; font-weight: 600;">Turma: ${user.turma}</p>
                </div>
                <div style="text-align: right; min-width: 3rem;">
                    <div style="font-size: 1.2rem; font-weight: bold; background: linear-gradient(135deg, #ff6b35, #ff8c42); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; display: flex; align-items: center; gap: 0.25rem; justify-content: flex-end;">
                        <i class="fas fa-fire" style="font-size: 1rem; color: #ff6b35; filter: drop-shadow(0 2px 4px rgba(255, 107, 53, 0.4));"></i> ${user.total_impulses}
                    </div>
                    <div style="font-size: 0.7rem; color: ${pubColor}; margin-top: 0.25rem; font-weight: 600;">
                        ${user.publications_count} publicação${user.publications_count > 1 ? 's' : ''}
                    </div>
                </div>
            </div>
        `;
        }).join('');

        publicationsGrid.innerHTML = `
            <div style="text-align: center; margin-bottom: 1.5rem; background: linear-gradient(135deg, #6c3dd4 0%, #8b5cf6 50%, #a78bfa 100%); border-radius: 16px; padding: 2rem 1.5rem; box-shadow: 0 8px 32px rgba(124, 58, 237, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2); border: 2px solid rgba(255, 255, 255, 0.3);">
                <h2 style="color: #ffffff; margin: 0; font-size: 1.3rem; font-weight: bold; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);" >🏆 Ranking de Impulsos</h2>
                <p style="color: rgba(255, 255, 255, 0.95); margin: 0.5rem 0; font-size: 0.9rem; font-weight: 500;">Usuários com mais impulsos recebidos</p>
            </div>
            ${rankingHTML}
        `;
    } catch (error) {
        console.error('Erro ao carregar ranking:', error);
        showNotification('Erro ao carregar ranking', 'error');
    } finally {
        hideLoading();
    }
}

// Função auxiliar para atualizar contadores de notificações
function updateNotificationCounters(count) {
    // Atualizar contador PC
    const notificationCount = document.getElementById('notificationCount');
    if (notificationCount) {
        notificationCount.textContent = count;
        notificationCount.style.display = count > 0 ? 'inline-block' : 'none';
    }

    // Atualizar contador mobile
    const mobileNotificationCount = document.getElementById('mobileNotificationCount');
    if (mobileNotificationCount) {
        mobileNotificationCount.textContent = count;
        mobileNotificationCount.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

// Função para testar notificações (para debug)
function testNotification() {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Testar som
    playNotificationSound();

    // Testar animação do sino
    animateBell();

    // Testar notificação visual
    showNotification('🧪 Teste de notificação!', 'info', 3000);

    // Testar contador de notificações
    unreadNotificationsCount = 5;
    updateNotificationCounters(unreadNotificationsCount);

    // Para dispositivos móveis, testar fallbacks
    if (isMobile) {
        // Removido: showMobileNotificationFallback();

        // Testar vibração se disponível
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }

    // Simular notificação em tempo real
    setTimeout(() => {
        unreadNotificationsCount = 6;
        updateNotificationCounters(unreadNotificationsCount);
        playNotificationSound();
        animateBell();
        showNotification('⚡ Notificação simulada em tempo real!', 'success', 3000);

        // Para dispositivos móveis, notificação visual extra
        if (isMobile) {
            // Removido: showMobileNotificationFallback();
        }
    }, 2000);
}

// Função para filtrar notificações
window.filtrarNotificacoes = function (filterType) {
    if (!window.notificationsData) return;

    // Atualizar botões de filtro
    const allBtn = document.getElementById('filterAllBtn');
    const unreadBtn = document.getElementById('filterUnreadBtn');

    if (allBtn && unreadBtn) {
        allBtn.classList.remove('active');
        unreadBtn.classList.remove('active');

        if (filterType === 'all') {
            allBtn.classList.add('active');
            allBtn.style.background = '#7b00ff';
            allBtn.style.color = 'white';
            unreadBtn.style.background = '#e0e0e0';
            unreadBtn.style.color = '#666';
        } else {
            unreadBtn.classList.add('active');
            unreadBtn.style.background = '#7b00ff';
            unreadBtn.style.color = 'white';
            allBtn.style.background = '#e0e0e0';
            allBtn.style.color = '#666';
        }
    }

    // Filtrar e renderizar notificações
    renderNotificationsList(window.notificationsData, filterType);
};

// Função para renderizar lista de notificações
function renderNotificationsList(notifications, filterType) {
    const lista = document.getElementById('notificationList');
    if (!lista) return;

    // Filtrar notificações baseado no tipo
    let filteredNotifications = notifications;
    if (filterType === 'unread') {
        filteredNotifications = notifications.filter(n => !n.lida);
    }

    // Criar header HTML
    const headerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">
            <span style="font-weight: bold; color: #7b00ff; font-size: 1.1em; margin-left: 18px; margin-top: 8px; flex:1; text-align:left;">
                <i class="fas fa-bell" style="margin-right: 7px; color: #7b00ff;"></i> Notificações
            </span>
            <div style="display: flex; gap: 8px; margin-right: 10px;">
                <button 
                    id="filterAllBtn" 
                    class="notification-filter-btn ${filterType === 'all' ? 'active' : ''}" 
                    style="background: ${filterType === 'all' ? '#7b00ff' : '#e0e0e0'}; color: ${filterType === 'all' ? 'white' : '#666'}; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.8em; cursor: pointer; font-weight: bold;"
                    onclick="event.stopPropagation(); filtrarNotificacoes('all')"
                    title="Mostrar todas"
                >
                    Todas
                </button>
                <button 
                    id="filterUnreadBtn" 
                    class="notification-filter-btn ${filterType === 'unread' ? 'active' : ''}" 
                    style="background: ${filterType === 'unread' ? '#7b00ff' : '#e0e0e0'}; color: ${filterType === 'unread' ? 'white' : '#666'}; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.8em; cursor: pointer; font-weight: bold;"
                    onclick="event.stopPropagation(); filtrarNotificacoes('unread')"
                    title="Mostrar não lidas"
                >
                    Não lidas
                </button>
            </div>
            <button 
                class="close-notification-panel-btn" 
                style="background-color: rgb(51, 1, 98); border: none; font-size: 1.9em; color: white; cursor: pointer; padding: 2px 11px; border-radius: 100px;"
                title="Fechar notificações"
                onclick="fecharPainelNotificacoes()"
            >
                &times;
            </button>
        </div>
    `;

    if (filteredNotifications.length === 0) {
        const emptyMessage = filterType === 'unread' ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação.';
        lista.innerHTML = headerHTML + `<div style="padding:16px; text-align:center; color:#888;">${emptyMessage}</div>`;
        return;
    }

    // Renderizar notificações filtradas
    const notificationsHTML = filteredNotifications.map(n => `
        <div class="notification-item${n.lida ? '' : ' unread'}" id="notif-${n.id}">
            <div class="avatar"><i class="fas fa-bell"></i></div>
            <div class="info" onclick="abrirPublicacaoNotificacao('${n.publication_id}', '${n.id}')">
                <div class="msg">${n.mensagem}</div>
                <div class="date">${formatDate(n.criada_em)}</div>
            </div>
            <button class="delete-notification-btn" onclick="event.stopPropagation(); apagarNotificacao('${n.id}', ${!n.lida})"
                title="Apagar notificação">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    lista.innerHTML = headerHTML + notificationsHTML;

    // Adicionar contador de notificações filtradas
    const countInfo = document.createElement('div');
    countInfo.style.cssText = `
        padding: 8px 16px; 
        background: #f8f9fa; 
        border-top: 1px solid #e0e0e0; 
        font-size: 0.8em; 
        color: #666; 
        text-align: center;
    `;
    countInfo.textContent = `Mostrando ${filteredNotifications.length} de ${notifications.length} notificações`;
    lista.appendChild(countInfo);
};

// Função para mostrar notificação
function showNotification(message, type = 'info', duration = 3500) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    // Ícones por tipo
    const icons = {
        success: '✔️',
        error: '❌',
        warning: '⚠️',
        info: '#ff6b35'
    };
    // Cores por tipo
    const colors = {
        success: '#34c759',
        error: '#e74c3c',
        warning: '#3471ff',
        info: '#ff6b35'
    };
    const bgColor = colors[type] || colors.info;
    const icon = icons[type] || icons.info;

    // Cria o elemento da notificação
    const notification = document.createElement('div');
    notification.innerHTML = `
        <span style="font-size:1.3em; margin-right:10px; flex-shrink:0;">${icon}</span>
        <span style="flex:1; word-break:break-word;">${message}</span>
    `;
    notification.style.background = bgColor;
    notification.style.color = 'white';
    notification.style.padding = '12px 20px 12px 18px';
    notification.style.borderRadius = '17px';
    notification.style.boxShadow = '0 4px 24px rgba(0,0,0,0.12)';
    notification.style.fontWeight = '600';
    notification.style.fontSize = '1.1rem';
    notification.style.opacity = '0.97';
    notification.style.transition = 'opacity 0.3s';
    notification.style.pointerEvents = 'auto';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.gap = '10px';
    notification.style.margin = '0 auto';
    notification.style.maxWidth = '95vw';
    notification.style.borderLeft = `6px solid white`;
    notification.style.boxSizing = 'border-box';
    notification.style.wordBreak = 'break-word';

    // Ajuste responsivo para mobile
    if (window.innerWidth <= 600) {
        notification.style.fontSize = '1rem';
        notification.style.padding = '10px 10px 10px 12px';
        notification.style.gap = '7px';
        notification.style.maxWidth = '98vw';

    }

    // Botão de fechar
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#5e2d91;';
    closeBtn.style.fontSize = '1.5em';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = '15px';
    closeBtn.style.border = '2px solid #fff';
    closeBtn.style.background = '#fff';
    closeBtn.style.color = '#5e2d91';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.width = '32px';
    closeBtn.style.height = '32px';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.boxShadow = '0 2px 8px rgba(55,22,105,0.12)';
    closeBtn.style.pointerEvents = 'auto';
    closeBtn.onclick = () => {
        notification.style.opacity = '0';
        setTimeout(() => container.removeChild(notification), 300);
    };



    notification.appendChild(closeBtn);

    container.appendChild(notification);

    // Remove após o tempo definido
    setTimeout(() => {
        if (container.contains(notification)) {
            notification.style.opacity = '0';
            setTimeout(() => container.removeChild(notification), 300);
        }
    }, duration);
}
// Configurar event listeners
function setupEventListeners() {
    // Logo - voltar ao topo
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', () => {
            scrollToTop();
        });
    }

    // Botão Home - voltar ao topo e recarregar feed
    const homeButton = document.querySelector('.sidebar-item[data-filter="all"]');
    if (homeButton) {
        homeButton.addEventListener('click', async (e) => {
            e.preventDefault();
            scrollToTop();
            // Aguardar um pouco para a animação de scroll
            setTimeout(async () => {
                try {
                    await loadPublications();
                    clearMediaFilters();
                } catch (error) {
                    console.error('Erro ao carregar publicações:', error);
                }
            }, 300);
        });
    }

    // Formulário de publicação
    if (publicationForm) {
        publicationForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(publicationForm);
            const publicationData = {
                title: formData.get('title'),
                content: formData.get('content'),
                category: formData.get('category')
            };

            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = 'Publicando...';

            try {
                await addPublication(publicationData);
                closeModal();
            } catch (error) {
                console.error('Erro ao criar publicação:', error);
            } finally {
                submitBtn.disabled = false;
                submitBtn.querySelector('span').textContent = 'Publicar';
            }
        });
    }

    // Busca - agora usa handleSearch para pesquisar pessoas e publicações
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleSearch(e.target.value);
        });
    }

    // Filtros de categoria
    const sidebarItems = document.querySelectorAll('.sidebar-item[data-filter]');
    sidebarItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();

            // Remover classe active de todos os itens
            sidebarItems.forEach(i => i.classList.remove('active'));

            // Adicionar classe active ao item clicado
            item.classList.add('active');

            // Limpar filtros de mídia quando uma categoria for selecionada
            clearMediaFilters();

            const filter = item.getAttribute('data-filter');
            currentFilter = filter;

            try {
                if (filter === 'all') {
                    await loadPublications();
                } else {
                    publications = await PublicationsService.getPublicationsByCategory(filter);
                    await renderPublications();
                }
            } catch (error) {
                console.error('Erro ao filtrar publicações:', error);
                showNotification('Erro ao filtrar publicações', 'error');
            }
        });
    });

    // Event listener para o menu Ranking
    const rankingLinks = document.querySelectorAll('a[href="#ranking"]');
    rankingLinks.forEach(rankingLink => {
        rankingLink.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                // Remover classe active de todos os itens do menu
                document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

                // Adicionar classe active ao link de ranking
                rankingLink.classList.add('active');

                await showUsersRanking();
            } catch (error) {
                console.error('Erro ao carregar ranking:', error);
            }
        });
    });

    // Event listener para o menu Home
    const homeLinks = document.querySelectorAll('a[href="#home"]');
    homeLinks.forEach(homeLink => {
        homeLink.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                // Scroll para o topo primeiro
                scrollToTop();

                // Remover classe active de todos os itens do menu
                document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

                // Adicionar classe active ao link de home
                homeLink.classList.add('active');

                // Aguardar um pouco para a animação de scroll
                setTimeout(async () => {
                    try {
                        // Mostrar o elemento de criar publicação quando voltar ao home
                        const createPostElement = document.getElementById('createPost');
                        if (createPostElement && currentUser) {
                            createPostElement.style.display = 'block';
                        }

                        await loadPublications();
                        clearMediaFilters();
                    } catch (error) {
                        console.error('Erro ao carregar publicações:', error);
                    }
                }, 300);
            } catch (error) {
                console.error('Erro no evento home:', error);
            }
        });
    }
    )

    // Formulários de autenticação
    // O erro ocorre porque estava faltando um parêntese de fechamento após o forEach dos homeLinks.
    // Agora, aplicando o parêntese corretamente para fechar o forEach:
    // Remover este fechamento extra, pois o forEach já foi fechado corretamente acima.

    // Formulários de autenticação
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleEditProfile);
    }

    // Menu mobile
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    // Fechar menu ao clicar fora
    document.addEventListener('click', (e) => {
        const nav = document.getElementById('nav');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');

        if (nav && nav.classList.contains('active') &&
            !nav.contains(e.target) &&
            !mobileMenuBtn.contains(e.target)) {
            closeMobileMenu();
        }
    });

    // Fechar modal ao clicar fora
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('publicationModal');
        if (modal && modal.classList.contains('active') &&
            e.target === modal) {
            closeModal();
        }
    });
}

// Função para logout
async function logout() {
    try {
        await supabase.auth.signOut();
        currentUser = null;
        // Encerrar realtime/polling de notificações
        if (notificationsChannel && notificationsChannel.unsubscribe) {
            try { notificationsChannel.unsubscribe(); } catch (_) { }
            notificationsChannel = null;
        }
        stopNotificationsPolling();
        previousUnreadCount = 0;
        if (notificationsCountInterval) {
            clearInterval(notificationsCountInterval);
            notificationsCountInterval = null;
        }
        showLoginState();
        showNotification('Logout realizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro no logout:', error);
        showNotification('Erro no logout', 'error');
    }
}

// Função para visualizar perfil de usuário - agora navega para página de perfil
async function viewUserProfile(userId) {
    if (!userId) return;

    // Navegar para a secção de perfil
    showProfileSection(userId);
}

// Função para carregar estatísticas do usuário
async function loadUserStatistics(userId) {
    try {

        // Primeiro, tentar buscar dados reais do Supabase
        let publicationsCount = 0;
        let userTotalImpulses = 0;
        let contributionPercentage = 0;

        try {
            // Buscar contagem de publicações do usuário
            const { count: pubCount, error: pubError } = await supabase
                .from('publications')
                .select('*', { count: 'exact', head: true })
                .eq('author_id', userId);

            if (pubError) {
                console.error('Erro ao buscar publicações:', pubError);
                throw pubError;
            }

            publicationsCount = pubCount || 0;

            // Buscar todas as publicações do usuário para calcular impulsões
            const { data: userPublications, error: userPubError } = await supabase
                .from('publications')
                .select('impulses_count')
                .eq('author_id', userId);

            if (userPubError) {
                console.error('Erro ao buscar publicações do usuário:', userPubError);
                throw userPubError;
            }


            // Calcular total de impulsões do usuário
            userTotalImpulses = userPublications.reduce((sum, pub) => sum + (pub.impulses_count || 0), 0);


            // Buscar total de impulsões de todas as publicações para calcular percentagem
            const { data: allPublications, error: allPubError } = await supabase
                .from('publications')
                .select('impulses_count, author_id');

            if (allPubError) {
                console.error('Erro ao buscar todas as publicações:', allPubError);
                throw allPubError;
            }


            // Calcular total de impulsões da plataforma
            const totalPlatformImpulses = allPublications.reduce((sum, pub) => sum + (pub.impulses_count || 0), 0);


            // Calcular percentagem de contribuição
            contributionPercentage = totalPlatformImpulses > 0
                ? Math.round((userTotalImpulses / totalPlatformImpulses) * 100)
                : 0;


        } catch (dbError) {

            // Fallback: usar dados de exemplo baseados no ID do usuário
            const exampleData = getExampleUserStats(userId);
            publicationsCount = exampleData.publications;
            userTotalImpulses = exampleData.impulses;
            contributionPercentage = exampleData.contribution;
        }

        // Atualizar interface
        document.getElementById('userPublicationsCount').textContent = publicationsCount;
        document.getElementById('userTotalImpulses').textContent = userTotalImpulses;
        document.getElementById('contributionPercentage').textContent = contributionPercentage + '%';

        // Animar barra de progresso
        setTimeout(() => {
            document.getElementById('contributionFill').style.width = contributionPercentage + '%';
        }, 100);

    } catch (error) {
        console.error('Erro geral ao carregar estatísticas:', error);
        // Definir valores padrão em caso de erro
        document.getElementById('userPublicationsCount').textContent = '0';
        document.getElementById('userTotalImpulses').textContent = '0';
        document.getElementById('contributionPercentage').textContent = '0%';
        document.getElementById('contributionFill').style.width = '0%';
    }
}

// Função para gerar dados de exemplo baseados no ID do usuário
function getExampleUserStats(userId) {
    // Gerar números baseados no ID para consistência
    const hash = userId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);

    const publications = Math.abs(hash % 15) + 1; // 1-15 publicações
    const impulses = Math.abs(hash % 200) + publications * 5; // 5+ impulsões por publicação
    const contribution = Math.min(Math.abs(hash % 25) + 1, 25); // 1-25% contribuição


    return {
        publications,
        impulses,
        contribution
    };
}

// Função para fechar o modal de perfil de usuário
function closeUserProfileModal() {
    document.getElementById('userProfileModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Função para mostrar/esconder perfil do usuário logado
function toggleUserProfile() {
    const userProfileSection = document.getElementById('userProfileSection');
    const loginSection = document.getElementById('loginSection');
    const userProfileSummary = document.getElementById('userProfileSummary');
    const userProfileDetails = document.getElementById('userProfileDetails');

    if (userProfileSection.style.display === 'none') {
        userProfileSection.style.display = 'block';
        loginSection.style.display = 'none';
        // Mostrar perfil detalhado e ocultar resumo
        if (userProfileSummary) userProfileSummary.style.display = 'none';
        if (userProfileDetails) userProfileDetails.style.display = 'block';
    } else {
        userProfileSection.style.display = 'none';
        loginSection.style.display = 'block';
        // Voltar para o resumo na próxima vez
        if (userProfileSummary) userProfileSummary.style.display = 'block';
        if (userProfileDetails) userProfileDetails.style.display = 'none';
    }
}

// Configurar subscriptions em tempo real
function setupRealtimeSubscriptions() {
    // Implementar subscriptions em tempo real se necessário
}

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();

    // Detectar problemas específicos de dispositivos móveis
    detectMobileIssues();
});

// Função para detectar e resolver problemas específicos de mobile
function detectMobileIssues() {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isMobile) {

        // Verificar se o áudio está funcionando
        setTimeout(() => {
            testMobileAudio();
        }, 2000);

        // Adicionar listener para orientação da tela
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                // Reajustar elementos após mudança de orientação
                if (typeof moveProfileBlock === 'function') {
                    moveProfileBlock();
                }
            }, 300);
        });

        // Verificar se o dispositivo suporta notificações push
        if ('Notification' in window && Notification.permission === 'default') {
            // Solicitar permissão para notificações push (opcional)
            setTimeout(() => {
                if (confirm('Deseja receber notificações push para melhor experiência em mobile?')) {
                    Notification.requestPermission();
                }
            }, 5000);
        }
    }
}

// Testar áudio em dispositivos móveis
function testMobileAudio() {
    try {
        const testAudio = new Audio();
        testAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
        testAudio.volume = 0.1;

        const playPromise = testAudio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    testAudio.pause();
                    testAudio.currentTime = 0;
                })
                .catch((error) => {
                    // Aplicar fallbacks específicos para mobile
                    applyMobileAudioFallbacks();
                });
        }
    } catch (error) {
        applyMobileAudioFallbacks();
    }
}

// Aplicar fallbacks para dispositivos móveis sem áudio
function applyMobileAudioFallbacks() {
    // Substituir função de som por notificação visual
    window.playNotificationSound = function () {
        // Removido: showMobileNotificationFallback();
    };

}

// Função de inicialização
async function initializeApp() {
    await checkAuthStatus();
    await loadPublications();
    setupEventListeners();
    setupNotificationListeners(); // Adicionar listeners de notificação
    setupRealtimeSubscriptions();
    unlockAudioOnFirstInteraction();

    // Inicializar PWA
    initializePWA();
}

// Upload de avatar para Storage (bucket avatars) e retorna URL pública
async function uploadAvatarToStorage(file, userId) {
    const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`;
    const filePath = `${userId}/${fileName}`;
    const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
    return pub.publicUrl;
}

// Pré-carrega avatar_url dos autores das publicações para cache em memória
async function preloadAuthorsAvatars(publicationsList) {
    try {
        const ids = Array.from(new Set((publicationsList || []).map(p => p.author_id).filter(Boolean)));
        if (!ids.length) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', ids);
        if (error) return;
        (data || []).forEach(row => {
            if (row.avatar_url) {
                try { window.userIdToAvatarUrl[row.id] = row.avatar_url; } catch (_) { }
            }
        });
        // Atualiza UI silenciosamente
        try { await renderPublications(); } catch (_) { }
    } catch (_) { }
}

// Verificar status de autenticação
async function checkAuthStatus() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await loadUserProfile(user.id);
        } else {
            showLoginState();
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        showLoginState();
    }
}

// Carregar perfil do usuário
async function loadUserProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Erro ao carregar perfil:', error);
            return;
        }

        if (data) {
            currentUser = { ...data, id: userId };
            if (data.avatar_url) {
                try { window.userIdToAvatarUrl[userId] = data.avatar_url; } catch (_) { }
            }
            showLoggedInState();
            updateUserInterface();
            setupRealtimeNotifications(); // Chame aqui, pois já tem o currentUser
        } else {
            // Criar perfil básico se não existir
            await createBasicProfile(userId);
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
}

// Criar perfil básico
async function createBasicProfile(userId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('profiles')
            .insert([{
                id: userId,
                name: user.email.split('@')[0],
                email: user.email,
                turma: 'Não definida',
                description: 'Sem descrição',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        currentUser = { ...data, id: userId };
        if (data && data.avatar_url) {
            try { window.userIdToAvatarUrl[userId] = data.avatar_url; } catch (_) { }
        }
        showLoggedInState();
        updateUserInterface();
    } catch (error) {
        console.error('Erro ao criar perfil:', error);
    }
}

// Mostrar estado de login
function showLoginState() {
    // New header elements
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const headerProfileBtn = document.getElementById('headerProfileBtn');
    if (headerLoginBtn) headerLoginBtn.style.display = 'flex';
    if (headerProfileBtn) headerProfileBtn.style.display = 'none';

    // Mobile menu elements
    const mobileProfileBtn = document.getElementById('mobileProfileBtn');
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    if (mobileProfileBtn) mobileProfileBtn.classList.add('hidden');
    if (mobileLoginBtn) mobileLoginBtn.classList.remove('hidden');

    // Legacy elements (if they exist)
    const authButtons = document.getElementById('authButtons');
    const userProfileHeader = document.getElementById('userProfileHeader');
    const userProfileSection = document.getElementById('userProfileSection');
    const loginSection = document.getElementById('loginSection');
    const createPost = document.getElementById('createPost');

    if (authButtons) authButtons.style.display = 'flex';
    if (userProfileHeader) userProfileHeader.style.display = 'none';
    if (userProfileSection) userProfileSection.style.display = 'none';
    if (loginSection) loginSection.style.display = 'block';
    if (createPost) createPost.style.display = 'none';
}

// Mostrar estado logado
function showLoggedInState() {
    // New header elements
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const headerProfileBtn = document.getElementById('headerProfileBtn');
    if (headerLoginBtn) headerLoginBtn.style.display = 'none';
    if (headerProfileBtn) headerProfileBtn.style.display = 'flex';

    // Mobile menu elements
    const mobileProfileBtn = document.getElementById('mobileProfileBtn');
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    if (mobileProfileBtn) mobileProfileBtn.classList.remove('hidden');
    if (mobileLoginBtn) mobileLoginBtn.classList.add('hidden');

    // Legacy elements (if they exist)
    const authButtons = document.getElementById('authButtons');
    const userProfileHeader = document.getElementById('userProfileHeader');
    const userProfileSection = document.getElementById('userProfileSection');
    const loginSection = document.getElementById('loginSection');
    const createPost = document.getElementById('createPost');

    if (authButtons) authButtons.style.display = 'none';
    if (userProfileHeader) userProfileHeader.style.display = 'flex';
    if (userProfileSection) userProfileSection.style.display = 'block';
    if (loginSection) loginSection.style.display = 'none';
    if (createPost) createPost.style.display = 'block';

    atualizarContadorNotificacoes();
}

// Atualizar interface do usuário
function updateUserInterface() {
    if (!currentUser) return;

    // Header
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userAvatarSmall').innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);

    // Sidebar
    document.getElementById('userFullName').textContent = currentUser.name;
    document.getElementById('userTurma').textContent = `Turma: ${currentUser.turma}`;
    document.getElementById('userDescription').textContent = currentUser.description || 'Sem descrição';
    document.getElementById('userAvatarLarge').innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);

    // Create post
    document.getElementById('createPostAvatar').innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);
}

// Função para abrir modal de editar perfil
function openEditProfileModal() {
    if (!currentUser) return;
    document.getElementById('editProfileName').value = currentUser.name;
    document.getElementById('editProfileTurma').value = currentUser.turma || '';
    document.getElementById('editProfileShortDescription').value = currentUser.short_description || '';
    document.getElementById('editProfileDescription').value = currentUser.description || '';
    editProfileModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Função para fechar modal de editar perfil
function closeEditProfileModal() {
    editProfileModal.classList.remove('active');
    document.body.style.overflow = 'auto';
    editProfileForm.reset();
}

// Função para editar perfil
async function handleEditProfile(e) {
    e.preventDefault();
    const formData = new FormData(editProfileForm);
    const name = formData.get('name');
    const turma = formData.get('turma');
    const short_description = formData.get('short_description');
    const description = formData.get('description');
    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                name,
                turma,
                short_description,
                description,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
        if (error) throw error;
        currentUser = { ...currentUser, name, turma, short_description, description };
        updateUserInterface();
        closeEditProfileModal();
        showNotification('Perfil atualizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao editar perfil:', error);
        showNotification('Erro ao editar perfil', 'error');
    }
}

// Alternar exibição do perfil (resumido/expandido)
function toggleUserProfileDetails() {
    const section = document.getElementById('userProfileSection');
    section.classList.toggle('expanded');
}

// Atualizar campos do perfil resumido e expandido
function updateUserProfileViews() {
    if (!currentUser) return;

    // Resumido - com verificação de null
    const userFullNameSummary = document.getElementById('userFullNameSummary');
    const userShortDescription = document.getElementById('userShortDescription');
    const userTurmaSummary = document.getElementById('userTurmaSummary');
    const userAvatarLargeSummary = document.getElementById('userAvatarLargeSummary');

    if (userFullNameSummary) userFullNameSummary.textContent = currentUser.name;
    if (userShortDescription) userShortDescription.textContent = currentUser.short_description || 'Profissão ou área';
    if (userTurmaSummary) userTurmaSummary.textContent = `Turma: ${currentUser.turma}`;
    if (userAvatarLargeSummary) userAvatarLargeSummary.innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);

    // Expandido - com verificação de null
    const userFullNameDetails = document.getElementById('userFullNameDetails');
    const userTurmaDetails = document.getElementById('userTurmaDetails');
    const userDescriptionDetails = document.getElementById('userDescriptionDetails');
    const userAvatarLargeDetails = document.getElementById('userAvatarLargeDetails');

    if (userFullNameDetails) userFullNameDetails.textContent = currentUser.name;
    if (userTurmaDetails) userTurmaDetails.textContent = `Turma: ${currentUser.turma}`;
    if (userDescriptionDetails) userDescriptionDetails.textContent = currentUser.description || 'Sem descrição';
    if (userAvatarLargeDetails) userAvatarLargeDetails.innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);
}

// Sobrescrever updateUserInterface para chamar updateUserProfileViews
const originalUpdateUserInterface = updateUserInterface;
updateUserInterface = function () {
    if (!currentUser) return;

    // New header avatar
    const headerAvatar = document.getElementById('headerAvatar');
    if (headerAvatar) {
        headerAvatar.innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);
    }

    // Legacy header elements (if they exist)
    const userName = document.getElementById('userName');
    const userAvatarSmall = document.getElementById('userAvatarSmall');
    if (userName) userName.textContent = currentUser.name;
    if (userAvatarSmall) userAvatarSmall.innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);

    // Sidebar
    updateUserProfileViews();

    // Create post
    const createPostAvatar = document.getElementById('createPostAvatar');
    if (createPostAvatar) {
        createPostAvatar.innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);
    }
};

// Função para garantir que todos os nomes e avatares das publicações recebam o evento de clique
function setupUserProfileClickEvents() {
    // Delegação de eventos via container principal
    const grid = document.getElementById('publicationsGrid');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
        const target = e.target.closest('.publication-avatar, .publication-author');
        if (!target) return;
        const userId = target.getAttribute('data-author-id');
        if (userId) {
            // Remover preventDefault para evitar erro com passive listener
            viewUserProfile(userId);
        }
    }, { passive: true });
}

// Garantir que a função esteja disponível globalmente
window.viewUserProfile = viewUserProfile;
window.testNotification = testNotification;

// Event listeners para upload de mídia
document.addEventListener('DOMContentLoaded', function () {
    // Event listener para upload de foto
    const photoUpload = document.getElementById('photoUpload');
    if (photoUpload) {
        photoUpload.addEventListener('change', handlePhotoUpload);
    }

    // Event listener para upload de vídeo
    const videoUpload = document.getElementById('videoUpload');
    if (videoUpload) {
        videoUpload.addEventListener('change', handleVideoUpload);
    }

    // Avatar pelo Storage (salvo no banco)
    const avatarInput = document.getElementById('editProfileAvatar');
    if (avatarInput) {
        avatarInput.addEventListener('change', async function (e) {
            const file = e.target.files && e.target.files[0];
            if (!file || !currentUser) return;
            if (!file.type.startsWith('image/')) {
                showNotification('Selecione uma imagem válida para o avatar.', 'warning');
                return;
            }
            // Limitar tamanho (até 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showNotification('A imagem deve ter no máximo 5MB.', 'warning');
                return;
            }

            // Mostrar preview da foto selecionada
            const reader = new FileReader();
            reader.onload = function (event) {
                // Mostrar preview em todos os avatares do usuário
                const previewUrl = event.target.result;
                try {
                    const avatarElements = [
                        document.getElementById('userAvatarSmall'),
                        document.getElementById('userAvatarLarge'),
                        document.getElementById('userAvatarLargeSummary'),
                        document.getElementById('userAvatarLargeDetails'),
                        document.getElementById('createPostAvatar')
                    ];
                    avatarElements.forEach(el => {
                        if (el) {
                            el.innerHTML = `<img src="${previewUrl}" alt="Preview" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; opacity: 0.7; border: 3px dashed #7b00ff;">`;
                        }
                    });
                } catch (_) { }
            };
            reader.readAsDataURL(file);

            // Mostrar indicador de carregamento
            showNotification('📷 Foto selecionada! Aguarde o upload...', 'info');

            try {
                const publicUrl = await uploadAvatarToStorage(file, currentUser.id);
                const { error: updErr } = await supabase
                    .from('profiles')
                    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
                    .eq('id', currentUser.id);
                if (updErr) throw updErr;
                try { window.userIdToAvatarUrl[currentUser.id] = publicUrl; } catch (_) { }
                try {
                    document.getElementById('userAvatarSmall').innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);
                    document.getElementById('userAvatarLarge').innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);
                    document.getElementById('userAvatarLargeSummary').innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);
                    document.getElementById('userAvatarLargeDetails').innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);
                    document.getElementById('createPostAvatar').innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);
                } catch (_) { }
                document.querySelectorAll(`.publication-card[data-id] .publication-header .publication-avatar`).forEach(el => {
                    const nameEl = el.parentElement?.querySelector('.publication-author');
                    if (nameEl && nameEl.textContent === currentUser.name) {
                        el.innerHTML = renderAvatarHTML(currentUser.id, currentUser.name);
                    }
                });
                showNotification('✅ Avatar atualizado com sucesso!', 'success');
            } catch (err) {
                console.error('Erro ao atualizar avatar:', err);
                showNotification('Erro ao atualizar avatar: ' + (err.message || ''), 'error');
            }
        });
    }
});

// Função para lidar com upload de foto
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecione apenas arquivos de imagem.', 'warning');
        event.target.value = '';
        return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('A foto deve ter no máximo 5MB.', 'warning');
        event.target.value = '';
        return;
    }

    selectedPhoto = file;
    showPhotoPreview(file);
}

// Função para lidar com upload de vídeo
function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('video/')) {
        showNotification('Por favor, selecione apenas arquivos de vídeo.', 'warning');
        event.target.value = '';
        return;
    }

    // Validar tamanho (máximo 50MB)
    if (file.size > 50 * 1024 * 1024) {
        showNotification('O vídeo deve ter no máximo 50MB.', 'warning');
        event.target.value = '';
        return;
    }

    // Validar duração do vídeo
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = function () {
        const duration = video.duration;
        if (duration > 35) {
            showNotification('O vídeo deve ter no máximo 35 segundos.', 'warning');
            event.target.value = '';
            return;
        }

        selectedVideo = file;
        showVideoPreview(file, duration);
    };

    video.src = URL.createObjectURL(file);
}

// Função para mostrar preview da foto
function showPhotoPreview(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const photoPreview = document.getElementById('photoPreview');
        const photoPreviewImg = document.getElementById('photoPreviewImg');

        photoPreviewImg.src = e.target.result;
        photoPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// Função para mostrar preview do vídeo
function showVideoPreview(file, duration) {
    const videoPreview = document.getElementById('videoPreview');
    const videoPreviewPlayer = document.getElementById('videoPreviewPlayer');
    const videoPreviewSrc = document.getElementById('videoPreviewSrc');
    const videoDuration = document.getElementById('videoDuration');

    const videoUrl = URL.createObjectURL(file);
    videoPreviewSrc.src = videoUrl;
    videoPreviewPlayer.load();

    videoDuration.textContent = `Duração: ${Math.round(duration)}s`;
    videoPreview.style.display = 'block';
}

// Função para remover foto
function removePhoto() {
    selectedPhoto = null;
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoUpload').value = '';
}

// Função para remover vídeo
function removeVideo() {
    selectedVideo = null;
    document.getElementById('videoPreview').style.display = 'none';
    document.getElementById('videoUpload').value = '';
}

// Função para fazer upload de arquivo para o Supabase Storage
async function uploadFileToStorage(file, folder) {
    try {
        const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`;
        const filePath = `${folder}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('publications-media')
            .upload(filePath, file);

        if (error) {
            console.error('Erro detalhado do upload:', error);
            showNotification('Erro detalhado do upload: ' + (error.message || JSON.stringify(error)), 'error');
            throw error;
        }

        // Obter URL pública do arquivo
        const { data: { publicUrl } } = supabase.storage
            .from('publications-media')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        throw error;
    }
}

// sanitizeFileName agora está em src/js/app-utils.js

async function shareOnWhatsApp(authorId) {
    // Verificar se o usuário está logado
    if (!currentUser) {
        showNotification('Você precisa estar logado para iniciar uma conversa.', 'warning');
        return;
    }

    // Verificar se não está tentando conversar consigo mesmo
    if (authorId === currentUser.id) {
        showNotification('Você não pode conversar consigo mesmo.', 'warning');
        return;
    }

    // Usar o novo sistema de conversas
    openPrivateChat(authorId);
}

// Criar/abrir conversa privada e navegar para o chat
async function openPrivateChat(otherUserId) {
    try {
        if (!currentUser) {
            showNotification('Você precisa estar logado para conversar.', 'warning');
            return;
        }
        if (!otherUserId || otherUserId === currentUser.id) return;

        // Verifica se já existe conversa
        const { data: existing, error: findError } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${currentUser.id})`)
            .maybeSingle();

        if (findError && findError.code !== 'PGRST116') {
            console.error('Erro ao buscar conversa:', findError);
        }

        let conversationId = existing?.id;
        if (!conversationId) {
            const { data: newConv, error: createError } = await supabase
                .from('conversations')
                .insert({ user1_id: currentUser.id, user2_id: otherUserId, updated_at: new Date().toISOString() })
                .select('id')
                .single();
            if (createError) {
                console.error('Erro ao criar conversa:', createError);
                showNotification('Não foi possível iniciar a conversa.', 'error');
                return;
            }
            conversationId = newConv.id;
        }

        // Redireciona para a tela de chat e já abre o usuário
        window.location.href = `src/html/chatBrio.html?open=${encodeURIComponent(otherUserId)}`;
    } catch (e) {
        console.error('Erro no openPrivateChat:', e);
        showNotification('Erro ao abrir conversa.', 'error');
    }
}

function toggleQuickMenuMore() {
    const more = document.getElementById('quickMenuMore');
    const btn = document.getElementById('quickMenuShowMore');
    if (more.style.display === 'none' || more.style.display === '') {
        more.style.display = 'block';
        btn.textContent = 'Ver menos';
    } else {
        more.style.display = 'none';
        btn.textContent = 'Ver mais';
    }
}

function quickMenuSelectChange(select) {
    const value = select.value;
    // Simula clique no filtro
    const sidebarItems = document.querySelectorAll('.sidebar-item[data-filter]');
    sidebarItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-filter') === value) {
            item.classList.add('active');
        }
    });
    // Filtra publicações
    if (value === 'all') {
        loadPublications();
    } else {
        PublicationsService.getPublicationsByCategory(value).then(result => {
            publications = result;
            renderPublications();
        });
    }
}

// Script para mover o bloco de perfil entre sidebar e menu conforme o tamanho da tela
function moveProfileBlock() {
    const profile = document.getElementById('userProfileSection');
    const sidebar = document.querySelector('.left-sidebar .sidebar-section');
    const profileInMenu = document.getElementById('profileInMenu');

    if (!profile || !sidebar || !profileInMenu) return;

    if (window.innerWidth <= 900) { // mobile
        if (profile.parentNode !== profileInMenu) {
            profileInMenu.appendChild(profile);
            profile.style.display = 'block';
        }
    } else { // desktop
        if (profile.parentNode !== sidebar) {
            sidebar.appendChild(profile);
            profile.style.display = 'block';
        }
    }
}
window.addEventListener('DOMContentLoaded', moveProfileBlock);
window.addEventListener('resize', moveProfileBlock);

// limitarDescricao e aplicarLimiteDescricaoPerfil agora estão em src/js/app-utils.js

// Chama a função ao carregar a página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarLimiteDescricaoPerfil);
} else {
    aplicarLimiteDescricaoPerfil();
}

// Função para criar notificações para todos os usuários (menos o autor)
async function criarNotificacoesNovaPublicacao(publicacao) {
    try {
        // Buscar todos os usuários, exceto o autor
        const { data: usuarios, error: errorUsuarios } = await supabase
            .from('profiles')
            .select('id, name')
            .neq('id', publicacao.author_id);

        if (errorUsuarios) {
            console.error('Erro ao buscar usuários para notificação:', errorUsuarios);
            return;
        }

        // Montar notificações
        const notificacoes = usuarios.map(usuario => ({
            user_id: usuario.id,
            publication_id: publicacao.id,
            categoria: publicacao.category,
            mensagem: `Na categoria ${getCategoryName(publicacao.category)}, ${publicacao.author} publicou: "${publicacao.title}"`,
            lida: false
        }));

        // Inserir notificações
        if (notificacoes.length > 0) {
            const { error: errorNotificacoes } = await supabase
                .from('notifications')
                .insert(notificacoes);

            if (errorNotificacoes) {
                console.error('Erro ao criar notificações:', errorNotificacoes);
            }
        }
    } catch (error) {
        console.error('Erro geral ao criar notificações:', error);
    }
}

async function carregarNotificacoesNaoLidas() {
    if (!currentUser) return [];
    const { data, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('lida', false);
    if (error && error.code !== 'PGRST116') {
        console.error('Erro ao contar notificações:', error);
        return [];
    }
    // Como usamos head:true, data é nulo; vamos buscar apenas IDs se precisarmos da lista
    return [];
}

async function getUnreadNotificationsCount() {
    if (!currentUser) return 0;
    const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('lida', false);
    if (error && error.code !== 'PGRST116') {
        console.error('Erro ao contar notificações:', error);
        return 0;
    }
    return count || 0;
}

async function atualizarContadorNotificacoes() {
    if (!currentUser) return;
    if (isFetchingNotificationsCount) return; // evita corrida
    isFetchingNotificationsCount = true;

    try {
        const count = await getUnreadNotificationsCount();
        isFetchingNotificationsCount = false;
        unreadNotificationsCount = count;
        previousUnreadCount = count;

        // Usar a função updateNotificationCounters que atualiza tanto desktop quanto mobile
        updateNotificationCounters(unreadNotificationsCount);

        // Para dispositivos móveis, adicionar efeito visual extra
        if (unreadNotificationsCount > 0 && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
            const notificationCount = document.getElementById('notificationCount');
            const mobileNotificationCount = document.getElementById('mobileNotificationCount');

            // Adicionar animação para ambos os contadores
            [notificationCount, mobileNotificationCount].forEach(counter => {
                if (counter) {
                    counter.style.animation = 'none';
                    counter.offsetHeight; // Trigger reflow
                    counter.style.animation = 'notificationPulse 0.6s ease-in-out';
                }
            });

            // Adicionar CSS da animação se não existir
            if (!document.getElementById('notification-pulse-style')) {
                const style = document.createElement('style');
                style.id = 'notification-pulse-style';
                style.textContent = `
                    @keyframes notificationPulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.3); background-color: #ff4444; }
                        100% { transform: scale(1); }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar contador de notificações:', error);
        isFetchingNotificationsCount = false;

        // Para dispositivos móveis, mostrar erro visual
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            showNotification('Erro ao carregar notificações', 'error');
        }
    }
}

// Event listener para notificações será adicionado quando o elemento existir
document.addEventListener('DOMContentLoaded', function () {
    // Event listener para notificações mobile
    const notificationBellMobile = document.getElementById('mobileNotificationBell');
    if (notificationBellMobile) {
        notificationBellMobile.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
            await mostrarPainelNotificacoes();
        });
    }

    // Event listener para notificações PC
    const notificationBellPC = document.getElementById('notificationBell');
    if (notificationBellPC) {
        notificationBellPC.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
            await mostrarPainelNotificacoes();
        });
    }
});

// Adicionar event listeners adicionais para garantir que funcione no desktop
function setupNotificationListeners() {
    // Event listener usando delegação de eventos para garantir que funcione
    document.addEventListener('click', async function (e) {
        // Verificar se o clique foi no botão de notificação desktop
        if (e.target.closest('#notificationBell')) {
            e.preventDefault();
            e.stopPropagation();
            await mostrarPainelNotificacoes();
            return;
        }

        // Verificar se o clique foi no botão de notificação mobile
        if (e.target.closest('#mobileNotificationBell')) {
            e.preventDefault();
            e.stopPropagation();
            await mostrarPainelNotificacoes();
            return;
        }
    });

    // Garantir que os botões sejam clicáveis após o DOM estar carregado
    setTimeout(() => {
        const notificationBellPC = document.getElementById('notificationBell');
        const notificationBellMobile = document.getElementById('mobileNotificationBell');

        if (notificationBellPC) {
            // Garantir que o botão desktop seja clicável
            notificationBellPC.style.cursor = 'pointer';
            notificationBellPC.style.pointerEvents = 'auto';
            notificationBellPC.style.zIndex = '1000';
            notificationBellPC.style.position = 'relative';
        }

        if (notificationBellMobile) {
            // Garantir que o botão mobile seja clicável
            notificationBellMobile.style.cursor = 'pointer';
            notificationBellMobile.style.pointerEvents = 'auto';
        }
    }, 500);
}

async function mostrarPainelNotificacoes() {
    if (!currentUser) return;

    const painel = document.getElementById('notificationPanel');
    const overlay = document.getElementById('notificationOverlay');
    const isOpen = painel.style.display === 'block';

    if (isOpen) {
        // Fechar painel
        painel.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    } else {
        // Abrir painel
        painel.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
    }

    if (painel.style.display === 'block') {
        // Adiciona o botão de fechar e filtros no topo do painel de notificações
        let headerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">
                <span style="font-weight: bold; color: #7b00ff; font-size: 1.1em; margin-left: 18px; margin-top: 8px; flex:1; text-align:left;">
                    <i class="fas fa-bell" style="margin-right: 7px; color: #7b00ff;"></i> Notificações
                </span>
                <div style="display: flex; gap: 8px; margin-right: 10px;">
                    <button 
                        id="filterAllBtn" 
                        class="notification-filter-btn active" 
                        style="background: #7b00ff; color: white; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.8em; cursor: pointer; font-weight: bold;"
                        onclick="event.stopPropagation(); filtrarNotificacoes('all')"
                        title="Mostrar todas"
                    >
                        Todas
                    </button>
                    <button 
                        id="filterUnreadBtn" 
                        class="notification-filter-btn" 
                        style="background: #e0e0e0; color: #666; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.8em; cursor: pointer; font-weight: bold;"
                        onclick="event.stopPropagation(); filtrarNotificacoes('unread')"
                        title="Mostrar não lidas"
                    >
                        Não lidas
                    </button>
                </div>
                <button 
                    class="close-notification-panel-btn" 
                    style="background-color: rgb(51, 1, 98); border: none; font-size: 1.9em; color: white; cursor: pointer; padding: 2px 11px; border-radius: 100px;"
                    title="Fechar notificações"
                    onclick="fecharPainelNotificacoes()"
                >
                    &times;
                </button>
            </div>
        `;

        // Carregar todas as notificações primeiro
        const { data, error } = await supabase
            .from('notifications')
            .select('*, publications(title, author, category)')
            .eq('user_id', currentUser.id)
            .order('criada_em', { ascending: false })
            .limit(50);

        if (error) {
            lista.innerHTML = headerHTML + '<div style="padding:16px;">Erro ao carregar notificações.</div>';
            return;
        }

        if (!data || data.length === 0) {
            lista.innerHTML = headerHTML + '<div style="padding:16px;">Nenhuma notificação.</div>';
            return;
        }

        // Armazenar dados das notificações para filtros
        window.notificationsData = data;

        // Mostrar todas as notificações por padrão
        renderNotificationsList(data, 'all');
    }
}

// Função global para fechar o painel de notificações
window.fecharPainelNotificacoes = function () {
    const painel = document.getElementById('notificationPanel');
    const overlay = document.getElementById('notificationOverlay');
    if (painel) painel.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
};

// Fecha o painel ao clicar fora
document.addEventListener('click', function (e) {
    const painel = document.getElementById('notificationPanel');
    const overlay = document.getElementById('notificationOverlay');
    const bell = document.getElementById('mobileNotificationBell');

    // Não fechar se clicar nos botões de filtro
    if (e.target.closest('.notification-filter-btn')) {
        return;
    }

    if (painel && painel.style.display === 'block' && !painel.contains(e.target) && bell && !bell.contains(e.target)) {
        painel.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    }
});

window.abrirPublicacaoNotificacao = async function (publicationId, notificationId) {
    // Marcar como lida
    await supabase
        .from('notifications')
        .update({ lida: true })
        .eq('id', notificationId);

    // Atualizar dados locais
    if (window.notificationsData) {
        const notification = window.notificationsData.find(n => n.id === notificationId);
        if (notification) {
            notification.lida = true;
        }
    }

    // Decremento otimista do contador
    if (unreadNotificationsCount > 0) {
        unreadNotificationsCount -= 1;
        // Usar a função updateNotificationCounters para atualizar ambos os contadores
        updateNotificationCounters(unreadNotificationsCount);
    }

    // Fechar painel e overlay
    document.getElementById('notificationPanel').style.display = 'none';
    var overlay = document.getElementById('notificationOverlay');
    if (overlay) overlay.style.display = 'none';

    // Rolagem até a publicação (ou redirecionamento)
    const pubEl = document.querySelector(`[data-id="${publicationId}"]`);
    if (pubEl) {
        pubEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pubEl.classList.add('highlight');
        setTimeout(() => pubEl.classList.remove('highlight'), 2000);
    } else {
        // Se não estiver na tela, recarrega as publicações e tenta de novo
        await loadPublications();
        setTimeout(() => {
            const pubEl2 = document.querySelector(`[data-id="${publicationId}"]`);
            if (pubEl2) {
                pubEl2.scrollIntoView({ behavior: 'smooth', block: 'center' });
                pubEl2.classList.add('highlight');
                setTimeout(() => pubEl2.classList.remove('highlight'), 2000);
            }
        }, 500);
    }
    // Atualiza contador
    atualizarContadorNotificacoes();
};

window.apagarNotificacao = async function (notificationId, wasUnread = false) {
    // if (!confirm('Deseja apagar esta notificação?')) return;
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

    if (error) {
        showNotification('Erro ao apagar notificação: ' + error.message, 'error');
        return;
    }

    // Atualizar dados locais
    if (window.notificationsData) {
        window.notificationsData = window.notificationsData.filter(n => n.id !== notificationId);
    }

    // Remove do DOM imediatamente
    const el = document.getElementById('notif-' + notificationId);
    if (el) el.remove();

    // Atualiza o contador (otimista se era não lida)
    if (wasUnread && unreadNotificationsCount > 0) {
        unreadNotificationsCount -= 1;
        // Usar a função updateNotificationCounters para atualizar ambos os contadores
        updateNotificationCounters(unreadNotificationsCount);
    } else {
        atualizarContadorNotificacoes();
    }
};

// Atualiza contador quando a aba volta a ficar visível
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            atualizarContadorNotificacoes();
        }
    });
}

async function criarNotificacaoLike(publicationId, userWhoLiked) {
    // Buscar dados da publicação
    const { data: pub, error } = await supabase
        .from('publications')
        .select('id, title, author_id, author')
        .eq('id', publicationId)
        .single();

    if (error || !pub) return;

    // Não notificar se o autor curtir a própria publicação
    if (pub.author_id === userWhoLiked.id) return;

    // Mensagem personalizada
    const mensagem = `${userWhoLiked.name} curtiu sua publicação: "${pub.title}"`;

    // Criar notificação
    await supabase
        .from('notifications')
        .insert([{
            user_id: pub.author_id,
            publication_id: pub.id,
            categoria: null,
            mensagem,
            lida: false
        }]);
}

// Realtime para publicações
function setupRealtimePublications() {
    if (!supabase || !supabase.channel) return;

    supabase.channel('publications-realtime')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'publications' },
            (payload) => {
                // Adiciona a nova publicação ao topo do feed
                publications.unshift(payload.new);
                renderPublications();
            }
        )
        .subscribe();
}

// Realtime para notificações (apenas após saber o currentUser)
function setupRealtimeNotifications() {
    if (!supabase || !supabase.channel || !currentUser) return;

    // Limpar canal anterior se houver
    if (notificationsChannel && notificationsChannel.unsubscribe) {
        try { notificationsChannel.unsubscribe(); } catch (_) { }
    }

    // Habilitar contador imediato ao entrar
    atualizarContadorNotificacoes();

    // Para dispositivos móveis, usar polling mais frequente como fallback
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const pollingInterval = isMobile ? 15000 : 20000; // 15s para mobile, 20s para desktop

    // Iniciar verificação periódica leve para robustez
    if (notificationsCountInterval) clearInterval(notificationsCountInterval);
    notificationsCountInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
            atualizarContadorNotificacoes();
        }
    }, pollingInterval);

    // Criar canal de realtime por usuário
    notificationsChannel = supabase
        .channel(`notifications-realtime-${currentUser.id}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` },
            (payload) => {
                // Atualização imediata do contador sem aguardar nova consulta
                unreadNotificationsCount = Math.max((unreadNotificationsCount || 0) + 1, 1);
                // Usar a função updateNotificationCounters para atualizar ambos os contadores
                updateNotificationCounters(unreadNotificationsCount);

                // Tocar som e animar sino
                playNotificationSound();
                animateBell();

                // Para dispositivos móveis, mostrar notificação visual extra
                if (isMobile) {
                    // Removido: showMobileNotificationFallback();
                }

                // Atualiza com o valor real em background
                atualizarContadorNotificacoes();
            }
        )
        .subscribe(status => {
            // Fallback: se não conectar, ativa polling leve
            if (status !== 'SUBSCRIBED') {
                startNotificationsPolling();
            } else {
                stopNotificationsPolling();
            }
        });
}

function startNotificationsPolling() {
    stopNotificationsPolling();

    // Para dispositivos móveis, usar polling mais frequente
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const pollingTime = isMobile ? 8000 : 10000; // 8s para mobile, 10s para desktop

    // Poll para buscar não lidas quando realtime indisponível
    notificationsPollInterval = setInterval(async () => {
        if (!currentUser) return;

        try {
            const count = await getUnreadNotificationsCount();

            // dispara animação/som se houver novas não lidas
            if (count > previousUnreadCount) {
                playNotificationSound();
                animateBell();

                // Para dispositivos móveis, mostrar notificação visual extra
                if (isMobile) {
                    // Removido: showMobileNotificationFallback();
                }
            }

            previousUnreadCount = count;

            // Atualiza badge rapidamente sem nova query
            unreadNotificationsCount = count;
            // Usar a função updateNotificationCounters para atualizar ambos os contadores
            updateNotificationCounters(unreadNotificationsCount);

            // Para dispositivos móveis, adicionar efeito visual
            if (isMobile && unreadNotificationsCount > 0) {
                const notificationCount = document.getElementById('notificationCount');
                const mobileNotificationCount = document.getElementById('mobileNotificationCount');

                [notificationCount, mobileNotificationCount].forEach(counter => {
                    if (counter) {
                        counter.style.animation = 'notificationPulse 0.6s ease-in-out';
                    }
                });
            }
        } catch (error) {
            console.error('Erro no polling de notificações:', error);

            // Para dispositivos móveis, mostrar erro visual
            if (isMobile) {
                const notificationCount = document.getElementById('notificationCount');
                if (notificationCount) {
                    notificationCount.style.background = '#ff4444';
                    notificationCount.title = 'Erro ao carregar notificações';

                    setTimeout(() => {
                        if (notificationCount) {
                            notificationCount.style.background = '';
                            notificationCount.title = '';
                        }
                    }, 3000);
                }
            }
        }
    }, pollingTime);
}

function stopNotificationsPolling() {
    if (notificationsPollInterval) {
        clearInterval(notificationsPollInterval);
        notificationsPollInterval = null;
    }
    if (notificationsCountInterval) {
        clearInterval(notificationsCountInterval);
        notificationsCountInterval = null;
    }
}

function playNotificationSound() {
    if (!audioEnabled) {
        audioEnabled = true; // Habilita o áudio na primeira tentativa
    }

    try {
        const audioPath = 'src/js/notification.mp3';
        const fallbackPath = 'src/js/notification.mp3.wav';

        const audio = new Audio();
        audio.src = audio.canPlayType('audio/mpeg') ? audioPath : fallbackPath;

        // Configurar volume e outras propriedades
        audio.volume = 0.7;
        audio.preload = 'auto';

        // Para dispositivos móveis, tentar configurações específicas
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            audio.volume = 1.0; // Volume máximo em mobile
            audio.muted = false;
        }

        // Tentar tocar o som
        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    // Som tocado com sucesso
                })
                .catch((error) => {

                    // Para dispositivos móveis, tentar estratégias alternativas
                    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                        // Tentar com configurações diferentes
                        audio.volume = 0.5;
                        audio.play().catch(() => {
                            // Última tentativa com caminho alternativo
                            audio.src = fallbackPath;
                            audio.play().catch(() => {
                                // Fallback visual para mobile
                                // Removido: showMobileNotificationFallback();
                            });
                        });
                    } else {
                        // Tentar caminho alternativo para desktop
                        audio.src = fallbackPath;
                        audio.play().catch(() => {
                        });
                    }
                });
        }
    } catch (error) {
        // Fallback visual para mobile
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            // Removido: showMobileNotificationFallback();
        }
    }
}

// Fallback visual para dispositivos móveis quando o som falha
function showMobileNotificationFallback() {
    // Criar uma notificação visual mais chamativa para mobile
    const fallbackNotification = document.createElement('div');
    fallbackNotification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #8935ff, #6e1ef7);
        color: white;
        padding: 15px 20px;
        border-radius: 25px;
        box-shadow: 0 8px 25px rgba(127, 53, 255, 0.4);
        z-index: 10000;
        font-weight: bold;
        font-size: 1.1rem;
        animation: mobileNotificationPulse 2s ease-in-out;
        max-width: 300px;
        text-align: center;
    `;
    fallbackNotification.innerHTML = '🔔';

    // Adicionar CSS da animação
    if (!document.getElementById('mobile-notification-style')) {
        const style = document.createElement('style');
        style.id = 'mobile-notification-style';
        style.textContent = `
            @keyframes mobileNotificationPulse {
                0% { transform: scale(0.8); opacity: 0; }
                50% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(fallbackNotification);

    // Remover após 3 segundos
    setTimeout(() => {
        if (fallbackNotification.parentNode) {
            fallbackNotification.style.animation = 'mobileNotificationPulse 0.5s ease-out reverse';
            setTimeout(() => {
                if (fallbackNotification.parentNode) {
                    fallbackNotification.remove();
                }
            }, 500);
        }
    }, 3000);
}

function animateBell() {
    const bell = document.getElementById('mobileNotificationBell');
    if (!bell) return;

    // Encontrar o ícone dentro do sino
    const icon = bell.querySelector('i') || bell;

    // Remover classe anterior se existir
    icon.classList.remove('bell-shake');

    // Adicionar classe de animação
    icon.classList.add('bell-shake');

    // Remover classe após a animação
    setTimeout(() => {
        icon.classList.remove('bell-shake');
    }, 700);

    // Injetar CSS da animação se necessário
    if (!document.getElementById('bell-shake-style')) {
        const style = document.createElement('style');
        style.id = 'bell-shake-style';
        style.textContent = `
            @keyframes bell-shake-keyframes {
                0% { transform: rotate(0deg); }
                15% { transform: rotate(-15deg); }
                30% { transform: rotate(12deg); }
                45% { transform: rotate(-10deg); }
                60% { transform: rotate(8deg); }
                75% { transform: rotate(-6deg); }
                100% { transform: rotate(0deg); }
            }
            .bell-shake { 
                animation: bell-shake-keyframes 0.7s ease-in-out; 
                transform-origin: top center; 
            }
        `;
        document.head.appendChild(style);
    }

    // Para dispositivos móveis, adicionar feedback tátil se disponível
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        // Tentar vibrar o dispositivo (se suportado)
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }

        // Adicionar efeito visual extra para mobile
        bell.style.transform = 'scale(1.2)';
        bell.style.transition = 'transform 0.2s ease';

        setTimeout(() => {
            bell.style.transform = 'scale(1)';
        }, 200);
    }
}




// Adicionar função global para alternar o campo de comentário
window.toggleCommentBox = function (publicationId) {
    // Fecha todos os outros campos abertos
    document.querySelectorAll('.comment-box-container').forEach(box => {
        if (box.id !== `comment-box-${publicationId}`) {
            box.style.display = 'none';
        }
    });
    // Alterna o campo da publicação clicada
    const box = document.getElementById(`comment-box-${publicationId}`);
    if (box) {
        box.style.display = (box.style.display === 'none' || box.style.display === '') ? 'block' : 'none';
        if (box.style.display === 'block') {
            box.querySelector('.comment-textarea').focus();
        }
    }
};

// Modal de comentário (inserido no DOM ao carregar a página)
document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('commentModal')) {
        const modal = document.createElement('div');
        modal.id = 'commentModal';
        modal.style.display = 'none';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.35)';
        modal.style.zIndex = '9999';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.innerHTML = `
            <div id="commentModalContent" class="comment-modal-content" style="border-radius: 12px; max-width: 400px; width: 90vw; padding: 2rem 1.5rem 1.2rem 1.5rem; box-shadow: 0 8px 32px rgba(0,0,0,0.18); position: relative; display: flex; flex-direction: column;">
                <button id="closeCommentModalBtn" style="position: absolute; top: 10px; right: 10px; border: none; font-size: 1.5rem;background-color: rgb(51, 1, 98); border: none; color: white; cursor: pointer;  padding: 3px 11px;  border-radius: 100px;">&times;</button>
                <h3 class="comment-modal-title" style="margin-bottom: 1rem;">Comentar publicação</h3>
                <div id="commentsList" style="max-height: 180px; overflow-y: auto; margin-bottom: 1rem; border-radius: 6px; padding: 8px 4px 4px 4px;"></div>
                <textarea id="commentModalTextarea" placeholder="Escreva seu comentário..." style="width: 100%; min-height: 40px; max-height: 200px; border-radius: 8px; padding: 8px; resize: none; margin-bottom: 1rem; overflow-y: hidden;" maxlength="100"></textarea>
                <div style="display:flex; justify-content: space-between; align-items:center; margin-top:4px;">
                    <span id="commentCharCount" style="font-size:0.95em;">0/100</span>
                    <button id="sendCommentModalBtn" style="background: #5b09d5; color: white; border: none; border-radius: 6px; padding: 8px 22px; cursor: pointer; align-self: flex-end;">Enviar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        // Fechar ao clicar fora do conteúdo
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeCommentModal();
        });
        // Fechar ao clicar no botão X
        document.getElementById('closeCommentModalBtn').onclick = closeCommentModal;
    }
});

// Função para abrir o modal de comentário
window.openCommentModal = async function (publicationId) {
    const modal = document.getElementById('commentModal');
    modal.style.display = 'flex';
    modal.setAttribute('data-publication-id', publicationId);
    document.getElementById('commentModalTextarea').value = '';
    document.getElementById('commentCharCount').textContent = '0/100';
    await renderComments(publicationId);
    // Remover foco automático do textarea
    // document.getElementById('commentModalTextarea').focus(); // Linha removida
    document.body.style.overflow = 'hidden';
};
// Função para fechar o modal
window.closeCommentModal = function () {
    const modal = document.getElementById('commentModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
};
// (Opcional) Adicionar lógica ao botão Enviar
// document.getElementById('sendCommentModalBtn').onclick = function() {
//     const publicationId = document.getElementById('commentModal').getAttribute('data-publication-id');
//     const comment = document.getElementById('commentModalTextarea').value.trim();
//     if (comment) {
//         // Aqui você pode salvar o comentário
//         closeCommentModal();
//         showNotification('Comentário enviado!', 'success');
//     }
// };

// Adicionar funções para comentários

// Buscar comentários de uma publicação
async function fetchComments(publicationId) {
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('publication_id', publicationId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao buscar comentários:', error);
        return [];
    }
}

// Contar comentários de uma publicação
async function countComments(publicationId) {
    try {
        const { count, error } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('publication_id', publicationId);
        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Erro ao contar comentários:', error);
        return 0;
    }
}

// Carregar contadores de comentários para múltiplas publicações - OTIMIZADO
async function loadCommentCounts(publications) {
    try {
        if (!publications || publications.length === 0) return;

        // Buscar todos os contadores de uma vez usando GROUP BY
        const publicationIds = publications.map(p => p.id).filter(Boolean);
        if (publicationIds.length === 0) return;

        // Uma única query para buscar contadores de todas as publicações
        const { data, error } = await supabase
            .from('comments')
            .select('publication_id')
            .in('publication_id', publicationIds);

        if (error) {
            console.error('Erro ao buscar contadores de comentários:', error);
            return;
        }

        // Agrupar e contar comentários por publicação
        const counts = {};
        (data || []).forEach(comment => {
            counts[comment.publication_id] = (counts[comment.publication_id] || 0) + 1;
        });

        // Atualizar contadores na interface
        publicationIds.forEach(id => {
            const countElement = document.getElementById(`comment-count-${id}`);
            if (countElement) {
                countElement.textContent = counts[id] || 0;
            }
        });
    } catch (error) {
        console.error('Erro ao carregar contadores de comentários:', error);
    }
}

// Atualizar contador de comentários de uma publicação específica
async function updateCommentCount(publicationId) {
    try {
        const count = await countComments(publicationId);
        const countElement = document.getElementById(`comment-count-${publicationId}`);
        if (countElement) {
            countElement.textContent = count;
        }
    } catch (error) {
        console.error('Erro ao atualizar contador de comentários:', error);
    }
}

// Adicionar novo comentário
async function addComment(publicationId, content) {
    try {
        if (!currentUser) throw new Error('Usuário não autenticado');
        if (!content || content.length === 0) throw new Error('Comentário vazio');
        if (content.length > 100) throw new Error('Comentário excede o limite de 100 caracteres');
        const { data, error } = await supabase
            .from('comments')
            .insert([{
                publication_id: publicationId,
                user_id: currentUser.id,
                user_name: currentUser.name,
                content: content,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
        if (error) throw error;

        // Atualizar contador de comentários na interface
        updateCommentCount(publicationId);

        return data;
    } catch (error) {
        showNotification(error.message || 'Erro ao comentar', 'error');
        throw error;
    }
}

// Função para formatar data/hora do comentário
function formatCommentDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Renderizar comentários no modal
async function renderComments(publicationId) {
    const commentsList = document.getElementById('commentsList');
    const isDarkMode = document.body.classList.contains('dark-mode');

    // Estilos dinâmicos baseados no tema
    const styles = {
        loading: isDarkMode ? 'color: #b0b3b8;' : 'color: #aaa;',
        itemBg: isDarkMode ? 'background: #3a3b3c;' : 'background: rgb(239, 229, 253);',
        itemBorder: isDarkMode ? 'border-bottom: 1px solid #4a4b4d;' : 'border-bottom: 1px solid #f0f0f0;',
        avatarBg: isDarkMode ? 'background: #4a4b4d;' : 'background: rgb(215, 195, 254);',
        userName: isDarkMode ? 'color: #b580ff;' : 'color: #5b09d5;',
        content: isDarkMode ? 'color: #e4e6eb;' : 'color: #222;',
        date: isDarkMode ? 'color: #b0b3b8;' : 'color: #888;',
        mention: isDarkMode ? 'color: #a970ff; font-weight: 600;' : 'color: #7b00ff; font-weight: 600;'
    };

    commentsList.innerHTML = `<div style="text-align:center; ${styles.loading}">Carregando...</div>`;
    const comments = await fetchComments(publicationId);

    // Atualizar contador de comentários
    updateCommentCount(publicationId);

    if (!comments || comments.length === 0) {
        commentsList.innerHTML = `<div style="text-align:center; ${styles.loading}">Seja a primeira pessoa a comentar</div>`;
        return;
    }

    // Buscar dados dos usuários dos comentários (incluindo avatares)
    const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
    if (userIds.length > 0) {
        try {
            const { data: usersData, error } = await supabase
                .from('profiles')
                .select('id, avatar_url')
                .in('id', userIds);

            if (!error && usersData) {
                // Cache dos avatares
                usersData.forEach(user => {
                    if (user.avatar_url) {
                        try { window.userIdToAvatarUrl[user.id] = user.avatar_url; } catch (_) { }
                    }
                });
            }
        } catch (err) {
            console.error('Erro ao buscar avatares dos comentários:', err);
        }
    }

    // Função para formatar menções (@usuario)
    function formatMentions(text) {
        return text.replace(/@(\w+)/g, `<span style="${styles.mention}">@$1</span>`);
    }

    commentsList.innerHTML = comments.map(c => `
        <div class="comment-item" style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; padding-bottom: 10px; ${styles.itemBorder} ${styles.itemBg} border-radius: 8px; padding: 10px 10px 10px 8px;">
            <div style="min-width: 36px; min-height: 36px; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; ${styles.avatarBg}">${renderAvatarHTML(c.user_id, c.user_name)}</div>
            <div style="flex:1;">
                <div style="font-weight:bold; ${styles.userName} font-size:1em; margin-bottom:2px;">${c.user_name}</div>
                <div style="font-size:1em; ${styles.content} margin-bottom:2px; word-break:break-word;">${formatMentions(c.content)}</div>
                <div style="font-size:0.60em; ${styles.date}">${formatCommentDate(c.created_at)}</div>
            </div>
        </div>
    `).join('');
}

// Modificar o modal para incluir a lista de comentários
// ... dentro do innerHTML do modal ...
// Substituir:
// <textarea ...></textarea>
// <button ...>Enviar</button>
// Por:
// <div id="commentsList" style="max-height: 180px; overflow-y: auto; margin-bottom: 1rem; background: #fafaff; border-radius: 6px; padding: 8px 4px 4px 4px;"></div>
// <textarea ... maxlength="100"></textarea>
// <div style="display:flex; justify-content: space-between; align-items:center; margin-top:4px;">
//   <span id="commentCharCount" style="font-size:0.95em; color:#888;">0/100</span>
//   <button ...>Enviar</button>
// </div>

// ... existing code ...
// Atualizar openCommentModal para renderizar comentários ao abrir
window.openCommentModal = async function (publicationId) {
    const modal = document.getElementById('commentModal');
    modal.style.display = 'flex';
    modal.setAttribute('data-publication-id', publicationId);
    document.getElementById('commentModalTextarea').value = '';
    document.getElementById('commentCharCount').textContent = '0/100';
    await renderComments(publicationId);
    // Remover foco automático do textarea
    // document.getElementById('commentModalTextarea').focus(); // Linha removida
    document.body.style.overflow = 'hidden';
};
// ... existing code ...
// Atualizar lógica do botão Enviar
// Após DOMContentLoaded, adicionar:
document.addEventListener('DOMContentLoaded', function () {
    const textarea = document.getElementById('commentModalTextarea');
    if (textarea) {
        textarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            document.getElementById('commentCharCount').textContent = this.value.length + '/100';
        });
    }
    const sendBtn = document.getElementById('sendCommentModalBtn');
    if (sendBtn) {
        sendBtn.onclick = async function () {
            const publicationId = document.getElementById('commentModal').getAttribute('data-publication-id');
            const comment = document.getElementById('commentModalTextarea').value.trim();
            if (!comment) return;
            if (comment.length > 100) {
                showNotification('Comentário excede o limite de 100 caracteres', 'warning');
                return;
            }
            sendBtn.disabled = true;
            try {
                await addComment(publicationId, comment);
                await criarNotificacaoComentario(publicationId, currentUser, comment);
                document.getElementById('commentModalTextarea').value = '';
                document.getElementById('commentCharCount').textContent = '0/100';
                await renderComments(publicationId);
            } catch (e) { }
            sendBtn.disabled = false;
        };
    }
});
// ... existing code ...
// No innerHTML do modal, garantir:
// <div id="commentsList" ...></div>
// <textarea id="commentModalTextarea" ... maxlength="100"></textarea>
// <div style="display:flex; justify-content: space-between; align-items:center; margin-top:4px;">
//   <span id="commentCharCount">0/100</span>
//   <button id="sendCommentModalBtn" ...>Enviar</button>
// </div>
// ... existing code ...

// Notificação para o autor da publicação ao receber comentário
async function criarNotificacaoComentario(publicationId, userWhoCommented, commentContent) {
    // Buscar dados da publicação
    const { data: pub, error } = await supabase
        .from('publications')
        .select('id, title, author_id, author')
        .eq('id', publicationId)
        .single();
    if (error || !pub) return;
    // Não notificar se o autor comentar na própria publicação
    if (pub.author_id === userWhoCommented.id) return;
    // Mensagem personalizada
    const mensagem = `${userWhoCommented.name} comentou na sua publicação: \"${pub.title}\"`;
    // Criar notificação
    await supabase
        .from('notifications')
        .insert([{
            user_id: pub.author_id,
            publication_id: pub.id,
            categoria: null,
            mensagem,
            lida: false
        }]);
}

document.addEventListener('DOMContentLoaded', function () {
    const painel = document.getElementById('notificationPanel');
    if (painel) {
        painel.style.display = 'none';
    }
});

// ... existing code ...
document.addEventListener('DOMContentLoaded', function () {
    // ... existing code ...
    // Lógica para abrir o input de pesquisa ao clicar no ícone em telas pequenas
    const searchIcon = document.querySelector('.search-icon');
    const searchContainer = document.querySelector('.search-container');
    if (searchIcon && searchContainer) {
        searchIcon.addEventListener('click', function (e) {
            e.stopPropagation();
            searchContainer.classList.toggle('active');
            const input = searchContainer.querySelector('.search-input');
            if (searchContainer.classList.contains('active') && input) {
                input.focus();
            }
        });
    }
    // Fecha o input de pesquisa ao clicar fora
    document.addEventListener('click', function (event) {
        if (searchContainer && !searchContainer.contains(event.target)) {
            searchContainer.classList.remove('active');
        }
    });
    // ... existing code ...
});
// ... existing code ...

// --- Busca responsiva tipo menu mobile ---
document.addEventListener('DOMContentLoaded', function () {
    const searchBtn = document.querySelector('.search-btn');
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.querySelector('.search-input');
    if (searchBtn && searchContainer && searchInput) {
        searchBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const isActive = searchContainer.classList.contains('active');
            if (!isActive) {
                searchContainer.classList.add('active');
                searchBtn.classList.add('active');
                document.body.style.overflow = 'hidden';
                searchInput.focus();
            } else {
                searchContainer.classList.remove('active');
                searchBtn.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });
    }
    // Fecha ao clicar fora
    document.addEventListener('click', function (event) {
        if (searchContainer && searchContainer.classList.contains('active') && !searchContainer.contains(event.target)) {
            searchContainer.classList.remove('active');
            if (searchBtn) searchBtn.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });
    // Fecha ao pressionar ESC
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && searchContainer && searchContainer.classList.contains('active')) {
            searchContainer.classList.remove('active');
            if (searchBtn) searchBtn.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });
});
// --- Fim busca responsiva ---

document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById("particles");
    if (!container) return;

    // Reduzido para melhor performance em dispositivos mais fracos
    const numParticles = 15;

    for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement("div");
        particle.classList.add("particle");

        // Posição inicial aleatória
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;

        // Duração e atraso aleatório
        const duration = 8 + Math.random() * 4;
        const delay = Math.random() * 5;

        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;

        container.appendChild(particle);
    }
});

// Espera o DOM carregar
document.addEventListener("DOMContentLoaded", function () {
    const intro = document.getElementById("introContainer");

    // Verificar se a intro já foi mostrada nesta sessão
    const introShown = sessionStorage.getItem('briolink_intro_shown');

    if (introShown) {
        // Pular intro - esconder imediatamente
        intro.style.display = "none";
        document.body.classList.remove("intro-active");
        initializeSections();
        return;
    }

    // Marcar que a intro foi mostrada
    sessionStorage.setItem('briolink_intro_shown', 'true');

    // Espera 10 segundos para animação mais longa
    setTimeout(() => {
        intro.classList.add("fade-out");  // Aplica fade-out
        setTimeout(() => {
            intro.style.display = "none";  // Esconde completamente
            document.body.classList.remove("intro-active");  // Mostra o conteúdo principal
            // Inicializar as seções após a intro
            initializeSections();
        }, 1000); // Tempo da animação fade-out
    }, 10000); // Espera da intro - 10 segundos
});

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const headerHeight = document.querySelector('.header').offsetHeight;
        const sectionTop = section.offsetTop - headerHeight - 20;

        window.scrollTo({
            top: sectionTop,
            behavior: 'smooth'
        });
    }
}

function showSection(sectionId) {
    console.log('🔍 showSection chamado com:', sectionId);

    // Ocultar todas as seções
    const mainContent = document.querySelector('.main');
    const sobreSection = document.getElementById('sobre');
    const conversasSection = document.getElementById('conversas');
    const createPostElement = document.getElementById('createPost');

    if (sectionId === 'sobre') {
        // Mostrar seção Sobre
        mainContent.style.display = 'none';
        sobreSection.style.display = 'block';
        if (conversasSection) conversasSection.style.display = 'none';

        // Ocultar elemento de criar publicação na seção sobre
        if (createPostElement) {
            createPostElement.style.display = 'none';
        }

        // Atualizar navegação ativa
        updateActiveNavigation('sobre');
    } else if (sectionId === 'conversas') {
        // Mostrar seção Conversas
        mainContent.style.display = 'none';
        sobreSection.style.display = 'none';
        if (conversasSection) conversasSection.style.display = 'block';

        // Ocultar elemento de criar publicação
        if (createPostElement) {
            createPostElement.style.display = 'none';
        }

        // Atualizar navegação ativa
        updateActiveNavigation('conversas');

        console.log('✅ Seção de conversas mostrada');
    } else if (sectionId === 'ranking') {
        // Mostrar conteúdo principal (ranking)
        mainContent.style.display = 'grid';
        sobreSection.style.display = 'none';
        if (conversasSection) conversasSection.style.display = 'none';

        // Ocultar elemento de criar publicação no ranking
        if (createPostElement) {
            createPostElement.style.display = 'none';
        }

        // Atualizar navegação ativa
        updateActiveNavigation('ranking');
    } else {
        // Mostrar conteúdo principal (publicações)
        mainContent.style.display = 'grid';
        sobreSection.style.display = 'none';
        if (conversasSection) conversasSection.style.display = 'none';

        // Mostrar elemento de criar publicação no home (se estiver logado)
        if (createPostElement && currentUser) {
            createPostElement.style.display = 'block';
        }

        // Atualizar navegação ativa
        updateActiveNavigation('home');
    }

    // Esconder secção de perfil se não for selecionada
    const perfilSection = document.getElementById('perfil-usuario');
    if (perfilSection && sectionId !== 'perfil') {
        perfilSection.style.display = 'none';
    }
}

// Mostrar secção de perfil do utilizador
function showProfileSection(userId) {
    const mainContent = document.querySelector('.main');
    const sobreSection = document.getElementById('sobre');
    const conversasSection = document.getElementById('conversas');
    const perfilSection = document.getElementById('perfil-usuario');
    const createPostElement = document.getElementById('createPost');

    // Esconder todas as outras secções
    if (mainContent) mainContent.style.display = 'none';
    if (sobreSection) sobreSection.style.display = 'none';
    if (conversasSection) conversasSection.style.display = 'none';
    if (createPostElement) createPostElement.style.display = 'none';

    // Mostrar secção de perfil
    if (perfilSection) {
        perfilSection.style.display = 'block';
        window.scrollTo(0, 0);
    }

    // Carregar dados do utilizador
    loadProfilePage(userId);
}

function updateActiveNavigation(activeSection) {
    // Remover classe ativa de todos os links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    // Adicionar classe ativa ao link correto
    if (activeSection === 'sobre') {
        const sobreLink = document.querySelector('a[href="#sobre"]');
        if (sobreLink) sobreLink.classList.add('active');
    } else {
        const homeLink = document.querySelector('a[href="#home"]');
        if (homeLink) homeLink.classList.add('active');
    }
}

// Função para inicializar a exibição correta das seções
function initializeSections() {
    const mainContent = document.querySelector('.main');
    const sobreSection = document.getElementById('sobre');

    // Garantir que o conteúdo principal esteja visível por padrão
    if (mainContent) mainContent.style.display = 'grid';
    if (sobreSection) sobreSection.style.display = 'none';

    // Garantir que o link Home esteja ativo por padrão
    updateActiveNavigation('home');
}


// Carrossel de imagens - com verificação de elementos
document.addEventListener('DOMContentLoaded', function () {
    const images = document.querySelectorAll('.carousel-img');
    const nextBtn = document.querySelector('.carousel-btn.next');
    const prevBtn = document.querySelector('.carousel-btn.prev');

    // Só executar se os elementos existirem
    if (images.length > 0 && nextBtn && prevBtn) {
        let current = 0;

        function showImage(index) {
            images.forEach((img, i) => {
                img.classList.toggle('active', i === index);
            });
        }

        nextBtn.addEventListener('click', () => {
            current = (current + 1) % images.length;
            showImage(current);
        });

        prevBtn.addEventListener('click', () => {
            current = (current - 1 + images.length) % images.length;
            showImage(current);
        });

        // Mostrar primeira imagem
        showImage(0);
    }
});



// self.addEventListener('install', event => {
//   event.waitUntil(
//     caches.open('briolink-cache').then(cache => {
//       return cache.addAll([
//         '/',
//         '/index.html',
//         '/styles.css',
//         '/script.js'
//       ]);
//     })
//   );
// });

// self.addEventListener('fetch', event => {
//   event.respondWith(
//     caches.match(event.request).then(response => {
//       return response || fetch(event.request);
//     })
//   );
// });

// OTIMIZAÇÕES DE PERFORMANCE PARA 2000+ USUÁRIOS

// 1. Cache de publicações
const publicationCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// 2. Serviço otimizado de publicações
const OptimizedPublicationsService = {
    // Buscar publicações com paginação
    async getAllPublications(page = 1, limit = 20) {
        const cacheKey = `publications_page_${page}_limit_${limit}`;
        const now = Date.now();

        // Verificar cache
        if (publicationCache.has(cacheKey)) {
            const cached = publicationCache.get(cacheKey);
            if (now - cached.timestamp < CACHE_DURATION) {
                return cached.data;
            }
        }

        try {
            const offset = (page - 1) * limit;
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .order('impulses_count', { ascending: false })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            // Cachear resultado
            publicationCache.set(cacheKey, {
                data: data || [],
                timestamp: now
            });

            return data || [];
        } catch (error) {
            console.error('Erro ao buscar publicações:', error);
            return [];
        }
    },

    // Buscar publicações por categoria com paginação
    async getPublicationsByCategory(category, page = 1, limit = 20) {
        const cacheKey = `publications_${category}_page_${page}_limit_${limit}`;
        const now = Date.now();

        // Verificar cache
        if (publicationCache.has(cacheKey)) {
            const cached = publicationCache.get(cacheKey);
            if (now - cached.timestamp < CACHE_DURATION) {
                return cached.data;
            }
        }

        try {
            const offset = (page - 1) * limit;
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .eq('category', category)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            // Cachear resultado
            publicationCache.set(cacheKey, {
                data: data || [],
                timestamp: now
            });

            return data || [];
        } catch (error) {
            console.error('Erro ao buscar publicações por categoria:', error);
            return [];
        }
    },

    // Limpar cache
    clearCache() {
        publicationCache.clear();
    },

    // Limpar cache específico
    clearCacheForCategory(category) {
        const keysToDelete = [];
        for (const [key] of publicationCache) {
            if (key.includes(category)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => publicationCache.delete(key));
    }
};

// 3. Debounce para busca
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 4. Lazy loading de imagens
function setupLazyLoading() {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// 5. Otimização de upload
async function optimizedUploadFile(file, folder) {
    // Comprimir imagem se necessário
    if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
        const compressedFile = await compressImage(file);
        return await uploadFileToStorage(compressedFile, folder);
    }
    return await uploadFileToStorage(file, folder);
}

// 6. Compressão de imagem
function compressImage(file) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            const maxWidth = 1200;
            const maxHeight = 800;
            let { width, height } = img;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.8);
        };

        img.src = URL.createObjectURL(file);
    });
}

// 7. Realtime otimizado
function setupOptimizedRealtime() {
    if (!currentUser) return;

    // Limitar subscriptions por usuário
    const channel = supabase
        .channel(`user-${currentUser.id}`)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'publications' },
            (payload) => {
                // Adicionar apenas se for recente (últimos 5 minutos)
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                if (new Date(payload.new.created_at) > fiveMinutesAgo) {
                    publications.unshift(payload.new);
                    renderPublications();
                }
            }
        )
        .subscribe();

    return channel;
}

// 8. Monitoramento de performance
const performanceMonitor = {
    startTime: Date.now(),
    requests: 0,

    logRequest() {
        this.requests++;
        if (this.requests % 10 === 0) {
        }
    },

    getStats() {
        return {
            totalRequests: this.requests,
            uptime: Date.now() - this.startTime,
            avgRequestsPerMinute: (this.requests / ((Date.now() - this.startTime) / 60000)).toFixed(2)
        };
    }
};

// ================= PWA FUNCTIONS =================

// Inicializar PWA
function initializePWA() {
    registerServiceWorker();
    detectStandaloneMode();
    updateInstallUI();
    checkConnectivity();
}

// Registrar Service Worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');

            // Verificar atualizações do service worker
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Nova versão do service worker disponível
                        console.log('🔄 Nova versão do Service Worker detectada');
                        // Ativar imediatamente e recarregar
                        newWorker.postMessage({ action: 'skipWaiting' });
                        window.location.reload();
                    }
                });
            });

            // Verificar atualizações periodicamente (versão e service worker)
            checkForUpdates(registration);

        } catch (error) {
            console.error('Erro ao registrar Service Worker:', error);
        }
    }
}

// Sistema de Versionamento e Atualização Forçada
const APP_VERSION = '1.0.0'; // Atualizar este número a cada deploy
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // Verificar a cada 5 minutos
const VERSION_FILE = '/version.json';

// Verificar se há atualizações disponíveis
function checkForUpdates(registration) {
    // Forçar verificação de atualização do service worker
    if (registration) {
        registration.update();
    }

    // Verificar versão do arquivo version.json
    checkVersionFile();

    // Configurar verificação periódica
    setInterval(() => {
        checkVersionFile();
        if (registration) {
            registration.update();
        }
    }, VERSION_CHECK_INTERVAL);
}

// Verificar versão no arquivo version.json
async function checkVersionFile() {
    try {
        // Adicionar timestamp para evitar cache
        const response = await fetch(`${VERSION_FILE}?t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            console.warn('Não foi possível verificar versão');
            return;
        }

        const data = await response.json();
        const remoteVersion = data.version || data.build;
        const currentVersion = APP_VERSION;

        // Comparar versões
        if (remoteVersion !== currentVersion) {
            console.log(`🔄 Nova versão detectada: ${remoteVersion} (atual: ${currentVersion})`);
            forceUpdate();
        }
    } catch (error) {
        console.error('Erro ao verificar versão:', error);
    }
}

// Forçar atualização da aplicação
function forceUpdate() {
    // Limpar todos os caches
    if ('caches' in window) {
        caches.keys().then((cacheNames) => {
            cacheNames.forEach((cacheName) => {
                caches.delete(cacheName);
            });
        });
    }

    // Mostrar mensagem ao usuário
    if (confirm('Uma nova versão está disponível! A página será recarregada para aplicar as atualizações.')) {
        // Unregister service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach((registration) => {
                    registration.unregister();
                });
            });
        }

        // Limpar localStorage (opcional - comentado para não perder dados)
        // localStorage.clear();

        // Forçar reload sem cache
        window.location.reload(true);
    } else {
        // Se cancelar, tentar novamente em 30 segundos
        setTimeout(forceUpdate, 30000);
    }
}

// Mostrar notificação de atualização disponível
function showUpdateAvailable() {
    showNotification('Nova versão disponível! Clique no botão de atualização para aplicar.', 'info');

    // Mostrar botão de atualização forçada
    showForceUpdateButton();
}

// Mostrar botão de atualização forçada
function showForceUpdateButton() {
    // Verificar se o botão já existe
    if (document.querySelector('.force-update-notification')) {
        return;
    }

    // Criar notificação de atualização
    const updateNotification = document.createElement('div');
    updateNotification.className = 'force-update-notification';
    updateNotification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(245, 158, 11, 0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        max-width: 300px;
    `;

    updateNotification.innerHTML = `
        <i class="fas fa-sync-alt" style="font-size: 1.2rem; animation: spin 2s linear infinite;"></i>
        <div>
            <div style="font-size: 14px; font-weight: 700;">Nova Versão!</div>
            <div style="font-size: 12px; opacity: 0.9;">Clique para atualizar</div>
        </div>
        <button style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px; border-radius: 6px; cursor: pointer; margin-left: auto;">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Adicionar animação CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .force-update-notification:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(245, 158, 11, 0.4);
        }
    `;
    document.head.appendChild(style);

    // Eventos
    updateNotification.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            // Clicou na notificação (não no X)
            forceAppUpdate();
        }
    });

    // Botão fechar
    const closeBtn = updateNotification.querySelector('button');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateNotification.remove();
    });

    // Auto-remover após 30 segundos
    setTimeout(() => {
        if (updateNotification.parentNode) {
            updateNotification.remove();
        }
    }, 30000);

    document.body.appendChild(updateNotification);
}

// Prompt de instalação do PWA
let deferredPrompt;

// Detectar quando o PWA pode ser instalado
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Mostrar botão de instalação
    showInstallButton();
});

// Fallback: Mostrar botão após 3 segundos se não aparecer automaticamente
setTimeout(() => {
    if (!deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
        showInstallButton();
        // Mostrar também no menu lateral
        const menuInstallBtn = document.querySelector('.install-app-btn');
        if (menuInstallBtn) {
            menuInstallBtn.style.display = 'block';
        }
    }
}, 3000);

// Mostrar botão de instalação
function showInstallButton() {
    // Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        return; // Já está instalado
    }

    // Criar container para os botões
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 1000;
    `;

    // Criar botão de instalação
    const installButton = document.createElement('button');
    installButton.innerHTML = '<i class="fas fa-download"></i> Instalar App';
    installButton.className = 'install-pwa-btn';
    installButton.style.cssText = `
        background: linear-gradient(135deg, #371669, #5e2d91);
        color: white;
        border: none;
        border-radius: 25px;
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(55, 22, 105, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        white-space: nowrap;
    `;

    // Criar botão de atualização forçada
    const forceUpdateButton = document.createElement('button');
    forceUpdateButton.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar App';
    forceUpdateButton.className = 'force-update-btn';
    forceUpdateButton.style.cssText = `
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        color: white;
        border: none;
        border-radius: 25px;
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        white-space: nowrap;
    `;

    // Adicionar hover effects
    installButton.addEventListener('mouseenter', () => {
        installButton.style.transform = 'translateY(-2px)';
        installButton.style.boxShadow = '0 6px 16px rgba(55, 22, 105, 0.4)';
    });

    installButton.addEventListener('mouseleave', () => {
        installButton.style.transform = 'translateY(0)';
        installButton.style.boxShadow = '0 4px 12px rgba(55, 22, 105, 0.3)';
    });

    forceUpdateButton.addEventListener('mouseenter', () => {
        forceUpdateButton.style.transform = 'translateY(-2px)';
        forceUpdateButton.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.4)';
    });

    forceUpdateButton.addEventListener('mouseleave', () => {
        forceUpdateButton.style.transform = 'translateY(0)';
        forceUpdateButton.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
    });

    // Evento de clique do botão de instalação
    installButton.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                showNotification('App instalado com sucesso!', 'success');
            } else {
            }

            deferredPrompt = null;
            buttonContainer.remove();
        }
    });

    // Evento de clique do botão de atualização forçada
    forceUpdateButton.addEventListener('click', () => {
        if (confirm('Tem certeza? Esta ação irá limpar todos os dados locais e forçar o logout. Você precisará fazer login novamente.')) {
            forceAppUpdate();
        }
    });

    // Adicionar botões ao container
    buttonContainer.appendChild(installButton);
    buttonContainer.appendChild(forceUpdateButton);

    // Auto-remover após 30 segundos (mais tempo para o usuário ver)
    setTimeout(() => {
        if (buttonContainer.parentNode) {
            buttonContainer.remove();
        }
    }, 30000);

    document.body.appendChild(buttonContainer);
}

// Função para forçar atualização do app
async function forceAppUpdate() {
    try {
        // Remover botões de instalação/atualização
        const buttonContainer = document.querySelector('.install-pwa-btn')?.parentNode;
        if (buttonContainer) {
            buttonContainer.remove();
        }

        // Limpar todos os dados locais
        console.log('Limpando dados locais...');

        // Limpar localStorage
        localStorage.clear();

        // Limpar sessionStorage
        sessionStorage.clear();

        // Limpar IndexedDB se existir
        if ('indexedDB' in window) {
            try {
                const databases = await indexedDB.databases();
                for (const db of databases) {
                    indexedDB.deleteDatabase(db.name);
                }
            } catch (e) {
                console.log('Erro ao limpar IndexedDB:', e);
            }
        }

        // Limpar Cache API
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            } catch (e) {
                console.log('Erro ao limpar cache:', e);
            }
        }

        // Fazer logout do Supabase
        if (window.supabase && window.supabase.auth) {
            try {
                await window.supabase.auth.signOut();
            } catch (e) {
                console.log('Erro ao fazer logout do Supabase:', e);
            }
        }

        // Mostrar notificação
        showNotification('Dados limpos! Recarregando a página...', 'success');

        // Aguardar um pouco antes de recarregar
        setTimeout(() => {
            // Forçar recarregamento completo da página
            window.location.reload(true);
        }, 2000);

    } catch (error) {
        console.error('Erro ao forçar atualização:', error);
        showNotification('Erro ao atualizar. Tentando recarregar...', 'error');
        setTimeout(() => {
            window.location.reload(true);
        }, 2000);
    }
}

// Detectar quando o PWA é instalado
window.addEventListener('appinstalled', () => {
    showNotification('App instalado com sucesso!', 'success');

    // Remover container de botões se existir
    const buttonContainer = document.querySelector('.install-pwa-btn')?.parentNode;
    if (buttonContainer) {
        buttonContainer.remove();
    }
    // Ocultar opção de instalar no menu lateral
    const menuInstallBtn = document.querySelector('.install-app-btn');
    if (menuInstallBtn) {
        menuInstallBtn.style.display = 'none';
    }
});

// Detectar modo standalone (PWA instalado)
function detectStandaloneMode() {
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        document.body.classList.add('pwa-mode');
        // Ocultar opção de instalar no menu se já estiver instalado
        document.querySelectorAll('.install-app-btn').forEach(btn => {
            btn.style.display = 'none';
        });

        // Adicionar CSS específico para PWA
        const pwaStyles = document.createElement('style');
        pwaStyles.textContent = `
            .pwa-mode .header {
                padding-top: env(safe-area-inset-top);
            }
            .pwa-mode body {
                padding-bottom: env(safe-area-inset-bottom);
            }
        `;
        document.head.appendChild(pwaStyles);
    }
}

// Atualiza visibilidade do botão de instalar no menu
function updateInstallUI() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    document.querySelectorAll('.install-app-btn').forEach(btn => {
        btn.style.display = isStandalone ? 'none' : 'block';
    });
}

// Verificar conectividade
function checkConnectivity() {
    if (!navigator.onLine) {
        showNotification('Você está offline. Algumas funcionalidades podem estar limitadas.', 'warning');
    }

    window.addEventListener('online', () => {
        showNotification('Conexão restaurada!', 'success');
    });

    window.addEventListener('offline', () => {
        showNotification('Você está offline.', 'warning');
    });
}

// ===== PROFILE PAGE FUNCTIONS =====

// Carregar página de perfil
async function loadProfilePage(userId) {
    try {
        // Buscar dados do utilizador
        const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            showNotification('Erro ao carregar perfil!', 'error');
            showSection('home');
            return;
        }

        // Atualizar avatar
        const avatarEl = document.getElementById('profilePageAvatar');
        if (avatarEl) {
            avatarEl.innerHTML = renderAvatarHTML(userData.id, userData.name);
        }

        // Atualizar informações
        document.getElementById('profilePageName').textContent = userData.name || 'Nome não informado';
        document.getElementById('profilePageTurma').textContent = 'Turma: ' + (userData.turma || 'Não definida');
        document.getElementById('profilePageDescription').textContent = userData.description || 'Sem descrição';
        document.getElementById('profilePageShortDesc').textContent = userData.short_description || 'Profissão ou área';

        // Buscar estatísticas
        const { data: publications, error: pubError } = await supabase
            .from('publications')
            .select('id, impulses_count')
            .eq('author_id', userId);

        const pubCount = publications ? publications.length : 0;
        const totalImpulses = publications ? publications.reduce((sum, p) => sum + (p.impulses_count || 0), 0) : 0;

        document.getElementById('profilePagePubCount').textContent = pubCount;
        document.getElementById('profilePageImpulses').textContent = totalImpulses;

        // Mostrar/esconder botões de ação
        const chatBtn = document.getElementById('profileBtnChat');
        const editBtn = document.getElementById('profileBtnEdit');
        const logoutBtn = document.getElementById('profileBtnLogout');

        if (currentUser && currentUser.id === userId) {
            // É o próprio perfil
            if (chatBtn) chatBtn.style.display = 'none';
            if (editBtn) editBtn.style.display = 'flex';
            if (logoutBtn) logoutBtn.style.display = 'flex';
        } else {
            // É outro utilizador
            if (chatBtn) {
                chatBtn.style.display = 'flex';
                chatBtn.dataset.userId = userId;
            }
            if (editBtn) editBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
        }

        // Carregar publicações do utilizador
        await loadUserProfilePublications(userId);

    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showNotification('Erro ao carregar perfil!', 'error');
    }
}

// Carregar publicações do utilizador na página de perfil
async function loadUserProfilePublications(userId) {
    const grid = document.getElementById('profilePublicationsGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-publications"><i class="fas fa-spinner fa-spin"></i><p>Carregando publicações...</p></div>';

    try {
        const { data: publications, error } = await supabase
            .from('publications')
            .select('*')
            .eq('author_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!publications || publications.length === 0) {
            grid.innerHTML = '<div class="no-publications"><i class="fas fa-newspaper"></i><p>Nenhuma publicação ainda</p></div>';
            return;
        }

        // Renderizar publicações (createPublicationCard é async)
        const cardPromises = publications.map(pub => createPublicationCard(pub));
        const cards = await Promise.all(cardPromises);
        grid.innerHTML = cards.join('');

        // Atualizar contadores de comentários
        loadCommentCounts(publications).catch(err => console.error('Erro ao carregar comentários:', err));

    } catch (error) {
        console.error('Erro ao carregar publicações do perfil:', error);
        grid.innerHTML = '<div class="no-publications"><i class="fas fa-exclamation-triangle"></i><p>Erro ao carregar publicações</p></div>';
    }
}

// Expor função globalmente
window.showProfileSection = showProfileSection;
window.loadProfilePage = loadProfilePage;

// Abrir o próprio perfil
function openMyProfile() {
    if (currentUser && currentUser.id) {
        showProfileSection(currentUser.id);
    } else {
        showNotification('Você precisa estar logado para ver seu perfil!', 'warning');
    }
}

window.openMyProfile = openMyProfile;

// ===== SETTINGS DROPDOWN FUNCTIONS =====

// Toggle settings dropdown menu
function toggleSettingsMenu() {
    const dropdown = document.getElementById('settingsDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Filter publications by category
function filterByCategory(category) {
    console.log('Filtering by category:', category);

    // Voltar para a página inicial
    showSection('home');

    // Aplicar filtro
    const publications = document.querySelectorAll('.publication-card');
    publications.forEach(pub => {
        if (category === 'all') {
            pub.style.display = 'block';
        } else {
            const pubCategory = pub.dataset.category || '';
            if (pubCategory.toLowerCase() === category.toLowerCase()) {
                pub.style.display = 'block';
            } else {
                pub.style.display = 'none';
            }
        }
    });

    // Mostrar notificação
    if (category === 'all') {
        showNotification('Mostrando todas as publicações', 'info');
    } else {
        showNotification(`Filtrando por: ${category}`, 'info');
    }
}

// Fechar dropdown ao clicar fora
document.addEventListener('click', function (event) {
    const dropdown = document.getElementById('settingsDropdown');
    const wrapper = document.querySelector('.settings-dropdown-wrapper');
    if (dropdown && wrapper && !wrapper.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

window.toggleSettingsMenu = toggleSettingsMenu;
window.filterByCategory = filterByCategory;

// ===== SEARCH FUNCTIONALITY =====

// Handle search input with debounce
function handleSearch(query) {
    const resultsContainer = document.getElementById('searchResults');
    const loadingEl = document.getElementById('searchLoading');
    const contentEl = document.getElementById('searchResultsContent');

    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Hide results if query is empty
    if (!query || query.trim().length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    // Show loading state
    resultsContainer.style.display = 'block';
    loadingEl.style.display = 'block';
    contentEl.innerHTML = '';

    // Debounce search
    searchTimeout = setTimeout(async () => {
        await performSearch(query.trim());
    }, 300);
}

// Perform search in Supabase
async function performSearch(query) {
    const resultsContainer = document.getElementById('searchResults');
    const loadingEl = document.getElementById('searchLoading');
    const contentEl = document.getElementById('searchResultsContent');

    try {
        console.log('🔍 Searching for:', query);

        // Search for users
        const { data: users, error: usersError } = await supabase
            .from('profiles')
            .select('id, name, turma, avatar_url')
            .ilike('name', `%${query}%`)
            .limit(5);

        console.log('👥 Users found:', users, 'Error:', usersError);

        // Search for publications
        const { data: publications, error: pubsError } = await supabase
            .from('publications')
            .select('id, content, author_name, category')
            .or(`content.ilike.%${query}%,author_name.ilike.%${query}%`)
            .limit(5);

        console.log('📰 Publications found:', publications, 'Error:', pubsError);

        loadingEl.style.display = 'none';

        let html = '';

        // Users section
        if (users && users.length > 0) {
            html += '<div class="search-results-section">';
            html += '<div class="search-section-title">Pessoas</div>';
            users.forEach(user => {
                const initial = (user.name || 'U').charAt(0).toUpperCase();
                html += `
                    <div class="search-result-item" onclick="viewUserProfile('${user.id}'); closeSearchResults();">
                        <div class="search-result-avatar">${initial}</div>
                        <div class="search-result-info">
                            <div class="search-result-name">${user.name || 'Sem nome'}</div>
                            <div class="search-result-meta">${user.turma || 'Turma não definida'}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Publications section
        if (publications && publications.length > 0) {
            html += '<div class="search-results-section">';
            html += '<div class="search-section-title"><i class="fas fa-newspaper"></i> Publicações</div>';
            publications.forEach(pub => {
                const content = (pub.content || '').substring(0, 50) + '...';
                html += `
                    <div class="search-result-item" onclick="scrollToPublication('${pub.id}'); closeSearchResults();">
                        <div class="search-result-icon"><i class="fas fa-file-alt"></i></div>
                        <div class="search-result-info">
                            <div class="search-result-name">${pub.author_name || 'Anónimo'}</div>
                            <div class="search-result-meta">${content}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // No results
        if ((!users || users.length === 0) && (!publications || publications.length === 0)) {
            html = '<div class="search-no-results"><i class="fas fa-search"></i><p>Nenhum resultado encontrado</p></div>';
        }

        contentEl.innerHTML = html;

    } catch (error) {
        console.error('Search error:', error);
        loadingEl.style.display = 'none';
        contentEl.innerHTML = '<div class="search-no-results"><i class="fas fa-exclamation-triangle"></i><p>Erro na pesquisa</p></div>';
    }
}

// Close search results
function closeSearchResults() {
    const resultsContainer = document.getElementById('searchResults');
    const searchInput = document.getElementById('searchInput');
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (searchInput) searchInput.value = '';
}

// Scroll to publication
function scrollToPublication(pubId) {
    showSection('home');
    setTimeout(() => {
        const pubElement = document.getElementById(`publication-${pubId}`);
        if (pubElement) {
            pubElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            pubElement.style.animation = 'highlightPub 2s ease';
        }
    }, 300);
}

// Close search when clicking outside
document.addEventListener('click', function (event) {
    const searchContainer = document.querySelector('.searchP');
    if (searchContainer && !searchContainer.contains(event.target)) {
        closeSearchResults();
    }
});

window.handleSearch = handleSearch;
window.closeSearchResults = closeSearchResults;
window.scrollToPublication = scrollToPublication;

// --- ADS SYSTEM INTEGRATION ---

/**
 * Load active advertisements from Supabase and display them in the sidebar
 */
async function loadAds() {
    const adsContainer = document.getElementById('adsContainer');
    if (!adsContainer) return;

    try {
        // Show loading state
        adsContainer.innerHTML = '<div class="ads-loading"><i class="fas fa-spinner fa-spin"></i></div>';

        // Fetch active ads
        const { data: ads, error } = await supabase
            .from('advertisements')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!ads || ads.length === 0) {
            adsContainer.innerHTML = '<!-- No ads to display -->';
            return;
        }

        // Render ads
        adsContainer.innerHTML = ads.map(ad => {
            const imageHtml = ad.image_url
                ? `<img src="${ad.image_url}" alt="${ad.title}" class="ad-card-image">`
                : '';

            const contentHtml = `
                <div class="ad-card" onclick="handleAdClick('${ad.link_url}')" style="cursor: pointer;">
                    ${imageHtml}
                    <div class="ad-card-content">
                        <h4 class="ad-card-title">${ad.title}</h4>
                        <p class="ad-card-description">${ad.description}</p>
                        ${ad.link_url ? '<span class="ad-card-link">Saiba mais <i class="fas fa-arrow-right"></i></span>' : ''}
                    </div>
                </div>
            `;

            // If link exists, wrap in anchor, otherwise just div (handled by onclick)
            return contentHtml;
        }).join('');

    } catch (error) {
        console.error('Error loading ads:', error);
        adsContainer.innerHTML = ''; // Hide on error
    }
}

/**
 * Handle clicks on advertisements
 */
window.handleAdClick = function (url) {
    if (url && url !== 'null') {
        window.open(url, '_blank');
    }
}

// Initialize Ads when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Wait a bit to ensure Supabase is initialized
    setTimeout(loadAds, 1000);
});
