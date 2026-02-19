import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { passwordSchema } from "@/lib/validationSchemas";

const ChangePassword = () => {
  const { needsPasswordChange, recoveryMode, clearRecoveryMode } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Determine if current password is required
  const requireCurrentPassword = !recoveryMode && !needsPasswordChange;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate new password using schema
    const passwordResult = passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: passwordResult.error.issues[0].message
      });
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "As senhas não coincidem"
      });
      return;
    }

    setLoading(true);

    try {
      // If current password is required, verify it first
      if (requireCurrentPassword) {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user?.email) {
          throw new Error("Usuário não encontrado");
        }

        // Verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword
        });

        if (signInError) {
          toast({
            variant: "destructive",
            title: "Erro",
            description: "Senha atual incorreta"
          });
          return;
        }
      }

      // Update password
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      console.log("[ChangePassword] updateUser result:", updateData, updateError);

      if (updateError) {
        toast({
          variant: "destructive",
          title: "Falha ao alterar senha",
          description: updateError.message
        });
        return;
      }

      // Remove force_password_change flag if it exists
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { force_password_change: false }
      });

      if (metadataError) throw metadataError;

      // 🆕 ADICIONAR: Limpar temp_password após troca de senha bem-sucedida
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: clearResult, error: clearError } = await supabase.rpc('clear_user_temp_password', {
            user_email: user.email.toLowerCase()
          });
          
          if (clearError) {
            console.warn('Could not clear temporary password:', clearError);
          } else if (clearResult?.cleared_count > 0) {
            console.log('Temporary password cleared for user:', user.email);
          }
        }
      } catch (clearError) {
        console.warn('Error clearing temporary password:', clearError);
      }

      // Clear recovery mode if active
      if (recoveryMode) {
        clearRecoveryMode();
      }

      toast({
        title: "Senha alterada com sucesso!",
        description: "Você pode agora acessar o sistema normalmente"
      });

      // Força logout e redireciona para login para evitar conflito de sessão recovery
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        variant: "destructive",
        title: "Erro ao alterar senha",
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-primary flex items-center justify-center">
              <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl text-center">Alterar Senha</CardTitle>
          <CardDescription className="text-center text-sm sm:text-base">
            {recoveryMode 
              ? "Crie uma nova senha para sua conta"
              : needsPasswordChange 
                ? "Por segurança, você deve alterar sua senha no primeiro acesso"
                : "Altere sua senha de acesso"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {requireCurrentPassword && (
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-sm font-medium">Senha Atual</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Digite sua senha atual"
                  className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Mínimo 6 caracteres"
                className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Digite a senha novamente"
                className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full btn-primary min-h-[44px] max-md:min-h-[44px]" 
              disabled={loading}
            >
              {loading ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;
