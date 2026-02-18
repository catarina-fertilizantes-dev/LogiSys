import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  backButton?: ReactNode;
}

export const PageHeader = ({ title, subtitle, icon: Icon, actions, backButton }: PageHeaderProps) => {
  return (
    <div className="bg-card border-b border-border sticky top-0 z-40">
      <div className="p-4 md:p-6">
        <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            {backButton && (
              <div className="flex-shrink-0 max-md:min-h-[44px] max-md:min-w-[44px] max-md:flex max-md:items-center">
                {backButton}
              </div>
            )}
            {Icon && (
              <div className="flex-shrink-0 max-md:min-h-[44px] max-md:min-w-[44px] max-md:flex max-md:items-center max-md:justify-center">
                <Icon className="h-5 w-5 md:h-6 md:w-6 max-md:h-6 max-md:w-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl max-md:text-xl font-bold text-foreground truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm md:text-base max-md:text-sm text-muted-foreground mt-1 line-clamp-2 md:line-clamp-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex-shrink-0 max-md:pt-2 max-md:border-t max-md:border-border md:border-0 md:pt-0">
              <div className="flex flex-wrap gap-2 max-md:justify-stretch [&>*]:max-md:min-h-[44px] [&>button]:max-md:min-h-[44px] [&>button]:max-md:px-4 [&>button]:max-md:text-sm">
                {actions}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
