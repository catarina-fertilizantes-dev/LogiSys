import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  backButton?: ReactNode;
  showUserMenu?: boolean;
}

export const PageHeader = ({ 
  title, 
  subtitle, 
  icon: Icon, 
  actions, 
  backButton,
  showUserMenu = true
}: PageHeaderProps) => {
  
  // 🔍 DEBUG LOGS
  console.log("🔍 [DEBUG] PageHeader - Renderizando...");
  console.log("🔍 [DEBUG] PageHeader - showUserMenu:", showUserMenu);
  console.log("🔍 [DEBUG] PageHeader - title:", title);
  
  return (
    <div className="border-b border-border bg-card">
      <div className="px-4 md:px-6 py-4 md:py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {backButton && (
              <div className="flex items-center mt-1">
                {backButton}
              </div>
            )}
            {Icon && (
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">{title}</h1>
              {subtitle && (
                <p className="mt-1 text-sm md:text-base text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          
          {/* Container para actions e user menu */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {actions && <div className="flex gap-2">{actions}</div>}
            
            {/* 🔍 DEBUG: Teste visual antes do UserAvatar */}
            <div className="bg-red-200 p-2 text-xs">
              DEBUG: showUserMenu = {showUserMenu ? 'true' : 'false'}
            </div>
            
            {showUserMenu && (
              <>
                <div className="bg-green-200 p-2 text-xs">
                  DEBUG: Renderizando UserAvatar
                </div>
                <UserAvatar />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
