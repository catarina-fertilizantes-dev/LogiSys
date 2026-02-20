import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const signInSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres")
});

const AuthPage = () => {
  // 🚧 MODIFICAÇÃO TEMPORÁRIA: Adicionado getDefaultRouteForRole para redirecionamento por perfil
  // TODO: Remover getDefaultRouteForRole quando dashboards personalizados forem implementados
  // Após implementação dos dashboards, voltar ao redirecionamento original: <Navigate to="/" replace />
  const { user, userRole, signIn, getDefaultRouteForRole } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🚧 REDIRECIONAMENTO TEMPORÁRIO: Por perfil enquanto Dashboard não está implementado
  // ORIGINAL: return <Navigate to="/" replace />;
  // TODO: Voltar ao redirecionamento original quando dashboards forem implementados
  if (user) {
    const defaultRoute = getDefaultRouteForRole(userRole);
    console.log('🚧 [TEMP] Redirecionando usuário logado para:', defaultRoute);
    return <Navigate to={defaultRoute} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: firstError.message
      });
      return;
    }
    
    setLoading(true);
    await signIn(result.data.email, result.data.password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-0">
          <div className="flex justify-center">
            <img 
              src="/nexor-auth-logo.png" 
              alt="NEXOR" 
              className="h-32 w-32 sm:h-40 sm:w-40 md:h-52 md:w-52 object-contain" 
            />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold -mt-2">NEXOR</CardTitle>
          <CardDescription className="-mt-1 text-sm sm:text-base">Sistema de Gestão Logística</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-login" className="text-sm font-medium">Email</Label>
              <Input
                id="email-login"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-login" className="text-sm font-medium">Senha</Label>
              <Input
                id="password-login"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                placeholder="Sua senha"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full btn-primary min-h-[44px] max-md:min-h-[44px]" 
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <div className="text-center pt-2">
              <Link 
                to="/forgot-password" 
                className="text-sm text-primary hover:underline inline-block min-h-[44px] max-md:min-h-[44px] flex items-center justify-center"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
