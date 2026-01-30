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
  const [representanteId, setRepresentanteId] = useState<string | null>(null);
  const [clientesDoRepresentante, setClientesDoRepresentante] = useState<string[]>([]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (authLoading) {
        return;
      }

      if (!userRole || !user) {
        setPermissions({} as any);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('*')
          .eq('role', userRole as UserRole);

        if (error) {
          setPermissions({} as any);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
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

        setPermissions(permsMap as any);
      } catch (err) {
        setPermissions({} as any);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [userRole, user?.id, authLoading]);

  useEffect(() => {
    const fetchVinculos = async () => {
      if (authLoading || !userRole || !user) {
        setClienteId(null);
        setArmazemId(null);
        setRepresentanteId(null);
        setClientesDoRepresentante([]);
        return;
      }

      // Cliente
      if (userRole === 'cliente') {
        const { data, error } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", user.id)
          .single();
        setClienteId(data?.id ?? null);
      } else {
        setClienteId(null);
      }

      // Armazém
      if (userRole === 'armazem') {
        const { data, error } = await supabase
          .from("armazens")
          .select("id")
          .eq("user_id", user.id)
          .single();
        setArmazemId(data?.id ?? null);
      } else {
        setArmazemId(null);
      }

      // Representante
      if (userRole === 'representante') {
        try {
          // Buscar representante
          const { data: repData, error: repError } = await supabase
            .from("representantes")
            .select("id")
            .eq("user_id", user.id)
            .single();
          
          if (repError) {
            setRepresentanteId(null);
            setClientesDoRepresentante([]);
            return;
          }
          
          setRepresentanteId(repData?.id ?? null);
          
          // Buscar clientes do representante
          if (repData?.id) {
            const { data: clientesData, error: clientesError } = await supabase
              .from("clientes")
              .select("id")
              .eq("representante_id", repData.id);
            
            if (clientesError) {
              setClientesDoRepresentante([]);
              return;
            }
            
            const clienteIds = clientesData?.map(c => c.id) || [];
            setClientesDoRepresentante(clienteIds);
          } else {
            setClientesDoRepresentante([]);
          }
        } catch (error) {
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
    return hasAccess;
  };

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
