import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const signInSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres")
});

const signUpSchema = z.object({
  nome: z.string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome muito longo")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome contém caracteres inválidos"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter letra minúscula")
    .regex(/[0-9]/, "Senha deve conter número")
});

const AuthPage = () => {
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = signUpSchema.safeParse({ nome, email, password });
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
    await signUp(result.data.email, result.data.password, result.data.nome);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Package className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">LogisticPro</CardTitle>
          <CardDescription>Sistema de Gestão Logística</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Cadastro</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-login">Email</Label>
                  <Input
                    id="email-login"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-login">Senha</Label>
                  <Input
                    id="password-login"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary" 
                  disabled={loading}
                >
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <div className="text-center">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-signup">Email</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup">Senha</Label>
                  <Input
                    id="password-signup"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary" 
                  disabled={loading}
                >
                  {loading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
