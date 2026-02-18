import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { UserAvatar } from "@/components/UserAvatar";
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
        <header className="h-16 md:h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 sticky top-0 z-[60]">
          <div className="flex items-center gap-3">
            {/* Hambúrguer Global - Touch target melhorado */}
            <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
            
            {/* Logo/Brand - Touch target melhorado */}
            <div className="flex items-center gap-2 max-md:min-h-[44px] max-md:py-2">
              <img 
                src="/nexor-logo.png" 
                alt="NEXOR" 
                className="h-8 w-8 md:h-8 md:w-8 max-md:h-10 max-md:w-10 object-contain" 
              />
              <span className="font-bold text-sidebar-foreground max-md:text-lg">NEXOR</span>
            </div>
          </div>
          
          {/* Área do Usuário - Touch target melhorado */}
          <div className="ml-auto flex items-center gap-2 max-md:min-h-[44px]">
            <div className="max-md:min-h-[44px] max-md:min-w-[44px] max-md:flex max-md:items-center max-md:justify-center">
              <UserAvatar />
            </div>
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
