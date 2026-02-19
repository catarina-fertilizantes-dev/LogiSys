// src/components/ui/modal-footer.tsx
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ModalFooterProps {
  variant: 'single' | 'double';
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  closeText?: string;
  confirmIcon?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  confirmVariant?: 'default' | 'destructive';
}

export const ModalFooter = ({ 
  variant,
  onClose, 
  onConfirm, 
  confirmText = "Confirmar",
  closeText = variant === 'single' ? "Fechar" : "Cancelar",
  confirmIcon,
  isLoading = false,
  disabled = false,
  confirmVariant = 'default'
}: ModalFooterProps) => {
  const confirmButtonClass = confirmVariant === 'destructive' 
    ? "w-full md:w-auto bg-destructive hover:bg-destructive/90 min-h-[44px] max-md:min-h-[44px]"
    : "w-full md:w-auto btn-primary min-h-[44px] max-md:min-h-[44px]";

  if (variant === 'single') {
    return (
      <div className="pt-4 border-t border-border bg-background flex flex-col-reverse gap-2 md:flex-row md:gap-0 md:justify-end">
        <Button 
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
          className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px] btn-secondary"
        >
          {closeText}
        </Button>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-border bg-background flex flex-col-reverse gap-2 md:flex-row md:gap-0 md:justify-end">
      <Button 
        variant="outline" 
        onClick={onClose}
        disabled={isLoading}
        className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px] md:mr-2 btn-secondary"
      >
        {closeText}
      </Button>
      <Button 
        className={confirmButtonClass}
        onClick={onConfirm}
        disabled={isLoading || disabled}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            {confirmIcon && <span className="mr-2">{confirmIcon}</span>}
            {confirmText}
          </>
        )}
      </Button>
    </div>
  );
};
