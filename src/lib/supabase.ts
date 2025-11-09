import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Mensagem útil em tempo de execução para ajudar no diagnóstico sem ser técnico
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase: faltam variáveis de ambiente. Crie um arquivo .env.local na raiz do projeto com as linhas:\n' +
    'VITE_SUPABASE_URL=https://seu-projeto.supabase.co\n' +
    'VITE_SUPABASE_ANON_KEY=sua-anon-key\n' +
    'OBS: não comite chaves reais no repositório.'
  )
}

// Criar o cliente mesmo se as variáveis estiverem vazias (evita erros de import)
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
export default supabase
