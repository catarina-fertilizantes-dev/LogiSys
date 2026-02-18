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
      {/* 📱 HEADER FIXO GLOBAL - OCUPA TODA A LARGURA */}
      <header className="fixed top-0 left-0 right-0 h-12 md:h-14 bg-sidebar border-b border-sidebar-border flex items-center px-2 md:px-4 z-[70]">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Hambúrguer Global - Controla tudo */}
          <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          
          {/* 📱 LOGO RESPONSIVO */}
          <div className="flex items-center gap-1 md:gap-2">
            <img 
              src="/nexor-logo.png" 
              alt="NEXOR" 
              className="h-6 w-6 md:h-8 md:w-8 object-contain" 
            />
            <span className="font-bold text-sidebar-foreground text-sm md:text-base">NEXOR</span>
          </div>
        </div>
        
        {/* Área do Usuário */}
        <div className="ml-auto flex items-center gap-2">
          <UserAvatar />
        </div>
      </header>

      {/* 📱 CONTAINER PRINCIPAL COM PADDING-TOP */}
      <div className="pt-12 md:pt-14 min-h-screen flex w-full bg-background">
        {/* 📱 SIDEBAR */}
        <AppSidebar />
        
        {/* 📱 MAIN CONTENT */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
};
