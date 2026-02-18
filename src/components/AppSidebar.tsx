import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Calendar,
  Truck,
  Warehouse,
  Users,
  LogOut,
  BadgeCheck,
  Tag,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const upperMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    resource: null,
  },
  {
    title: "Liberações",
    url: "/liberacoes",
    icon: ClipboardList,
    resource: "liberacoes" as const,
    excludeRoles: ["armazem"] as const,
  },
  {
    title: "Agendamentos",
    url: "/agendamentos",
    icon: Calendar,
    resource: "agendamentos" as const,
  },
  {
    title: "Carregamentos",
    url: "/carregamentos",
    icon: Truck,
    resource: "carregamentos" as const,
  },
  {
    title: "Estoque",
    url: "/estoque",
    icon: Package,
    resource: "estoque" as const,
    requiresRole: ["armazem"] as const,
  },
];

const lowerMenuItems = [
  {
    title: "Colaboradores",
    url: "/colaboradores",
    icon: BadgeCheck,
    resource: "colaboradores" as const,
    requiresRole: ["admin"] as const,
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Users,
    resource: "clientes" as const,
  },
  {
    title: "Representantes",
    url: "/representantes",
    icon: UserCheck,
    resource: "representantes" as const,
  },
  {
    title: "Armazéns",
    url: "/armazens",
    icon: Warehouse,
    resource: "armazens" as const,
  },
  {
    title: "Produtos",
    url: "/produtos",
    icon: Tag,
    resource: "produtos" as const,
  },
  {
    title: "Estoque",
    url: "/estoque",
    icon: Package,
    resource: "estoque" as const,
    requiresRole: ["admin", "logistica"] as const,
  },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { signOut, userRole } = useAuth();
  const { canAccess, loading: permissionsLoading } = usePermissions();
  const location = useLocation();
  const isCollapsed = state === "collapsed";

  const handleLogout = async () => {
    await signOut();
  };

  const handleItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const isMenuActive = (itemUrl: string) => {
    const currentPath = location.pathname;
    
    if (itemUrl === "/" && currentPath === "/") {
      return true;
    }
    
    if (itemUrl !== "/" && currentPath.startsWith(itemUrl)) {
      return true;
    }
    
    return false;
  };

  const getMenuClasses = (itemUrl: string, isCollapsed: boolean) => {
    const isActive = isMenuActive(itemUrl);
    
    if (isActive) {
      return `bg-gradient-to-r from-primary/20 to-primary/10 text-primary font-semibold border-r-2 border-primary shadow-sm ${!isCollapsed ? 'pl-4' : ''}`;
    }
    
    return "hover:bg-sidebar-accent/50 text-sidebar-foreground transition-all duration-200 hover:text-sidebar-accent-foreground";
  };

  const filterMenuItems = (items: typeof upperMenuItems | typeof lowerMenuItems) => {
    return items.filter(item => {
      if ('excludeRoles' in item && item.excludeRoles && userRole) {
        if (item.excludeRoles.includes(userRole as any)) {
          return false;
        }
      }

      if ('requiresRole' in item && item.requiresRole) {
        const hasRequiredRole = userRole ? item.requiresRole.includes(userRole) : false;
        if (!hasRequiredRole) {
          return false;
        }
      }
      if (!item.resource) {
        return true;
      }
      if (
        item.resource === "clientes" &&
        (userRole === "admin" || userRole === "logistica")
      ) {
        return true;
      }
      if (
        item.resource === "representantes" &&
        (userRole === "admin" || userRole === "logistica")
      ) {
        return true;
      }
      const hasAccess = canAccess(item.resource, 'read');
      return hasAccess;
    });
  };

  const visibleUpperMenuItems = permissionsLoading
    ? [upperMenuItems[0]]
    : filterMenuItems(upperMenuItems);

  const visibleLowerMenuItems = permissionsLoading
    ? []
    : filterMenuItems(lowerMenuItems);

  const showCadastros = visibleLowerMenuItems.length > 0;

  return (
    <Sidebar 
      collapsible="icon"
      className="top-14"
    >
      <SidebarContent className="pt-2 px-1 scrollbar-hide">
        {/* 📱 MENU PRINCIPAL COM TOUCH TARGETS OTIMIZADOS */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 py-2 text-xs font-medium">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {visibleUpperMenuItems.map((item) => {
                const isActive = isMenuActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`${getMenuClasses(item.url, isCollapsed)} flex items-center gap-3 rounded-md transition-all duration-200 min-h-[44px] px-3 py-3 md:min-h-auto md:py-2`}
                        onClick={handleItemClick}
                      >
                        <item.icon 
                          className={`h-5 w-5 md:h-4 md:w-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} 
                        />
                        {!isCollapsed && (
                          <span className={`text-sm font-medium ${isActive ? 'text-primary' : ''}`}>
                            {item.title}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 📱 CADASTROS COM TOUCH TARGETS OTIMIZADOS */}
        {showCadastros && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="px-3 py-2 text-xs font-medium">
              Cadastros
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {visibleLowerMenuItems.map((item) => {
                  const isActive = isMenuActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className={`${getMenuClasses(item.url, isCollapsed)} flex items-center gap-3 rounded-md transition-all duration-200 min-h-[44px] px-3 py-3 md:min-h-auto md:py-2`}
                          onClick={handleItemClick}
                        >
                          <item.icon 
                            className={`h-5 w-5 md:h-4 md:w-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} 
                          />
                          {!isCollapsed && (
                            <span className={`text-sm font-medium ${isActive ? 'text-primary' : ''}`}>
                              {item.title}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* 📱 LOGOUT COM TOUCH TARGET OTIMIZADO */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={handleLogout}
                  className="hover:bg-destructive/10 hover:text-destructive transition-colors duration-200 min-h-[44px] px-3 py-3 md:min-h-auto md:py-2"
                >
                  <LogOut className="h-5 w-5 md:h-4 md:w-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="text-sm font-medium">Sair</span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
