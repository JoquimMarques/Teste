// Script de debug para verificar elementos DOM
console.log('=== DEBUG: Verificando elementos DOM ===');

// Verificar elementos de autenticação
console.log('authButtons:', document.getElementById('authButtons'));
console.log('userProfileHeader:', document.getElementById('userProfileHeader'));
console.log('userProfileSection:', document.getElementById('userProfileSection'));
console.log('loginSection:', document.getElementById('loginSection'));
console.log('createPost:', document.getElementById('createPost'));

// Verificar modais
console.log('loginModal:', document.getElementById('loginModal'));
console.log('registerModal:', document.getElementById('registerModal'));
console.log('editProfileModal:', document.getElementById('editProfileModal'));

// Verificar formulários
console.log('loginForm:', document.getElementById('loginForm'));
console.log('registerForm:', document.getElementById('registerForm'));
console.log('editProfileForm:', document.getElementById('editProfileForm'));

// Verificar se as funções estão definidas
console.log('openLoginModal function:', typeof openLoginModal);
console.log('openRegisterModal function:', typeof openRegisterModal);

// Testar se os botões têm os onclick corretos
const loginBtn = document.querySelector('[onclick="openLoginModal()"]');
const registerBtn = document.querySelector('[onclick="openRegisterModal()"]');

console.log('Login button:', loginBtn);
console.log('Register button:', registerBtn);

// Verificar se o Supabase está carregado
console.log('Supabase:', typeof supabase);
console.log('AuthService:', typeof AuthService);

console.log('=== FIM DO DEBUG ==='); 