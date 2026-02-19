import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { emailSchema } from "@/lib/validationSchemas";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = emailSchema.safeParse(email);
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: result.error.issues[0].message
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(result.data, {
        redirectTo: `${window.location.origin}/change-password`
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha"
      });
    } catch (error) {
      console.error("Error sending reset email:", error);
      toast({
        variant: "destructive",
        title: "Erro ao enviar email",
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center items-center gap-2 mb-2">
            <img 
              src="/nexor-auth-logo.png" 
              alt="NEXOR" 
              className="h-10 w-10 sm:h-12 sm:w-12 object-contain" 
            />
            <span className="text-sm sm:text-base font-medium text-muted-foreground">NEXOR</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {emailSent ? (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Check className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
                </div>
              </div>
              <div className="text-center space-y-3">
                <CardTitle className="text-lg sm:text-xl">Email enviado!</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Enviamos um link de recuperação para <strong className="break-all">{email}</strong>
                </CardDescription>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Verifique sua caixa de entrada e spam. O link expira em 1 hora.
                </p>
              </div>
              <Link to="/auth" className="block">
                <Button className="w-full min-h-[44px] max-md:min-h-[44px] btn-secondary">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Login
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Mail className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
                </div>
              </div>
              <div className="text-center space-y-3">
                <CardTitle className="text-lg sm:text-xl">Esqueci minha senha</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Digite seu email para receber instruções de recuperação
                </CardDescription>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="seu@email.com"
                    className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full btn-primary min-h-[44px] max-md:min-h-[44px]" 
                  disabled={loading}
                >
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </Button>
                <Link to="/auth" className="block">
                  <Button className="w-full min-h-[44px] max-md:min-h-[44px] btn-secondary">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar ao Login
                  </Button>
                </Link>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
