// hooks/useUnsavedChanges.js
import { useState, useCallback, useRef } from 'react';

export const useUnsavedChanges = () => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const pendingActionRef = useRef(null);

  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const markAsSaved = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  const reset = useCallback(() => {
    setHasUnsavedChanges(false);
    setShowAlert(false);
    pendingActionRef.current = null;
  }, []);

  const handleClose = useCallback((closeAction) => {
    if (hasUnsavedChanges) {
      pendingActionRef.current = closeAction;
      setShowAlert(true);
    } else {
      closeAction();
    }
  }, [hasUnsavedChanges]);

  const confirmClose = useCallback(() => {
    if (pendingActionRef.current) {
      pendingActionRef.current();
    }
    reset();
  }, [reset]);

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
