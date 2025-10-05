import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { name, novaSenha } = req.body;

  if (!name || !novaSenha) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
  }

  try {
    const email = `${name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '.')}@briolink.com`;

    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users.users.find((u) => u.email === email);
    if (!user) throw new Error('Usuário não encontrado.');

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: novaSenha,
    });
    if (updateError) throw updateError;

    return res.status(200).json({ success: true, message: 'Senha atualizada com sucesso!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
