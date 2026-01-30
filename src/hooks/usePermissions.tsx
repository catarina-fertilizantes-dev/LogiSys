// usePermissions.tsx - VERSÃO COM DEBUG MELHORADO

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

export type Resource =
  | 'estoque'
  | 'liberacoes'
  | 'agendamentos'
  | 'carregamentos'
  | 'produtos'
  | 'clientes'
  | 'armazens'
  | 'colaboradores'
  | 'representantes';

export interface Permission {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export const usePermissions = () => {
  const { userRole, user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Record<Resource, Permission>>({} as any);
  const [loading, setLoading] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [armazemId, setArmazemId] = useState<string | null>(null);
  // 🆕 NOVOS ESTADOS PARA REPRESENTANTE
  const [representanteId, setRepresentanteId] = useState<string | null>(null);
  const [clientesDoRepresentante, setClientesDoRepresentante] = useState<string[]>([]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (authLoading) {
        console.log('🔍 [DEBUG] usePermissions - Waiting for auth to load...');
        return;
      }

      if (!userRole || !user) {
        console.log('�� [DEBUG] usePermissions - No user or role after auth loaded, clearing permissions');
        setPermissions({} as any);
        setLoading(false);
        return;
      }

      console.log('🔍 [DEBUG] usePermissions - Fetching permissions for role:', userRole, 'user:', user.id);

      try {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('*')
          .eq('role', userRole as UserRole);

        if (error) {
          console.error('❌ [ERROR] usePermissions - Query error:', error);
          setPermissions({} as any);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          console.warn('⚠️ [WARN] usePermissions - No permissions found for role:', userRole);
          setPermissions({} as any);
          setLoading(false);
          return;
        }

        const permsMap: Record<string, Permission> = {};
        data.forEach(perm => {
          permsMap[perm.resource] = {
            can_create: !!perm.can_create,
            can_read: !!perm.can_read,
            can_update: !!perm.can_update,
            can_delete: !!perm.can_delete
          };
        });

        console.log('✅ [SUCCESS] usePermissions - Loaded permissions:', permsMap);
        setPermissions(permsMap as any);
      } catch (err) {
        console.error('❌ [ERROR] usePermissions - Exception:', err);
        setPermissions({} as any);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [userRole, user?.id, authLoading]);

  // 🆕 MODIFICADO: busca vínculos para cliente, armazem E representante
  useEffect(() => {
    const fetchVinculos = async () => {
      console.log('🔍 [DEBUG] fetchVinculos - Starting with:', {
        authLoading,
        userRole,
        userId: user?.id
      });

      if (authLoading || !userRole || !user) {
        console.log('🔍 [DEBUG] fetchVinculos - Early return due to missing data');
        setClienteId(null);
        setArmazemId(null);
        setRepresentanteId(null);
        setClientesDoRepresentante([]);
        return;
      }

      // Cliente
      if (userRole === 'cliente') {
        console.log('🔍 [DEBUG] fetchVinculos - Fetching cliente data...');
        const { data, error } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", user.id)
          .single();
        console.log('🔍 [DEBUG] fetchVinculos - Cliente result:', { data, error });
        setClienteId(data?.id ?? null);
      } else {
        setClienteId(null);
      }

      // Armazém
      if (userRole === 'armazem') {
        console.log('🔍 [DEBUG] fetchVinculos - Fetching armazem data...');
        const { data, error } = await supabase
          .from("armazens")
          .select("id")
          .eq("user_id", user.id)
          .single();
        console.log('🔍 [DEBUG] fetchVinculos - Armazem result:', { data, error });
        setArmazemId(data?.id ?? null);
      } else {
        setArmazemId(null);
      }

      // 🆕 REPRESENTANTE - COM DEBUG MELHORADO
      if (userRole === 'representante') {
        console.log('🔍 [DEBUG] fetchVinculos - Fetching representante data for user:', user.id);
        
        try {
          // Buscar representante
          const { data: repData, error: repError } = await supabase
            .from("representantes")
            .select("id")
            .eq("user_id", user.id)
            .single();
          
          console.log('🔍 [DEBUG] fetchVinculos - Representante query result:', {
            repData,
            repError,
            userId: user.id
          });
          
          if (repError) {
            console.error('❌ [ERROR] fetchVinculos - Erro ao buscar representante:', repError);
            setRepresentanteId(null);
            setClientesDoRepresentante([]);
            return;
          }
          
          setRepresentanteId(repData?.id ?? null);
          
          // Buscar clientes do representante
          if (repData?.id) {
            console.log('🔍 [DEBUG] fetchVinculos - Fetching clientes for representante:', repData.id);
            
            const { data: clientesData, error: clientesError } = await supabase
              .from("clientes")
              .select("id")
              .eq("representante_id", repData.id);
            
            console.log('🔍 [DEBUG] fetchVinculos - Clientes query result:', {
              clientesData,
              clientesError,
              representanteId: repData.id
            });
            
            if (clientesError) {
              console.error('❌ [ERROR] fetchVinculos - Erro ao buscar clientes:', clientesError);
              setClientesDoRepresentante([]);
              return;
            }
            
            const clienteIds = clientesData?.map(c => c.id) || [];
            setClientesDoRepresentante(clienteIds);
            
            console.log('✅ [SUCCESS] fetchVinculos - Representante setup complete:', {
              representanteId: repData.id,
              clienteIds,
              clienteIdsLength: clienteIds.length
            });
          } else {
            console.log('⚠️ [WARN] fetchVinculos - No representante data found');
            setClientesDoRepresentante([]);
          }
        } catch (error) {
          console.error('❌ [ERROR] fetchVinculos - Exception ao buscar dados do representante:', error);
          setRepresentanteId(null);
          setClientesDoRepresentante([]);
        }
      } else {
        setRepresentanteId(null);
        setClientesDoRepresentante([]);
      }
    };

    fetchVinculos();
  }, [userRole, user?.id, authLoading]);

  const canAccess = (resource: Resource, action: 'create' | 'read' | 'update' | 'delete' = 'read'): boolean => {
    // Permissão extra: admin ou logistica sempre podem ver "clientes"
    if (resource === "clientes" && (userRole === "admin" || userRole === "logistica")) {
      return true;
    }
    // Permissão extra: admin ou logistica sempre podem ver "representantes"
    if (resource === "representantes" && (userRole === "admin" || userRole === "logistica")) {
      return true;
    }
    const perm = permissions[resource];
    if (!perm) {
      console.log(`🔍 [DEBUG] canAccess - No permission found for resource: ${resource}`);
      return false;
    }

    let hasAccess = false;
    switch (action) {
      case 'create':
        hasAccess = perm.can_create;
        break;
      case 'read':
        hasAccess = perm.can_read;
        break;
      case 'update':
        hasAccess = perm.can_update;
        break;
      case 'delete':
        hasAccess = perm.can_delete;
        break;
      default:
        hasAccess = false;
    }
    console.log(`🔍 [DEBUG] canAccess - Resource: ${resource}, Action: ${action}, Access: ${hasAccess}`);
    return hasAccess;
  };

  // 🆕 RETORNO MODIFICADO: incluir representanteId e clientesDoRepresentante
  return { 
    permissions, 
    canAccess, 
    loading, 
    clienteId, 
    armazemId, 
    representanteId, 
    clientesDoRepresentante 
  };
};
