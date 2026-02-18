import { useState, useRef, useEffect } from "react";
import { User, LogOut, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const UserAvatar = () => {
  const { user, userRole, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Não renderizar se não há usuário logado
  if (!user) return null;

  // Extrair informações do usuário
  const userName = user.user_metadata?.nome || user.email?.split('@')[0] || 'Usuário';
  const userEmail = user.email || '';
  
  // Gerar iniciais para o avatar
  const getInitials = (name: string, email: string) => {
    if (name && name !== email.split('@')[0]) {
      const nameParts = name.split(' ');
      if (nameParts.length >= 2) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(userName, userEmail);

  // Mapear roles para labels amigáveis
  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'logistica': return 'Logística';
      case 'armazem': return 'Armazém';
      case 'cliente': return 'Cliente';
      case 'representante': return 'Representante';
      default: return 'Usuário';
    }
  };

  const getRoleColor = (role: string | null) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'logistica': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'armazem': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'cliente': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'representante': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 📱 AVATAR BUTTON RESPONSIVO */}
      <Button
        variant="ghost"
        className="relative h-11 md:h-10 w-auto px-2 md:px-3 rounded-full hover:bg-sidebar-accent/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {/* Avatar Circle */}
          <div className="h-9 w-9 md:h-8 md:w-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-semibold text-sm">
            {initials}
          </div>
          
          {/* Nome (apenas desktop) */}
          <span className="hidden md:block text-sm font-medium text-sidebar-foreground max-w-[120px] truncate">
            {userName}
          </span>
          
          {/* Chevron */}
          <ChevronDown className={`h-4 w-4 text-sidebar-foreground/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </Button>

      {/* 📱 DROPDOWN RESPONSIVO */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1rem)] max-w-80 md:w-80 bg-card border border-border rounded-lg shadow-lg z-[70] overflow-hidden">
          {/* Header do usuário */}
          <div className="p-3 md:p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-semibold text-base md:text-lg flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate text-sm md:text-base">{userName}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">{userEmail}</p>
                <div className="mt-1 md:mt-2">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getRoleColor(userRole)}`}
                  >
                    {getRoleLabel(userRole)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 📱 MENU ITEMS COM TOUCH TARGETS */}
          <div className="p-2">
            {/* Configurações */}
            <Button
              variant="ghost"
              className="w-full justify-start min-h-[44px] p-3 text-left hover:bg-muted/50"
              onClick={() => {
                setIsOpen(false);
                // TODO: Implementar página de configurações
              }}
            >
              <Settings className="h-4 w-4 mr-3 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Configurações</p>
                <p className="text-xs text-muted-foreground">Preferências da conta</p>
              </div>
            </Button>

            <Separator className="my-2" />

            {/* 📱 LOGOUT COM TOUCH TARGET */}
            <Button
              variant="ghost"
              className="w-full justify-start min-h-[44px] p-3 text-left hover:bg-destructive/10 text-destructive hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-3 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Sair</p>
                <p className="text-xs opacity-80">Encerrar sessão</p>
              </div>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
