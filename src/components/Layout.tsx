import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Package } from "lucide-react";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full bg-background">
        {/* App Bar - Barra superior moderna com cor do sidebar */}
        <header className="h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 md:px-6 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            {/* Hambúrguer para mobile */}
            <SidebarTrigger className="md:hidden text-sidebar-foreground hover:bg-sidebar-accent" />
            
            {/* Logo/Brand */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-sidebar-foreground hidden sm:block">LogisticPro</span>
            </div>
          </div>
          
          {/* Espaço para futuras ações globais */}
          <div className="ml-auto flex items-center gap-2">
            {/* Aqui você pode adicionar ícones de notificação, perfil do usuário, etc. */}
          </div>
        </header>

        <div className="flex flex-1">
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
