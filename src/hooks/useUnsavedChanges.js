// hooks/useUnsavedChanges.js
import { useState, useCallback, useRef } from 'react';

export const useUnsavedChanges = () => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const pendingActionRef = useRef(null);

  // Marcar como alterado
  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  // Marcar como salvo (limpa o estado)
  const markAsSaved = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  // Resetar tudo (para quando limpar o formulário)
  const reset = useCallback(() => {
    setHasUnsavedChanges(false);
    setShowAlert(false);
    pendingActionRef.current = null;
  }, []);

  // Tentar fechar - verifica se há mudanças
  const handleClose = useCallback((closeAction) => {
    if (hasUnsavedChanges) {
      pendingActionRef.current = closeAction;
      setShowAlert(true);
    } else {
      closeAction();
    }
  }, [hasUnsavedChanges]);

  // Confirmar fechamento sem salvar
  const confirmClose = useCallback(() => {
    if (pendingActionRef.current) {
      pendingActionRef.current();
    }
    reset();
  }, [reset]);

  // Cancelar fechamento (continuar editando)
  const cancelClose = useCallback(() => {
    setShowAlert(false);
    pendingActionRef.current = null;
  }, []);

  return {
    hasUnsavedChanges,
    showAlert,
    markAsChanged,
    markAsSaved,
    reset,
    handleClose,
    confirmClose,
    cancelClose
  };
};
