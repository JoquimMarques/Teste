// Utilidades globais da aplicação (módulo organizado)
(function() {
    if (!window.userIdToAvatarUrl) {
        window.userIdToAvatarUrl = {};
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
        if (diffInHours < 1) {
            return 'Agora mesmo';
        } else if (diffInHours < 24) {
            return `Há ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
        } else {
            return date.toLocaleDateString('pt-BR');
        }
    }

    function getCategoryName(category) {
        const categories = {
            'programacao': 'Programação',
            'mecanica': 'Mecânica',
            'quimica': 'Química',
            'mecatronica': 'Mecatrônica',
            'robotica': 'Robótica',
            'sistemas': 'Sistemas',
            'petroquimica': 'Petroquímica',
            'eletronica': 'Eletrônica',
            'eletricidade': 'Eletricidade',
            'automacao': 'Automação',
            'negocios': 'Negócios'
        };
        return categories[category] || null;
    }

    function getAuthorInitials(author) {
        if (!author) return '<i class="fas fa-user"></i>';
        return author.split(' ').map(name => name[0]).join('').toUpperCase().substring(0, 2);
    }

    function getLocalAvatarDataUrl(userId) {
        try {
            return localStorage.getItem('avatar:' + userId) || null;
        } catch (_) { return null; }
    }

    function setLocalAvatarDataUrl(userId, dataUrl) {
        try {
            localStorage.setItem('avatar:' + userId, dataUrl);
        } catch (_) {}
    }

    function renderAvatarHTML(userId, displayName, extraClass = '') {
        const dbUrl = userId ? window.userIdToAvatarUrl[userId] : null;
        if (dbUrl) {
            return `<img src="${dbUrl}" alt="Avatar" class="user-avatar-img ${extraClass}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>`;
        }
        const dataUrl = userId ? getLocalAvatarDataUrl(userId) : null;
        if (dataUrl) {
            return `<img src="${dataUrl}" alt="Avatar" class="user-avatar-img ${extraClass}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>`;
        }
        return getAuthorInitials(displayName);
    }

    function sanitizeFileName(name) {
        return name
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    function limitarDescricao(texto, limite = 80) {
        if (typeof texto !== 'string') return '';
        if (texto.length > limite) {
            return texto.substring(0, limite) + '...';
        }
        return texto;
    }

    function aplicarLimiteDescricaoPerfil() {
        const descricoes = document.querySelectorAll('.user-description');
        descricoes.forEach(function(desc) {
            const textoOriginal = desc.getAttribute('data-original') || desc.textContent;
            desc.setAttribute('data-original', textoOriginal);
            desc.textContent = limitarDescricao(textoOriginal, 80);
        });
    }

    window.formatDate = formatDate;
    window.getCategoryName = getCategoryName;
    window.getAuthorInitials = getAuthorInitials;
    window.getLocalAvatarDataUrl = getLocalAvatarDataUrl;
    window.setLocalAvatarDataUrl = setLocalAvatarDataUrl;
    window.renderAvatarHTML = renderAvatarHTML;
    window.sanitizeFileName = sanitizeFileName;
    window.limitarDescricao = limitarDescricao;
    window.aplicarLimiteDescricaoPerfil = aplicarLimiteDescricaoPerfil;

    window.AppUtils = {
        formatDate,
        getCategoryName,
        getAuthorInitials,
        getLocalAvatarDataUrl,
        setLocalAvatarDataUrl,
        renderAvatarHTML,
        sanitizeFileName,
        limitarDescricao,
        aplicarLimiteDescricaoPerfil
    };
})();


