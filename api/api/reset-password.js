import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // role já na variável de ambiente
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // CORS (não é estritamente necessário se HTML estiver no mesmo domínio)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { email, novaSenha } = req.body;

    if (!email || !novaSenha) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }

    // Atualiza a senha no Supabase
    const { data, error } = await supabase
      .from('users') // troque pelo nome correto da sua tabela
      .update({ password: novaSenha }) // ou crypt(novaSenha) se estiver usando hash
      .eq('email', email);

    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao atualizar senha' });
    }

    if (data.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    return res.status(200).json({ message: 'Senha atualizada com sucesso!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}
