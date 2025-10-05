export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Método não permitido' });
    }
  
    const { email, novaSenha } = req.body;
  
    if (!email || !novaSenha) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }
  
    // Teste: apenas retorna a senha para garantir que funciona
    return res.status(200).json({ message: `Senha do usuário ${email} seria atualizada para ${novaSenha}` });
  }
  