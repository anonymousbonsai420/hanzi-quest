// Configuração do modo Amigos (Supabase). Com SUPABASE_URL vazio, o modo Amigos fica desativado
// e o app funciona só com o progresso local, como antes.
//
// A chave abaixo é a chave PÚBLICA do projeto ("anon" / "publishable"): ela pode ficar no código,
// porque o banco só aceita as funções de supabase/schema.sql, que exigem um membro convidado.
// NUNCA coloque aqui a chave "service_role" / "secret".

export const SUPABASE_URL = '';
export const SUPABASE_KEY = '';

// O login é por nome de usuário; o Supabase exige um e-mail, então o app usa <usuario>@USER_EMAIL_DOMAIN.
// ".invalid" é um domínio reservado: nenhum e-mail é enviado. Não mude depois que houver contas.
export const USER_EMAIL_DOMAIN = 'hanzi-quest.invalid';

// Cliente oficial do Supabase (ESM via jsDelivr, versão fixa).
export const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.99.3/+esm';
