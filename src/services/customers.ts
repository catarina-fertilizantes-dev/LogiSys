/**
 * Service layer for customer operations
 * Handles Edge Function calls and error normalization for customer creation
 */

interface CreateCustomerPayload {
  nome: string;
  cnpj_cpf: string;
  email: string;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

interface CreateCustomerResponse {
  success: boolean;
  status?: number;
  error?: string;
  details?: string;
  cliente?: Record<string, unknown>;
  senha?: string;
}

/**
 * Creates a new customer by calling the Edge Function 'create-customer-user'
 * Normalizes errors and returns friendly messages for common scenarios
 * 
 * @param supabaseUrl - The Supabase project URL
 * @param supabaseAnonKey - The Supabase anonymous key
 * @param payload - Customer data
 * @param authToken - Optional authorization token (uses session token if not provided)
 * @returns Response with success status and normalized error messages
 */
export async function createCustomer(
  supabaseUrl: string,
  supabaseAnonKey: string,
  payload: CreateCustomerPayload,
  authToken?: string
): Promise<CreateCustomerResponse> {
  try {
    // Normalize CNPJ/CPF by removing non-numeric characters
    const normalizedPayload = {
      ...payload,
      cnpj_cpf: payload.cnpj_cpf.replace(/\D/g, '')
    };

    // Make manual fetch request for full control over response
    const response = await fetch(`${supabaseUrl}/functions/v1/create-customer-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify(normalizedPayload)
    });

    // Parse response body
    let data: Record<string, unknown> | null = null;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('❌ [ERROR] Failed to parse response JSON:', parseError);
      return {
        success: false,
        status: response.status,
        error: 'Resposta inválida do servidor',
        details: 'Não foi possível processar a resposta do servidor. Verifique os logs para mais detalhes.'
      };
    }

    console.log('🔍 [DEBUG] Edge Function response:', { status: response.status, data });

    // Handle non-2xx responses
    if (!response.ok) {
      console.error('❌ [ERROR] Edge Function returned non-2xx status:', response.status);

      // Handle 401 - Not authenticated
      if (response.status === 401) {
        return {
          success: false,
          status: 401,
          error: 'Não autenticado',
          details: data?.details || 'Sessão expirada. Faça login novamente.'
        };
      }

      // Handle 403 - Forbidden/No permission
      if (response.status === 403) {
        return {
          success: false,
          status: 403,
          error: 'Sem permissão',
          details: data?.details || 'Você não tem permissão para criar clientes.'
        };
      }

      // Handle all error responses by directly using backend's details field
      // The backend already provides user-friendly messages
      const errorMessage = (data?.details as string) || (data?.error as string) || 'Ocorreu um erro ao processar sua solicitação.';
      const errorType = data?.error || 'Erro ao criar cliente';

      return {
        success: false,
        status: response.status,
        error: String(errorType),
        details: String(errorMessage)
      };
    }

    // Success case - verify we have valid data
    if (!data) {
      return {
        success: false,
        status: response.status,
        error: 'Resposta vazia',
        details: 'O servidor não retornou dados.'
      };
    }

    if (data.success) {
      return {
        success: true,
        status: response.status,
        cliente: data.cliente,
        senha: data.senha
      };
    } else {
      // Unexpected response structure
      return {
        success: false,
        status: response.status,
        error: 'Erro inesperado',
        details: data.error || data.details || 'Resposta inesperada do servidor'
      };
    }
  } catch (err) {
    console.error('❌ [ERROR] Exception in createCustomer:', err);
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    return {
      success: false,
      error: 'Erro de conexão',
      details: errorMessage
    };
  }
}
