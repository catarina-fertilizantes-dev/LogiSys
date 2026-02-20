import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { emailSchema, passwordSchema, nomeSchema } from "@/lib/validationSchemas";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  userRole: string | null;
  hasRole: (role: string) => boolean;
  needsPasswordChange: boolean;
  recoveryMode: boolean;
  clearRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 🆕 NOVA FUNÇÃO: Verificar status ativo do usuário
const checkUserActiveStatus = async (userId: string): Promise<{ active: boolean; role: string | null; message: string }> => {
  try {
    const { data, error } = await supabase.rpc('check_user_active_status', {
      user_uuid: userId
    });

    if (error) {
      console.error('Erro ao verificar status do usuário:', error);
      return { active: false, role: null, message: 'Erro ao verificar status' };
    }

    return data || { active: false, role: null, message: 'Resposta inválida' };
  } catch (err) {
    console.error('Erro inesperado ao verificar status:', err);
    return { active: false, role: null, message: 'Erro inesperado' };
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const { toast } = useToast();

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar role:', error);
      setUserRole(null);
      return;
    }

    setUserRole(data?.role ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔍 [DEBUG] Auth state change event:', event);
        console.log('🔍 [DEBUG] Session user ID:', session?.user?.id);
        
        // Handle password recovery event
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryMode(true);
          console.log('🔍 [DEBUG] Password recovery mode activated');
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('🔍 [DEBUG] Verificando status do usuário...');
          
          // �� VERIFICAR STATUS ATIVO APÓS MUDANÇA DE AUTH STATE
          const statusCheck = await checkUserActiveStatus(session.user.id);
          console.log('🔍 [DEBUG] Status check result:', statusCheck);
          
          if (!statusCheck.active) {
            console.log('🚫 [DEBUG] Usuário inativo detectado - fazendo logout');
            
            // 🛡️ PROTEÇÃO CONTRA LOOP INFINITO
            if (event !== 'SIGNED_OUT') {
              // Fazer logout imediato
              await supabase.auth.signOut();
              
              toast({
                variant: "destructive",
                title: "Acesso temporariamente indisponível",
                description: "Entre em contato com o suporte (Código: USR003).",
              });
            }
            
            return; // Não prosseguir com o login
          }
          
          console.log('🔍 [DEBUG] Usuário ativo - prosseguindo...');
          await fetchUserRole(session.user.id);
          // Check if user needs to change password
          const forceChange = session.user.user_metadata?.force_password_change === true;
          setNeedsPasswordChange(forceChange);
          console.log('🔍 [DEBUG] Force password change:', forceChange);
        } else {
          console.log('🔍 [DEBUG] Sem sessão - limpando dados');
          setUserRole(null);
          setNeedsPasswordChange(false);
          setRecoveryMode(false);
        }
      }
    );

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // 🆕 VERIFICAR STATUS ATIVO NA INICIALIZAÇÃO
        const statusCheck = await checkUserActiveStatus(session.user.id);
        
        if (!statusCheck.active) {
          console.log('🚫 [DEBUG] Usuário inativo na inicialização:', statusCheck);
          
          // Fazer logout imediato
          await supabase.auth.signOut();
          
          toast({
            variant: "destructive",
            title: "Sessão encerrada por questões de segurança",
            description: "Entre em contato com o suporte (Código: USR002).",
          });
          
          setLoading(false);
          return;
        }
        
        await fetchUserRole(session.user.id);
        // Check if user needs to change password
        const forceChange = session.user.user_metadata?.force_password_change === true;
        setNeedsPasswordChange(forceChange);
        console.log('🔍 [DEBUG] Force password change:', forceChange);
      }
      
      setLoading(false);
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const emailResult = emailSchema.safeParse(email);
      const passwordResult = passwordSchema.safeParse(password);
      
      if (!emailResult.success || !passwordResult.success) {
        toast({
          variant: "destructive",
          title: "Erro de validação",
          description: "Email ou senha inválidos"
        });
        return { error: new Error("Validation failed") };
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: emailResult.data, 
        password: passwordResult.data 
      });

      if (error) {
        let errorMessage = "Erro ao fazer login";
        
        if (error.message === "Invalid login credentials") {
          errorMessage = "Email ou senha incorretos";
        } else if (error.message === "Email not confirmed") {
          errorMessage = "Email não confirmado";
        } else if (error.message === "Too many requests") {
          errorMessage = "Muitas tentativas. Tente novamente mais tarde";
        }
        
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: errorMessage,
        });
        
        return { error };
      } 
      
      if (data.user) {
        // 🆕 VERIFICAR STATUS ATIVO APÓS LOGIN BEM-SUCEDIDO
        const statusCheck = await checkUserActiveStatus(data.user.id);
        
        if (!statusCheck.active) {
          console.log('🚫 [DEBUG] Login bloqueado - usuário inativo:', statusCheck);
          
          // Fazer logout imediato
          await supabase.auth.signOut();
          
          toast({
            variant: "destructive",
            title: "Não foi possível acessar o sistema",
            description: "Entre em contato com o suporte (Código: USR001).",
          });
          
          return { error: new Error("User inactive") };
        }
        
        // Verificar se precisa trocar senha
        const needsChange = data.user.user_metadata?.force_password_change === true;
        
        if (needsChange) {
          setNeedsPasswordChange(true);
        }
        
        // Verificar se está em modo recovery
        if (data.user.recovery_sent_at) {
          setRecoveryMode(true);
        }
        
        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo${needsChange ? '. Você deve alterar sua senha.' : '!'}`,
        });
      }
      
      return { error };
    } catch (err) {
      console.error("Erro inesperado no login:", err);
      toast({
        variant: "destructive",
        title: "Erro inesperado",
        description: "Tente novamente ou entre em contato com o suporte",
      });
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const emailResult = emailSchema.safeParse(email);
    const passwordResult = passwordSchema.safeParse(password);
    const nomeResult = nomeSchema.safeParse(nome);
    
    if (!emailResult.success || !passwordResult.success || !nomeResult.success) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "Por favor, verifique os dados informados"
      });
      return { error: new Error("Validation failed") };
    }
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email: emailResult.data,
      password: passwordResult.data,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome: nomeResult.data
        }
      }
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: error.message
      });
    } else {
      toast({
        title: "Conta criada com sucesso!",
        description: "Você já pode fazer login com a role padrão de cliente."
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    toast({
      title: "Logout realizado",
      description: "Até logo!"
    });
  };

  const hasRole = (role: string) => userRole === role;

  const clearRecoveryMode = () => {
    setRecoveryMode(false);
    console.log('🔍 [DEBUG] Recovery mode cleared');
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      userRole,
      hasRole,
      needsPasswordChange,
      recoveryMode,
      clearRecoveryMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
