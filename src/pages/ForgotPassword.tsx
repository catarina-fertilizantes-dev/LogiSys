import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ArrowLeft, Check } from "lucide-react";
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
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Package className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Esqueci minha senha</CardTitle>
          <CardDescription>
            {emailSent 
              ? "Email de recuperação enviado com sucesso"
              : "Digite seu email para receber instruções de recuperação"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center p-4 bg-green-50 rounded-lg border border-green-200">
                <Check className="h-5 w-5 text-green-600 mr-2" />
                <p className="text-sm text-green-800">
                  Enviamos um link de recuperação para <strong>{email}</strong>
                </p>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Verifique sua caixa de entrada e spam. O link expira em 1 hora.
              </p>
              <Link to="/auth">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="seu@email.com"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-primary" 
                disabled={loading}
              >
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
              <Link to="/auth">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Login
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
