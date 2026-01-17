// Supabase Configuration - Initialize only if not already done
if (typeof window.supabaseClient === 'undefined') {
    window.SUPABASE_URL = 'https://nvswucwnvshvklqgojcw.supabase.co';
    window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52c3d1Y3dudnNodmtscWdvamN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNTY0MjAsImV4cCI6MjA2NjYzMjQyMH0.axU4sYS4G9b_Ebo1oiXVcVP933gcWytAb80hPEEQPBA';
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}
var supabase = window.supabaseClient;


// Função para obter ID do usuário (simulada - você pode implementar autenticação real)
function getUserId() {
    // Por enquanto, usar um ID fixo para demonstração
    // Em produção, você deve implementar autenticação real
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// Funções para autenticação e gerenciamento de usuários
const AuthService = {
    // Registrar novo usuário
    async register(userData) {
        try {
            // Criar usuário no Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: userData.email,
                password: userData.password
            });

            if (authError) throw authError;

            // Criar perfil do usuário na tabela profiles
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    id: authData.user.id,
                    name: userData.name,
                    email: userData.email,
                    turma: userData.turma,
                    description: userData.description || '',
                    created_at: new Date().toISOString()
                }])
                .select();

            if (profileError) throw profileError;

            return { user: authData.user, profile: profileData[0] };
        } catch (error) {
            console.error('Erro ao registrar usuário:', error);
            throw error;
        }
    },

    // Fazer login
    async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            // Buscar perfil do usuário
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError) throw profileError;

            return { user: data.user, profile };
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            throw error;
        }
    },

    // Fazer logout
    async logout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
            throw error;
        }
    },

    // Obter usuário atual
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;

            if (!user) return null;

            // Buscar perfil do usuário
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            return { user, profile };
        } catch (error) {
            console.error('Erro ao obter usuário atual:', error);
            return null;
        }
    },

    // Atualizar perfil do usuário
    async updateProfile(userId, updates) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId)
                .select();

            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            throw error;
        }
    },

    // Buscar perfil por ID
    async getProfileById(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
            return null;
        }
    }
};

// Funções para interagir com o banco de dados
const PublicationsService = {
    // Buscar todas as publicações
    async getAllPublications() {
        try {
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .order('created_at', { ascending: false });

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

    // Criar nova publicação (atualizada para usar usuário autenticado)
    async createPublication(publicationData) {
        try {
            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase
                .from('publications')
                .insert([{
                    title: publicationData.title,
                    author: currentUser.profile.name,
                    author_id: currentUser.user.id,
                    content: publicationData.content,
                    category: publicationData.category,
                    likes_count: 0,
                    dislikes_count: 0,
                    created_at: new Date().toISOString()
                }])
                .select();

            if (error) throw error;
            return data[0];
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
                .select();

            if (error) throw error;
            return data[0];
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

    // Buscar publicações com filtro de texto
    async searchPublications(searchTerm) {
        try {
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .or(`title.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Erro ao buscar publicações:', error);
            return [];
        }
    },

    // Verificar interação do usuário com uma publicação
    async getUserInteraction(publicationId) {
        try {
            const userId = getUserId();
            if (!userId) return null;

            // Usar uma abordagem mais simples que não depende de RLS
            const { data, error } = await supabase
                .from('user_interactions')
                .select('*')
                .eq('publication_id', publicationId)
                .eq('user_id', userId)
                .maybeSingle(); // Usar maybeSingle em vez de single para evitar erro quando não há resultados

            if (error) {
                console.error('Erro ao verificar interação do usuário:', error);
                return null;
            }
            return data;
        } catch (error) {
            console.error('Erro ao verificar interação do usuário:', error);
            return null;
        }
    },

    // Adicionar like
    async addLike(publicationId) {
        try {
            const userId = getUserId();
            if (!userId) throw new Error('Usuário não identificado');

            // Verificar se já existe uma interação
            const existingInteraction = await this.getUserInteraction(publicationId);

            if (existingInteraction) {
                if (existingInteraction.interaction_type === 'like') {
                    // Se já deu like, remover
                    return await this.removeInteraction(publicationId, 'like');
                } else if (existingInteraction.interaction_type === 'dislike') {
                    // Se deu dislike, trocar para like
                    return await this.updateInteraction(publicationId, 'dislike', 'like');
                }
            }

            // Adicionar nova interação de like (o trigger vai incrementar automaticamente)
            const { error: interactionError } = await supabase
                .from('user_interactions')
                .insert([{
                    publication_id: publicationId,
                    user_id: userId,
                    interaction_type: 'like',
                    created_at: new Date().toISOString()
                }]);

            if (interactionError) throw interactionError;

            // Buscar a publicação atualizada (o trigger já incrementou o contador)
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .eq('id', publicationId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao adicionar like:', error);
            throw error;
        }
    },

    // Função auxiliar para obter contador atual de likes
    async getCurrentLikesCount(publicationId) {
        try {
            const { data, error } = await supabase
                .from('publications')
                .select('likes_count')
                .eq('id', publicationId)
                .single();

            if (error) throw error;
            return data.likes_count || 0;
        } catch (error) {
            console.error('Erro ao obter contador de likes:', error);
            return 0;
        }
    },

    // Função auxiliar para obter contador atual de dislikes
    async getCurrentDislikesCount(publicationId) {
        try {
            const { data, error } = await supabase
                .from('publications')
                .select('dislikes_count')
                .eq('id', publicationId)
                .single();

            if (error) throw error;
            return data.dislikes_count || 0;
        } catch (error) {
            console.error('Erro ao obter contador de dislikes:', error);
            return 0;
        }
    },

    // Adicionar dislike
    async addDislike(publicationId) {
        try {
            const userId = getUserId();
            if (!userId) throw new Error('Usuário não identificado');

            // Verificar se já existe uma interação
            const existingInteraction = await this.getUserInteraction(publicationId);

            if (existingInteraction) {
                if (existingInteraction.interaction_type === 'dislike') {
                    // Se já deu dislike, remover
                    return await this.removeInteraction(publicationId, 'dislike');
                } else if (existingInteraction.interaction_type === 'like') {
                    // Se deu like, trocar para dislike
                    return await this.updateInteraction(publicationId, 'like', 'dislike');
                }
            }

            // Adicionar nova interação de dislike (o trigger vai incrementar automaticamente)
            const { error: interactionError } = await supabase
                .from('user_interactions')
                .insert([{
                    publication_id: publicationId,
                    user_id: userId,
                    interaction_type: 'dislike',
                    created_at: new Date().toISOString()
                }]);

            if (interactionError) throw interactionError;

            // Buscar a publicação atualizada (o trigger já incrementou o contador)
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .eq('id', publicationId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao adicionar dislike:', error);
            throw error;
        }
    },

    // Remover interação
    async removeInteraction(publicationId, interactionType) {
        try {
            const userId = getUserId();
            if (!userId) throw new Error('Usuário não identificado');

            // Remover interação (o trigger vai decrementar automaticamente)
            const { error: interactionError } = await supabase
                .from('user_interactions')
                .delete()
                .eq('publication_id', publicationId)
                .eq('user_id', userId)
                .eq('interaction_type', interactionType);

            if (interactionError) throw interactionError;

            // Buscar a publicação atualizada (o trigger já decrementou o contador)
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .eq('id', publicationId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao remover interação:', error);
            throw error;
        }
    },

    // Atualizar interação (trocar like por dislike ou vice-versa)
    async updateInteraction(publicationId, oldType, newType) {
        try {
            const userId = getUserId();
            if (!userId) throw new Error('Usuário não identificado');

            // Atualizar tipo de interação (o trigger vai ajustar os contadores automaticamente)
            const { error: interactionError } = await supabase
                .from('user_interactions')
                .update({ interaction_type: newType })
                .eq('publication_id', publicationId)
                .eq('user_id', userId)
                .eq('interaction_type', oldType);

            if (interactionError) throw interactionError;

            // Buscar a publicação atualizada (o trigger já ajustou os contadores)
            const { data, error } = await supabase
                .from('publications')
                .select('*')
                .eq('id', publicationId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao atualizar interação:', error);
            throw error;
        }
    }
};

// Configurar real-time subscriptions
const setupRealtimeSubscriptions = () => {
    // Escutar mudanças na tabela publications
    const subscription = supabase
        .channel('publications_changes')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'publications'
            },
            (payload) => {
                console.log('Mudança detectada:', payload);
                // Recarregar publicações quando houver mudanças
                loadPublications();
            }
        )
        .subscribe();

    return subscription;
};

// Exportar serviços
window.AuthService = AuthService;
window.PublicationsService = PublicationsService;
window.setupRealtimeSubscriptions = setupRealtimeSubscriptions; 