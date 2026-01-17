
const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');

        // Configurar canvas para tela cheia
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Partículas estáticas profissionais
        const particles = [];
        const particleCount = 60;

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 1;
                this.speedX = Math.random() * 0.5 - 0.25;
                this.speedY = Math.random() * 0.5 - 0.25;
                this.opacity = Math.random() * 0.3 + 0.3; // Opacidade mais estável
                this.color = `white`;
                this.baseOpacity = this.opacity;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                // Reposicionar quando sair da tela (movimento contínuo)
                if (this.x < 0) this.x = canvas.width;
                if (this.x > canvas.width) this.x = 0;
                if (this.y < 0) this.y = canvas.height;
                if (this.y > canvas.height) this.y = 0;

                // Manter opacidade estável
                this.opacity = this.baseOpacity;
            }

            draw() {
                ctx.save();
                ctx.globalAlpha = this.opacity;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // Criar partículas
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        // Ondas suaves de fundo
        let waveOffset = 0;

        function drawWaves() {
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, 'rgba(102, 126, 234, 0.05)');
            gradient.addColorStop(1, 'rgba(118, 75, 162, 0.05)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(0, canvas.height);

            for (let x = 0; x <= canvas.width; x += 20) {
                const waveHeight = Math.sin((x + waveOffset) * 0.005) * 30;
                ctx.lineTo(x, canvas.height - 150 + waveHeight);
            }

            ctx.lineTo(canvas.width, canvas.height);
            ctx.closePath();
            ctx.fill();

            waveOffset += 20; // Movimento mais lento
        }

        // Efeito de conexão sutil entre partículas
        function drawConnections() {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 120) {
                        const opacity = (120 - distance) / 120 * 0.15; // Mais sutil
                        ctx.save();
                        ctx.globalAlpha = opacity;
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
        }

        // Função principal de animação
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Desenhar ondas de fundo
            drawWaves();

            // Atualizar e desenhar partículas
            particles.forEach(particle => {
                particle.update();
                particle.draw();
            });

            // Desenhar conexões entre partículas
            drawConnections();

            requestAnimationFrame(animate);
        }

        // Iniciar animação
        animate();

        // Efeito sutil do mouse (opcional)
        canvas.addEventListener('mousemove', (e) => {
            const mouseX = e.clientX;
            const mouseY = e.clientY;

            // Efeito muito sutil no mouse
            particles.forEach(particle => {
                const dx = mouseX - particle.x;
                const dy = mouseY - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 80) {
                    particle.speedX += dx * 0.00005; // Muito sutil
                    particle.speedY += dy * 0.00005;
                }
            });
        });