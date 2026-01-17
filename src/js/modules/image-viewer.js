// ===== VISUALIZADOR DE IMAGENS EM TELA CHEIA =====

let currentImageIndex = 0;
let images = [];
let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let scale = 1;
let translateX = 0;
let translateY = 0;

// Função para abrir o visualizador de imagens
function openImageViewer(imageSrc, publicationImages = []) {
    const imageViewer = document.getElementById('imageViewer');
    const imageViewerImg = document.getElementById('imageViewerImg');
    const imageViewerCounter = document.getElementById('imageViewerCounter');
    
    if (!imageViewer || !imageViewerImg) {
        console.error('Elementos do visualizador de imagens não encontrados');
        return;
    }
    
    // Se há múltiplas imagens na publicação, use todas elas
    if (publicationImages.length > 0) {
        images = publicationImages;
        currentImageIndex = images.findIndex(img => img.src === imageSrc);
        if (currentImageIndex === -1) currentImageIndex = 0;
    } else {
        // Se não há múltiplas imagens, use apenas a imagem clicada
        images = [{ src: imageSrc }];
        currentImageIndex = 0;
    }
    
    // Resetar zoom e posição
    scale = 1;
    translateX = 0;
    translateY = 0;
    
    // Configurar a imagem atual
    imageViewerImg.src = images[currentImageIndex].src;
    imageViewerImg.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
    
    // Atualizar contador
    updateImageCounter();
    
    // Mostrar/ocultar botões de navegação
    updateNavigationButtons();
    
    // Adicionar classe ativa
    imageViewer.classList.add('active');
    
    // Prevenir scroll do body
    document.body.style.overflow = 'hidden';
    
    // Adicionar event listeners
    addImageViewerEventListeners();
}

// Função para fechar o visualizador
function closeImageViewer() {
    const imageViewer = document.getElementById('imageViewer');
    
    if (imageViewer) {
        imageViewer.classList.remove('active');
        
        // Restaurar scroll do body
        document.body.style.overflow = '';
        
        // Remover event listeners
        removeImageViewerEventListeners();
        
        // Resetar variáveis
        scale = 1;
        translateX = 0;
        translateY = 0;
        isDragging = false;
    }
}

// Função para navegar para a imagem anterior
function previousImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        showCurrentImage();
    }
}

// Função para navegar para a próxima imagem
function nextImage() {
    if (currentImageIndex < images.length - 1) {
        currentImageIndex++;
        showCurrentImage();
    }
}

// Função para mostrar a imagem atual
function showCurrentImage() {
    const imageViewerImg = document.getElementById('imageViewerImg');
    
    if (imageViewerImg && images[currentImageIndex]) {
        imageViewerImg.src = images[currentImageIndex].src;
        
        // Resetar zoom e posição
        scale = 1;
        translateX = 0;
        translateY = 0;
        imageViewerImg.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        
        updateImageCounter();
        updateNavigationButtons();
    }
}

// Função para atualizar o contador de imagens
function updateImageCounter() {
    const imageViewerCounter = document.getElementById('imageViewerCounter');
    if (imageViewerCounter) {
        imageViewerCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
    }
}

// Função para atualizar botões de navegação
function updateNavigationButtons() {
    const prevBtn = document.querySelector('.image-viewer-prev');
    const nextBtn = document.querySelector('.image-viewer-next');
    
    if (prevBtn) {
        prevBtn.style.display = currentImageIndex > 0 ? 'flex' : 'none';
    }
    
    if (nextBtn) {
        nextBtn.style.display = currentImageIndex < images.length - 1 ? 'flex' : 'none';
    }
}

// Funções de zoom
function zoomIn() {
    if (scale < 3) {
        scale += 0.5;
        updateImageTransform();
    }
}

function zoomOut() {
    if (scale > 0.5) {
        scale -= 0.5;
        updateImageTransform();
    }
}

function resetZoom() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateImageTransform();
}

function updateImageTransform() {
    const imageViewerImg = document.getElementById('imageViewerImg');
    const imageViewerMain = document.querySelector('.image-viewer-main');
    
    if (imageViewerImg) {
        imageViewerImg.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        
        if (imageViewerMain) {
            if (scale > 1) {
                imageViewerMain.classList.add('zoomed');
            } else {
                imageViewerMain.classList.remove('zoomed');
            }
        }
    }
}

// Função para baixar imagem
function downloadImage() {
    if (images[currentImageIndex]) {
        const link = document.createElement('a');
        link.href = images[currentImageIndex].src;
        link.download = `imagem_${currentImageIndex + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Função para compartilhar imagem
function shareImage() {
    if (navigator.share && images[currentImageIndex]) {
        navigator.share({
            title: 'Imagem do Briolink',
            text: 'Confira esta imagem!',
            url: images[currentImageIndex].src
        });
    } else {
        // Fallback: copiar URL para clipboard
        navigator.clipboard.writeText(images[currentImageIndex].src).then(() => {
            showNotification('URL da imagem copiada para a área de transferência!', 'success');
        });
    }
}

// Event listeners para drag e zoom
function addImageViewerEventListeners() {
    const imageViewerImg = document.getElementById('imageViewerImg');
    const imageViewer = document.getElementById('imageViewer');
    
    if (!imageViewerImg || !imageViewer) return;
    
    // Mouse events
    imageViewerImg.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch events
    imageViewerImg.addEventListener('touchstart', startDrag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', endDrag);
    
    // Wheel zoom
    imageViewer.addEventListener('wheel', handleWheel, { passive: false });
    
    // Keyboard events
    document.addEventListener('keydown', handleKeyboard);
}

function removeImageViewerEventListeners() {
    const imageViewerImg = document.getElementById('imageViewerImg');
    const imageViewer = document.getElementById('imageViewer');
    
    if (!imageViewerImg || !imageViewer) return;
    
    // Mouse events
    imageViewerImg.removeEventListener('mousedown', startDrag);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', endDrag);
    
    // Touch events
    imageViewerImg.removeEventListener('touchstart', startDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', endDrag);
    
    // Wheel zoom
    imageViewer.removeEventListener('wheel', handleWheel);
    
    // Keyboard events
    document.removeEventListener('keydown', handleKeyboard);
}

function startDrag(e) {
    if (scale > 1) {
        isDragging = true;
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        startX = clientX - translateX;
        startY = clientY - translateY;
        
        e.preventDefault();
    }
}

function drag(e) {
    if (isDragging && scale > 1) {
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        currentX = clientX - startX;
        currentY = clientY - startY;
        
        translateX = currentX;
        translateY = currentY;
        
        updateImageTransform();
        
        e.preventDefault();
    }
}

function endDrag() {
    isDragging = false;
}

function handleWheel(e) {
    e.preventDefault();
    
    if (e.deltaY < 0) {
        zoomIn();
    } else {
        zoomOut();
    }
}

function handleKeyboard(e) {
    switch(e.key) {
        case 'Escape':
            closeImageViewer();
            break;
        case 'ArrowLeft':
            if (currentImageIndex > 0) {
                previousImage();
            }
            break;
        case 'ArrowRight':
            if (currentImageIndex < images.length - 1) {
                nextImage();
            }
            break;
        case '+':
        case '=':
            zoomIn();
            break;
        case '-':
            zoomOut();
            break;
        case '0':
            resetZoom();
            break;
    }
}

// Função para inicializar o visualizador (chamada quando uma imagem de publicação é clicada)
function initializeImageViewer() {
    // Adicionar event listeners para todas as imagens de publicação
    document.addEventListener('click', function(e) {
        // Verificar se o clique foi em uma imagem de publicação
        if (e.target.classList.contains('publication-image')) {
            e.preventDefault();
            
            // Coletar todas as imagens da publicação atual
            const publication = e.target.closest('.publication-card');
            const publicationImages = [];
            
            if (publication) {
                const images = publication.querySelectorAll('.publication-image');
                images.forEach(img => {
                    publicationImages.push({ src: img.src });
                });
            }
            
            // Abrir visualizador
            openImageViewer(e.target.src, publicationImages);
        }
    });
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initializeImageViewer);
