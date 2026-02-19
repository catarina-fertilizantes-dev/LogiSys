// components/UnsavedChangesAlert.jsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const UnsavedChangesAlert = ({ 
  open, 
  onConfirm, 
  onCancel,
  title = "Descartar alterações?",
  description = "Você preencheu alguns dados do formulário. Tem certeza que deseja sair sem salvar?"
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onCancel}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] md:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 md:flex-row md:gap-0">
          <AlertDialogCancel 
            onClick={onCancel}
            className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px] btn-secondary"
          >
            Continuar editando
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px] btn-primary"
          >
            Sair sem salvar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
