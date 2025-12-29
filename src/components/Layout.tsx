import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";

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
        {/* Barra Superior Fixa Global */}
        <header className="h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 sticky top-0 z-[60]">
          <div className="flex items-center gap-3">
            {/* Hambúrguer Global - Controla tudo */}
            <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
            
            {/* Logo/Brand */}
            <div className="flex items-center gap-2">
              <img 
                src="/nexor-logo.png" 
                alt="NEXOR" 
                className="h-8 w-8 object-contain" 
              />
              <span className="font-bold text-sidebar-foreground">NEXOR</span>
            </div>
          </div>
          
          {/* Espaço para futuras ações globais */}
          <div className="ml-auto flex items-center gap-2">
            {/* Futuras funcionalidades: notificações, perfil, etc. */}
          </div>
        </header>

        {/* Container Principal */}
        <div className="flex flex-1 relative">
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
