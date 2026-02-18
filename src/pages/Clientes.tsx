import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Filter as FilterIcon, Key, Loader2, X, UserCheck, Edit3, Save, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

type Cliente = Database['public']['Tables']['clientes']['Row'] & {
  temp_password?: string | null;
  representantes?: {
    id: string;
    nome: string;
  } | null;
};

// Tipo para representantes
type Representante = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
};

// Helpers de formatação
const formatCPF = (cpf: string) =>
  cpf.replace(/\D/g, "")
    .padStart(11, "0")
    .slice(0, 11)
    .replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

const formatCNPJ = (cnpj: string) =>
  cnpj.replace(/\D/g, "")
    .padStart(14, "0")
    .slice(0, 14)
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

function formatCpfCnpj(v: string): string {
  const onlyDigits = v.replace(/\D/g, "");
  if (onlyDigits.length <= 11) {
    return formatCPF(onlyDigits);
  }
  return formatCNPJ(onlyDigits);
}
function maskCpfCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    // CPF
    let cpf = digits.slice(0, 11);
    if (cpf.length > 9)
      return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})$/, "$1.$2.$3-$4");
    if (cpf.length > 6)
      return cpf.replace(/^(\d{3})(\d{3})(\d{0,3})$/, "$1.$2.$3");
    if (cpf.length > 3)
      return cpf.replace(/^(\d{3})(\d{0,3})$/, "$1.$2");
    return cpf;
  } else {
    // CNPJ
    let cnpj = digits.slice(0, 14);
    if (cnpj.length > 12)
      return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/, "$1.$2.$3/$4-$5");
    if (cnpj.length > 8)
      return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})$/, "$1.$2.$3/$4");
    if (cnpj.length > 5)
      return cnpj.replace(/^(\d{2})(\d{3})(\d{0,3})$/, "$1.$2.$3");
    if (cnpj.length > 2)
      return cnpj.replace(/^(\d{2})(\d{0,3})$/, "$1.$2");
    return cnpj;
  }
}
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (cleaned.length === 10)
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return phone;
}
function maskPhoneInput(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length === 11)
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (cleaned.length === 10)
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (cleaned.length > 6)
    return cleaned.replace(/^(\d{2})(\d{0,5})(\d{0,4})$/, "($1) $2-$3");
  if (cleaned.length > 2)
    return cleaned.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  if (cleaned.length > 0)
    return cleaned.replace(/^(\d{0,2})/, "($1");
  return "";
}
function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, "").slice(0, 8);
  if (cleaned.length === 8)
    return cleaned.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return cep;
}
function maskCEPInput(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 8);
  if (cleaned.length > 5)
    return cleaned.replace(/^(\d{5})(\d{0,3})$/, "$1-$2");
  return cleaned;
}

const Clientes = () => {
  useScrollToTop();
  
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const { canAccess, loading: permissionsLoading } = usePermissions();

  if (!permissionsLoading && !(hasRole("admin") || hasRole("logistica"))) {
    return <Navigate to="/" replace />;
  }

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para representantes
  const [representantes, setRepresentantes] = useState<Representante[]>([]);

  // Formulário Novo Cliente
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    nome: "",
    cnpj_cpf: "",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    representante_id: "",
  });

  const [credenciaisModal, setCredenciaisModal] = useState({
    show: false,
    email: "",
    senha: "",
    nome: "",
  });

  const [detalhesCliente, setDetalhesCliente] = useState<Cliente | null>(null);
  
  // Estados para edição de representante
  const [editandoRepresentante, setEditandoRepresentante] = useState(false);
  const [novoRepresentanteId, setNovoRepresentanteId] = useState<string>("");
  const [salvandoRepresentante, setSalvandoRepresentante] = useState(false);

  // 🆕 ESTADOS PARA CONTROLE DE FECHAMENTO DO MODAL
  const [alertaSalvarAberto, setAlertaSalvarAberto] = useState(false);

  const [filterStatus, setFilterStatus] = useState<"all" | "ativo" | "inativo">("all");
  const [filterRepresentante, setFilterRepresentante] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Estados de loading
  const [isCreating, setIsCreating] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState<Record<string, boolean>>({});

  const resetForm = () => {
    setNovoCliente({
      nome: "",
      cnpj_cpf: "",
      email: "",
      telefone: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      representante_id: "",
    });
  };

  // 🆕 FUNÇÃO PARA RESETAR ESTADOS DE EDIÇÃO
  const resetEdicaoStates = () => {
    setEditandoRepresentante(false);
    setNovoRepresentanteId("");
    setAlertaSalvarAberto(false);
  };

  // 🆕 FUNÇÃO PARA FECHAR MODAL COM VERIFICAÇÃO
  const handleFecharModal = () => {
    if (editandoRepresentante) {
      setAlertaSalvarAberto(true);
    } else {
      setDetalhesCliente(null);
      resetEdicaoStates();
    }
  };

  // 🆕 FUNÇÃO PARA CONFIRMAR FECHAMENTO SEM SALVAR
  const handleConfirmarFechamento = () => {
    setDetalhesCliente(null);
    resetEdicaoStates();
  };

  // 🆕 FUNÇÃO PARA SALVAR E FECHAR
  const handleSalvarEFechar = async () => {
    await handleSalvarRepresentante();
    setDetalhesCliente(null);
    resetEdicaoStates();
  };

  // Função para buscar representantes
  const fetchRepresentantes = async () => {
    try {
      const { data, error } = await supabase
        .from("representantes")
        .select("id, nome, email, ativo")
        .order("nome", { ascending: true });

      if (error) {
        console.error('Erro ao buscar representantes:', error);
        return;
      }

      setRepresentantes(data || []);
    } catch (err) {
      console.error('Erro inesperado ao buscar representantes:', err);
    }
  };

  const fetchClientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select(`
          *, 
          temp_password,
          representantes:representante_id (
            id,
            nome
          )
        `)
        .order("nome", { ascending: true });
      if (error) {
        setError(error.message);
        toast({
          variant: "destructive",
          title: "Erro ao carregar clientes",
          description: "Não foi possível carregar a lista de clientes.",
        });
        setLoading(false);
        return;
      }
      setClientes(data as Cliente[]);
      setLoading(false);
    } catch (err) {
      setError("Erro desconhecido");
      toast({
        variant: "destructive",
        title: "Erro ao carregar clientes",
        description: "Erro inesperado ao carregar clientes.",
      });
      setLoading(false);
    }
  };

  // FUNÇÃO PARA SALVAR ALTERAÇÃO DE REPRESENTANTE - CORRIGIDA
  const handleSalvarRepresentante = async () => {
    if (!detalhesCliente) return;

    setSalvandoRepresentante(true);

    try {
      // TRATAR O VALOR "sem-representante" COMO NULL
      const representanteIdParaSalvar = novoRepresentanteId === "sem-representante" ? null : novoRepresentanteId;
      
      const { error } = await supabase
        .from("clientes")
        .update({ 
          representante_id: representanteIdParaSalvar,
          updated_at: new Date().toISOString()
        })
        .eq("id", detalhesCliente.id);

      if (error) {
        throw error;
      }

      // Buscar o nome do representante para exibir na mensagem
      const representanteNome = representanteIdParaSalvar 
        ? representantes.find(r => r.id === representanteIdParaSalvar)?.nome 
        : null;

      toast({
        title: "Representante atualizado com sucesso!",
        description: representanteNome 
          ? `Cliente agora é representado por ${representanteNome}.`
          : "Representante removido do cliente.",
      });

      // Recarregar dados
      await fetchClientes();

      // Atualizar o cliente no modal
      const clienteAtualizado = await supabase
        .from("clientes")
        .select(`
          *, 
          temp_password,
          representantes:representante_id (
            id,
            nome
          )
        `)
        .eq("id", detalhesCliente.id)
        .single();

      if (clienteAtualizado.data) {
        setDetalhesCliente(clienteAtualizado.data as Cliente);
      }

      // Resetar estados de edição
      resetEdicaoStates();

    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar representante",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setSalvandoRepresentante(false);
    }
  };

  // Função para cancelar edição
  const handleCancelarEdicao = () => {
    resetEdicaoStates();
    setNovoRepresentanteId(detalhesCliente?.representante_id || "sem-representante");
  };

  // FUNÇÃO PARA INICIAR EDIÇÃO - CORRIGIDA
  const handleIniciarEdicao = () => {
    setEditandoRepresentante(true);
    // SE NÃO TEM REPRESENTANTE, USAR "sem-representante"
    setNovoRepresentanteId(detalhesCliente?.representante_id || "sem-representante");
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  
  useEffect(() => {
    fetchClientes();
    fetchRepresentantes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateCliente = async () => {
    const { nome, cnpj_cpf, email, telefone, endereco, cidade, estado, cep, representante_id } = novoCliente;
    if (!nome.trim() || !cnpj_cpf.trim() || !email.trim()) {
      toast({
        variant: "destructive",
        title: "Preencha os campos obrigatórios",
      });
      return;
    }

    setIsCreating(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        toast({
          variant: "destructive",
          title: "Erro de configuração",
          description: "Variáveis de ambiente do Supabase não configuradas.",
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: "destructive",
          title: "Não autenticado",
          description: "Sessão expirada. Faça login novamente.",
        });
        return;
      }

      // Salva SEM formatação
      const cleanCnpjCpf = novoCliente.cnpj_cpf.replace(/\D/g, "");
      const cleanTelefone = novoCliente.telefone ? novoCliente.telefone.replace(/\D/g, "") : null;
      const cleanCep = novoCliente.cep ? novoCliente.cep.replace(/\D/g, "") : null;

      const response = await fetch(`${supabaseUrl}/functions/v1/create-customer-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          cnpj_cpf: cleanCnpjCpf,
          email: email.trim(),
          telefone: cleanTelefone,
          endereco: endereco?.trim() || null,
          cidade: cidade?.trim() || null,
          estado: estado || null,
          cep: cleanCep,
        }),
      });

      let textBody = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(textBody);
      } catch {
        data = null;
      }

      if (!response.ok) {
        let errorMessage = "Erro ao criar cliente";
        if (data) {
          if (
            typeof data.details === "object" &&
            data.details !== null &&
            "fieldErrors" in data.details
          ) {
            errorMessage = Object.values(data.details.fieldErrors)
              .flat()
              .map(msg =>
                msg === "Invalid email" ? "Email inválido"
                  : msg === "Required" ? "Campo obrigatório"
                    : msg.includes("at least") ? msg.replace("String must contain at least", "Mínimo de").replace("character(s)", "caracteres")
                      : msg
              ).join(" | ");
          } else if (typeof data.details === "string") {
            errorMessage = data.details;
          } else if (data.error) {
            errorMessage = data.error;
          } else {
            errorMessage = JSON.stringify(data.details);
          }
        }
        toast({
          variant: "destructive",
          title: "Erro ao criar cliente",
          description: errorMessage,
        });
        return;
      }

      if (data && data.success) {
        // Atualizar representante se selecionado
        if (representante_id) {
          const { error: updateError } = await supabase
            .from("clientes")
            .update({ representante_id: representante_id })
            .eq("id", data.cliente.id);

          if (updateError) {
            console.error('Erro ao atribuir representante:', updateError);
            toast({
              variant: "destructive",
              title: "Cliente criado, mas erro ao atribuir representante",
              description: "O cliente foi criado, mas não foi possível atribuir o representante.",
            });
          }
        }

        toast({
          title: "Cliente criado com sucesso!",
          description: `${nome} foi adicionado ao sistema.`,
        });

        setCredenciaisModal({
          show: true,
          email: email.trim(),
          senha: data.senha || "",
          nome: nome.trim(),
        });

        resetForm();
        setDialogOpen(false);
        fetchClientes();
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao criar cliente",
          description: data?.error || data?.details || "Resposta inesperada do servidor",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro de conexão/fetch",
        description: err instanceof Error ? err.message : JSON.stringify(err),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleAtivo = async (id: string, ativoAtual: boolean) => {
    setIsTogglingStatus(prev => ({ ...prev, [id]: true }));
  
    try {
      const { data, error } = await supabase
        .from("clientes")
        .update({ 
          ativo: !ativoAtual, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", id)
        .select("id, nome, ativo");
      
      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        toast({
          title: `Cliente ${!ativoAtual ? "ativado" : "desativado"} com sucesso!`,
        });

        setTimeout(() => {
          fetchClientes();
        }, 200);
        
      } else {
        toast({
          variant: "destructive",
          title: "Nenhum registro foi atualizado",
        });
      }
      
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar status",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsTogglingStatus(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleShowCredentials = (cliente: Cliente) => {
    if (!cliente.temp_password) {
      toast({
        variant: "destructive",
        title: "Credenciais não disponíveis",
        description: "O usuário já fez o primeiro login ou as credenciais expiraram.",
      });
      return;
    }

    setCredenciaisModal({
      show: true,
      email: cliente.email || "",
      senha: cliente.temp_password,
      nome: cliente.nome || "",
    });
  };

  const filteredClientes = useMemo(() => {
    if (!clientes) return [];
    return clientes.filter((cliente) => {
      // Filtro por status
      if (filterStatus === "ativo" && !cliente.ativo) return false;
      if (filterStatus === "inativo" && cliente.ativo) return false;
      
      // Filtro por representante
      if (filterRepresentante !== "all") {
        if (filterRepresentante === "sem-representante") {
          if (cliente.representante_id) return false;
        } else {
          if (cliente.representante_id !== filterRepresentante) return false;
        }
      }
      
      // Filtro por termo de busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          cliente.nome?.toLowerCase().includes(term) ||
          cliente.email?.toLowerCase().includes(term) ||
          cliente.cnpj_cpf?.toLowerCase().includes(term) ||
          (cliente.cidade && cliente.cidade.toLowerCase().includes(term)) ||
          (cliente.representantes?.nome && cliente.representantes.nome.toLowerCase().includes(term));
        if (!matches) return false;
      }
      return true;
    });
  }, [clientes, filterStatus, filterRepresentante, searchTerm]);

  const canCreate = hasRole("logistica") || hasRole("admin");

  // Função para limpar todos os filtros
  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterRepresentante("all");
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = searchTerm || filterStatus !== "all" || filterRepresentante !== "all";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar clientes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Gerencie os clientes do sistema"
        icon={Users}
        actions={
          canCreate && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              if (!open && isCreating) return;
              setDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary min-h-[44px] max-md:min-h-[44px]">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-hidden my-4 md:my-8 flex flex-col">
                <DialogHeader className="flex-shrink-0 pt-2 pb-3 border-b border-border pr-8">
                  <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Cadastrar Novo Cliente</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto py-4 px-1">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="nome" className="text-sm font-medium">Nome *</Label>
                        <Input
                          id="nome"
                          value={novoCliente.nome}
                          onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                          placeholder="Nome completo"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cnpj_cpf" className="text-sm font-medium">CNPJ/CPF *</Label>
                        <Input
                          id="cnpj_cpf"
                          value={novoCliente.cnpj_cpf}
                          onChange={(e) =>
                            setNovoCliente({ ...novoCliente, cnpj_cpf: maskCpfCnpjInput(e.target.value) })
                          }
                          placeholder="00.000.000/0000-00 ou 000.000.000-00"
                          maxLength={18}
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={novoCliente.email}
                          onChange={(e) => setNovoCliente({ ...novoCliente, email: e.target.value })}
                          placeholder="email@exemplo.com"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="representante_id" className="text-sm font-medium">Representante</Label>
                        <Select
                          value={novoCliente.representante_id || undefined}
                          onValueChange={(value) => setNovoCliente({ ...novoCliente, representante_id: value || "" })}
                          disabled={isCreating}
                        >
                          <SelectTrigger id="representante_id" className="min-h-[44px] max-md:min-h-[44px]">
                            <SelectValue placeholder="Selecione um representante (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {representantes.filter(rep => rep.ativo).map((rep) => (
                              <SelectItem key={rep.id} value={rep.id}>
                                <div className="flex items-center gap-2">
                                  <UserCheck className="h-4 w-4" />
                                  {rep.nome}
                                </div>
                              </SelectItem>
                            ))}
                            {representantes.filter(rep => rep.ativo).length === 0 && (
                              <SelectItem value="no-representantes" disabled>
                                Nenhum representante disponível
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {novoCliente.representante_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setNovoCliente({ ...novoCliente, representante_id: "" })}
                            className="mt-1 h-6 px-2 text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Remover representante
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="telefone" className="text-sm font-medium">Telefone</Label>
                        <Input
                          id="telefone"
                          value={novoCliente.telefone}
                          onChange={e =>
                            setNovoCliente({
                              ...novoCliente,
                              telefone: maskPhoneInput(e.target.value),
                            })
                          }
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cep" className="text-sm font-medium">CEP</Label>
                        <Input
                          id="cep"
                          value={novoCliente.cep}
                          onChange={e =>
                            setNovoCliente({ ...novoCliente, cep: maskCEPInput(e.target.value) })
                          }
                          placeholder="00000-000"
                          maxLength={9}
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="endereco" className="text-sm font-medium">Endereço</Label>
                        <Input
                          id="endereco"
                          value={novoCliente.endereco}
                          onChange={(e) => setNovoCliente({ ...novoCliente, endereco: e.target.value })}
                          placeholder="Rua, número, complemento"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cidade" className="text-sm font-medium">Cidade</Label>
                        <Input
                          id="cidade"
                          value={novoCliente.cidade}
                          onChange={(e) => setNovoCliente({ ...novoCliente, cidade: e.target.value })}
                          placeholder="Nome da cidade"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="estado" className="text-sm font-medium">Estado (UF)</Label>
                        <Select
                          value={novoCliente.estado}
                          onValueChange={(value) => setNovoCliente({ ...novoCliente, estado: value })}
                          disabled={isCreating}
                        >
                          <SelectTrigger id="estado" className="min-h-[44px] max-md:min-h-[44px]">
                            <SelectValue placeholder="Selecione o estado" />
                          </SelectTrigger>
                          <SelectContent>
                            {estadosBrasil.map((uf) => (
                              <SelectItem key={uf} value={uf}>
                                {uf}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      * Campos obrigatórios. Um usuário será criado automaticamente com uma senha temporária.
                    </p>
                  </div>
                </div>
                <DialogFooter className="flex-shrink-0 pt-4 border-t border-border bg-background flex-col-reverse gap-2 md:flex-row md:gap-0">
                  <Button 
                    variant="outline" 
                    onClick={() => setDialogOpen(false)}
                    disabled={isCreating}
                    className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px]"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    className="w-full md:w-auto bg-gradient-primary min-h-[44px] max-md:min-h-[44px]" 
                    onClick={handleCreateCliente}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar Cliente
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {/* Filtros e busca - Otimizado para mobile */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex gap-2 items-center">
              <FilterIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "ativo" | "inativo")}>
                <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] max-md:min-h-[44px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 items-center">
              <UserCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Select value={filterRepresentante} onValueChange={setFilterRepresentante}>
                <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] max-md:min-h-[44px]">
                  <SelectValue placeholder="Representante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os representantes</SelectItem>
                  <SelectItem value="sem-representante">Sem representante</SelectItem>
                  {representantes.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      <div className="flex items-center gap-2">
                        <span className={rep.ativo ? "text-foreground" : "text-muted-foreground"}>
                          {rep.nome}
                        </span>
                        {!rep.ativo && <span className="text-xs text-muted-foreground">(Inativo)</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Input
            placeholder="Buscar por nome, email, CNPJ/CPF, representante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:max-w-md min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
          />
        </div>
        
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearFilters}
            className="gap-1 self-start min-h-[44px] max-md:min-h-[44px]"
          >
            <X className="h-4 w-4" /> 
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Modal credenciais temporárias do Cliente - Otimizado */}
      <Dialog
        open={credenciaisModal.show}
        onOpenChange={(open) =>
          setCredenciaisModal(
            open
              ? credenciaisModal
              : { show: false, email: "", senha: "", nome: "" }
          )
        }
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-md max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-hidden my-4 md:my-8 flex flex-col">
          <DialogHeader className="flex-shrink-0 pt-2 pb-3 border-b border-border pr-8">
            <DialogTitle className="text-lg md:text-xl pr-2 mt-1">✅ Cliente cadastrado com sucesso!</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 px-1">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Credenciais de acesso criadas. Envie ao cliente por email ou WhatsApp.
              </p>
              <div className="rounded-lg border p-4 space-y-3 bg-muted/50">
                <p className="text-sm font-medium">Credenciais de acesso para:</p>
                <p className="text-base font-semibold">{credenciaisModal.nome}</p>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Acesse:</Label>
                    <p className="font-mono text-sm text-blue-600 break-all">{window.location.origin}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email:</Label>
                    <p className="font-mono text-sm break-all">{credenciaisModal.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Senha temporária:</Label>
                    <p className="font-mono text-sm font-bold">{credenciaisModal.senha}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  ⚠️ <strong>Importante:</strong> Envie estas credenciais ao cliente.
                  Por segurança, esta senha só aparece uma vez. O cliente será obrigado a trocar a senha no primeiro login.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t border-border bg-background flex-col-reverse gap-2 md:flex-row md:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                const baseUrl = window.location.origin;
                const texto = `Credenciais de acesso ao LogiSys\n\nAcesse: ${baseUrl}\nEmail: ${credenciaisModal.email}\nSenha: ${credenciaisModal.senha}\n\nImportante: Troque a senha no primeiro acesso.`;
                navigator.clipboard.writeText(texto);
                toast({ title: "Credenciais copiadas!" });
              }}
              className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px]"
            >
              📋 Copiar credenciais
            </Button>
            <Button 
              onClick={() => setCredenciaisModal({ show: false, email: "", senha: "", nome: "" })}
              className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🆕 ALERT DIALOG PARA SALVAR ANTES DE FECHAR */}
      <AlertDialog open={alertaSalvarAberto} onOpenChange={setAlertaSalvarAberto}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas na edição do representante. Deseja salvar antes de fechar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 md:flex-row md:gap-0">
            <AlertDialogCancel 
              onClick={handleConfirmarFechamento}
              className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px]"
            >
              Fechar sem salvar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSalvarEFechar}
              className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px]"
            >
              Salvar e fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🆕 MODAL DE DETALHES MODIFICADO COM CONTROLE DE FECHAMENTO */}
      <Dialog 
        open={!!detalhesCliente} 
        onOpenChange={(open) => {
          if (!open) {
            handleFecharModal();
          }
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-hidden my-4 md:my-8 flex flex-col">
          <DialogHeader className="flex-shrink-0 pt-2 pb-3 border-b border-border pr-8">
            <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Detalhes do Cliente</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 px-1">
            <div className="space-y-4">
              {detalhesCliente && (
                <>
                  {/* ALERTA PARA CLIENTE INATIVO */}
                  {!detalhesCliente.ativo && editandoRepresentante && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          <strong>Atenção:</strong> Este cliente está inativo. O representante só poderá acessar informações após a reativação do cliente.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Informações Básicas - Layout responsivo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Email:</Label>
                      <p className="font-semibold break-all">{detalhesCliente.email}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status:</Label>
                      <div className="mt-1">
                        <Badge variant={detalhesCliente.ativo ? "default" : "secondary"}>
                          {detalhesCliente.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CNPJ/CPF:</Label>
                      <p className="font-semibold break-all">{detalhesCliente.cnpj_cpf ? formatCpfCnpj(detalhesCliente.cnpj_cpf) : "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Telefone:</Label>
                      <p className="font-semibold">{detalhesCliente.telefone ? formatPhone(detalhesCliente.telefone) : "—"}</p>
                    </div>
                    
                    {/* SEÇÃO DE REPRESENTANTE COM EDIÇÃO */}
                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">Representante:</Label>
                        {canCreate && !editandoRepresentante && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleIniciarEdicao}
                            className="h-8 px-2 text-xs min-h-[32px]"
                          >
                            <Edit3 className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                        )}
                      </div>
                      
                      {editandoRepresentante ? (
                        // MODO DE EDIÇÃO
                        <div className="space-y-3">
                          <Select
                            value={novoRepresentanteId}
                            onValueChange={setNovoRepresentanteId}
                            disabled={salvandoRepresentante}
                          >
                            <SelectTrigger className="min-h-[44px] max-md:min-h-[44px]">
                              <SelectValue placeholder="Selecione um representante" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sem-representante">
                                <span className="text-muted-foreground">Sem representante</span>
                              </SelectItem>
                              {representantes.filter(rep => rep.ativo).map((rep) => (
                                <SelectItem key={rep.id} value={rep.id}>
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4" />
                                    {rep.nome}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              size="sm"
                              onClick={handleSalvarRepresentante}
                              disabled={salvandoRepresentante}
                              className="flex-1 min-h-[44px] max-md:min-h-[44px]"
                            >
                              {salvandoRepresentante ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Salvando...
                                </>
                              ) : (
                                <>
                                  <Save className="h-3 w-3 mr-1" />
                                  Salvar
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelarEdicao}
                              disabled={salvandoRepresentante}
                              className="flex-1 sm:flex-initial min-h-[44px] max-md:min-h-[44px]"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // MODO DE VISUALIZAÇÃO
                        <div className="mt-1">
                          {detalhesCliente.representantes ? (
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="font-semibold">{detalhesCliente.representantes.nome}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Nenhum representante atribuído</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
        
                  {/* Separador */}
                  <div className="border-t"></div>
        
                  {/* Endereço - Layout responsivo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Endereço:</Label>
                      <p className="font-semibold break-words">{detalhesCliente.endereco || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Cidade:</Label>
                      <p className="font-semibold">{detalhesCliente.cidade || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Estado:</Label>
                      <p className="font-semibold">{detalhesCliente.estado || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CEP:</Label>
                      <p className="font-semibold">{detalhesCliente.cep ? formatCEP(detalhesCliente.cep) : "—"}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t border-border bg-background flex-col-reverse gap-2 md:flex-row md:gap-0">
            {canCreate && detalhesCliente?.temp_password && (
              <Button
                variant="outline"
                onClick={() => handleShowCredentials(detalhesCliente)}
                className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px]"
                disabled={editandoRepresentante}
              >
                <Key className="h-4 w-4 mr-2" />
                Ver Credenciais
              </Button>
            )}
            <Button 
              onClick={handleFecharModal}
              disabled={editandoRepresentante}
              className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lista de clientes - Cards responsivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClientes.map((cliente) => (
          <Card
            key={cliente.id}
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => {
              setDetalhesCliente(cliente);
              resetEdicaoStates();
            }}
          >
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg leading-tight">{cliente.nome}</h3>
                <p className="text-sm text-muted-foreground break-all">{cliente.email}</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">CNPJ/CPF:</span> 
                  <span className="ml-1 break-all">{formatCpfCnpj(cliente.cnpj_cpf)}</span>
                </p>
                
                {/* Espaço reservado para representante - altura fixa */}
                <div className="h-5 flex items-center">
                  {cliente.representantes ? (
                    <div className="flex items-center gap-1">
                      <UserCheck className="h-3 w-3 text-primary flex-shrink-0" />
                      <span className="text-xs text-primary font-medium truncate">{cliente.representantes.nome}</span>
                    </div>
                  ) : (
                    <div></div>
                  )}
                </div>
              </div>
              
              {/* Separador */}
              <div className="border-t"></div>
              
              {/* Badge e switch na mesma linha */}
              {canCreate && (
                <div className="flex items-center justify-between">
                  <Badge variant={cliente.ativo ? "default" : "secondary"}>
                    {cliente.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <div className="relative">
                    <Switch
                      id={`switch-${cliente.id}`}
                      checked={cliente.ativo}
                      onCheckedChange={() => handleToggleAtivo(cliente.id, cliente.ativo)}
                      onClick={e => e.stopPropagation()}
                      disabled={isTogglingStatus[cliente.id]}
                    />
                    {isTogglingStatus[cliente.id] && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Estado vazio */}
      {filteredClientes.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? "Nenhum cliente encontrado com os filtros aplicados"
              : "Nenhum cliente cadastrado ainda"}
          </p>
          {hasActiveFilters && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearFilters}
              className="mt-2 min-h-[44px] max-md:min-h-[44px]"
            >
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Clientes;
