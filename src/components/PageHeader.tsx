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
    <div className="border-b border-border bg-card">
      <div className="px-4 py-3 md:px-6 md:py-6">
        <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-2 md:gap-3">
            {backButton && (
              <div className="flex items-center mt-1 max-md:min-h-[44px] max-md:min-w-[44px]">
                {backButton}
              </div>
            )}
            {Icon && (
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-foreground">{title}</h1>
              {subtitle && (
                <p className="mt-1 text-sm md:text-base text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex gap-2 flex-wrap md:flex-nowrap">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
