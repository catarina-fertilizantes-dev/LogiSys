import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, Plus, Filter as FilterIcon, Key, Loader2, X, Users, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { ModalFooter } from "@/components/ui/modal-footer";

type Representante = Database['public']['Tables']['representantes']['Row'] & {
  temp_password?: string | null;
  clientes_count?: number;
};

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
  if (!v) return "—";
  const onlyDigits = v.replace(/\D/g, "");
  if (onlyDigits.length <= 11) {
    return formatCPF(onlyDigits);
  }
  return formatCNPJ(onlyDigits);
}

function maskCpfCnpjInput(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    let cpf = digits.slice(0, 11);
    if (cpf.length > 9)
      return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})$/, "$1.$2.$3-$4");
    if (cpf.length > 6)
      return cpf.replace(/^(\d{3})(\d{3})(\d{0,3})$/, "$1.$2.$3");
    if (cpf.length > 3)
      return cpf.replace(/^(\d{3})(\d{0,3})$/, "$1.$2");
    return cpf;
  } else {
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
  if (!phone) return "—";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (cleaned.length === 10)
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return phone;
}

function maskPhoneInput(value: string): string {
  if (!value) return "";
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

const Representantes = () => {
  useScrollToTop();
  
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const { canAccess, loading: permissionsLoading } = usePermissions();

  if (!permissionsLoading && !(hasRole("admin") || hasRole("logistica"))) {
    return <Navigate to="/" replace />;
  }

  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoRepresentante, setNovoRepresentante] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    regiao_atuacao: "",
  });

  const [credenciaisModal, setCredenciaisModal] = useState({
    show: false,
    email: "",
    senha: "",
    nome: "",
  });

  const [detalhesRepresentante, setDetalhesRepresentante] = useState<Representante | null>(null);

  const [clientesModal, setClientesModal] = useState({
    show: false,
    representante: null as Representante | null,
    clientes: [] as Array<{
      id: string;
      nome: string;
      email: string;
      cnpj_cpf: string;
      ativo: boolean;
    }>,
    loading: false,
  });

  const [filterStatus, setFilterStatus] = useState<"all" | "ativo" | "inativo">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState<Record<string, boolean>>({});

  const resetForm = () => {
    setNovoRepresentante({
      nome: "",
      cpf: "",
      email: "",
      telefone: "",
      regiao_atuacao: "",
    });
  };

  const fetchRepresentantes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("representantes")
        .select(`
          *,
          temp_password
        `)
        .order("nome", { ascending: true });

      if (error) {
        setError(error.message);
        toast({
          variant: "destructive",
          title: "Erro ao carregar representantes",
          description: "Não foi possível carregar a lista de representantes.",
        });
        setLoading(false);
        return;
      }

      const representantesComContagem = await Promise.all(
        (data || []).map(async (rep) => {
          const { count } = await supabase
            .from("clientes")
            .select("*", { count: "exact", head: true })
            .eq("representante_id", rep.id)
            .eq("ativo", true);

          return {
            ...rep,
            clientes_count: count || 0
          };
        })
      );

      setRepresentantes(representantesComContagem as Representante[]);
      setLoading(false);
    } catch (err) {
      setError("Erro desconhecido");
      toast({
        variant: "destructive",
        title: "Erro ao carregar representantes",
        description: "Erro inesperado ao carregar representantes.",
      });
      setLoading(false);
    }
  };

  const fetchClientesRepresentante = async (representanteId: string, representanteNome: string) => {
    setClientesModal(prev => ({ ...prev, loading: true }));

    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, email, cnpj_cpf, ativo")
        .eq("representante_id", representanteId)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar clientes",
          description: "Não foi possível carregar os clientes do representante.",
        });
        return;
      }

      const representante = representantes.find(r => r.id === representanteId);
      
      setClientesModal({
        show: true,
        representante: representante || null,
        clientes: data || [],
        loading: false,
      });

    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar clientes",
        description: "Erro inesperado ao carregar clientes do representante.",
      });
      setClientesModal(prev => ({ ...prev, loading: false }));
    }
  };

  const canCreate = hasRole("logistica") || hasRole("admin");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [canCreate]);

  useEffect(() => {
    fetchRepresentantes();
  }, []);

  const handleCreateRepresentante = async () => {
    const { nome, cpf, email, telefone, regiao_atuacao } = novoRepresentante;
    if (!nome.trim() || !cpf.trim() || !email.trim()) {
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

      const cleanCpf = cpf.replace(/\D/g, "");
      const cleanTelefone = telefone ? telefone.replace(/\D/g, "") : null;

      const response = await fetch(`${supabaseUrl}/functions/v1/create-representante-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          cpf: cleanCpf,
          email: email.trim(),
          telefone: cleanTelefone,
          regiao_atuacao: regiao_atuacao?.trim() || null,
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
        let errorMessage = "Erro ao criar representante";
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
          title: "Erro ao criar representante",
          description: errorMessage,
        });
        return;
      }

      if (data && data.success) {
        toast({
          title: "Representante criado com sucesso!",
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
        fetchRepresentantes();
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao criar representante",
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
        .from("representantes")
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
          title: `Representante ${!ativoAtual ? "ativado" : "desativado"} com sucesso!`,
        });

        setTimeout(() => {
          fetchRepresentantes();
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

  const handleShowCredentials = (representante: Representante) => {
    if (!representante.temp_password) {
      toast({
        variant: "destructive",
        title: "Credenciais não disponíveis",
        description: "O usuário já fez o primeiro login ou as credenciais expiraram.",
      });
      return;
    }

    setCredenciaisModal({
      show: true,
      email: representante.email || "",
      senha: representante.temp_password,
      nome: representante.nome || "",
    });
  };

  const filteredRepresentantes = useMemo(() => {
    if (!representantes) return [];
    return representantes.filter((representante) => {
      if (filterStatus === "ativo" && !representante.ativo) return false;
      if (filterStatus === "inativo" && representante.ativo) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          representante.nome?.toLowerCase().includes(term) ||
          representante.email?.toLowerCase().includes(term) ||
          representante.cpf?.toLowerCase().includes(term) ||
          (representante.regiao_atuacao && representante.regiao_atuacao.toLowerCase().includes(term));
        if (!matches) return false;
      }
      return true;
    });
  }, [representantes, filterStatus, searchTerm]);

  const hasActiveFilters = searchTerm.trim() || filterStatus !== "all";

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader title="Representantes" subtitle="Carregando..." icon={UserCheck} actions={<></>} />
        <div className="flex justify-center items-center h-40">
          <div className="text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando representantes...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader title="Representantes" subtitle="Erro ao carregar dados" icon={UserCheck} actions={<></>} />
        <div className="flex justify-center items-center h-40">
          <div className="text-center">
            <p className="text-destructive">Erro ao carregar representantes</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader
        title="Representantes"
        subtitle="Gerencie os representantes do sistema"
        icon={UserCheck}
        actions={
          canCreate && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              if (!open && isCreating) return;
              setDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button className="btn-primary min-h-[44px] max-md:min-h-[44px]">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Representante
                </Button>
              </DialogTrigger>
              
              {/* Modal de Criação com Botões Não-Fixos */}
              <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
                <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
                  <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Cadastrar Novo Representante</DialogTitle>
                </DialogHeader>
                
                <div className="py-4 px-1 space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="nome" className="text-sm font-medium">Nome *</Label>
                        <Input
                          id="nome"
                          value={novoRepresentante.nome}
                          onChange={(e) => setNovoRepresentante({ ...novoRepresentante, nome: e.target.value })}
                          placeholder="Nome completo ou razão social"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cpf" className="text-sm font-medium">CPF/CNPJ *</Label>
                        <Input
                          id="cpf"
                          value={novoRepresentante.cpf}
                          onChange={(e) =>
                            setNovoRepresentante({ ...novoRepresentante, cpf: maskCpfCnpjInput(e.target.value) })
                          }
                          placeholder="000.000.000-00 ou 00.000.000/0000-00"
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
                          value={novoRepresentante.email}
                          onChange={(e) => setNovoRepresentante({ ...novoRepresentante, email: e.target.value })}
                          placeholder="email@exemplo.com"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="telefone" className="text-sm font-medium">Telefone</Label>
                        <Input
                          id="telefone"
                          value={novoRepresentante.telefone}
                          onChange={e =>
                            setNovoRepresentante({
                              ...novoRepresentante,
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
                        <Label htmlFor="regiao_atuacao" className="text-sm font-medium">Região de Atuação</Label>
                        <Input
                          id="regiao_atuacao"
                          value={novoRepresentante.regiao_atuacao}
                          onChange={(e) => setNovoRepresentante({ ...novoRepresentante, regiao_atuacao: e.target.value })}
                          placeholder="Ex: São Paulo, Rio de Janeiro"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      * Campos obrigatórios. Um usuário será criado automaticamente com uma senha temporária.
                    </p>
                  </div>

                  {/* Botões no final do conteúdo */}
                  <ModalFooter 
                    variant="double"
                    onClose={() => setDialogOpen(false)}
                    onConfirm={handleCreateRepresentante}
                    confirmText="Criar Representante"
                    confirmIcon={<Plus className="h-4 w-4" />}
                    isLoading={isCreating}
                  />
                </div>
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
                <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] max-md:min-h-[44px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Input
            placeholder="Buscar por nome, email, CPF/CNPJ, região..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:max-w-md min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
          />
        </div>
        
        {hasActiveFilters && (
          <Button 
            size="sm" 
            onClick={handleClearFilters}
            className="gap-1 self-start min-h-[44px] max-md:min-h-[44px] btn-secondary"
          >
            <X className="h-4 w-4" /> 
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Modal de credenciais com botões não-fixos */}
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
        <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-md max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
          <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
            <DialogTitle className="text-lg md:text-xl pr-2 mt-1">✅ Representante cadastrado com sucesso!</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 px-1 space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Credenciais de acesso criadas. Envie ao representante por email ou WhatsApp.
              </p>
              <div className="rounded-lg border p-4 space-y-3 bg-muted/50">
                <p className="text-sm font-medium">Credenciais de acesso para:</p>
                <p className="text-base font-semibold break-words">{credenciaisModal.nome}</p>
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
                  ⚠️ <strong>Importante:</strong> Envie estas credenciais ao representante.
                  Por segurança, esta senha só aparece uma vez. O representante será obrigado a trocar a senha no primeiro login.
                </p>
              </div>
            </div>

            {/* Botões no final do conteúdo */}
            <ModalFooter 
              variant="double"
              onClose={() => setCredenciaisModal({ show: false, email: "", senha: "", nome: "" })}
              onConfirm={() => {
                const baseUrl = window.location.origin;
                const texto = `Credenciais de acesso ao LogiSys\n\nAcesse: ${baseUrl}\nEmail: ${credenciaisModal.email}\nSenha: ${credenciaisModal.senha}\n\nImportante: Troque a senha no primeiro acesso.`;
                navigator.clipboard.writeText(texto);
                toast({ title: "Credenciais copiadas!" });
              }}
              confirmText="📋 Copiar credenciais"
              cancelText="Fechar"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de clientes com botões não-fixos */}
      <Dialog 
        open={clientesModal.show} 
        onOpenChange={(open) => !open && setClientesModal({ show: false, representante: null, clientes: [], loading: false })}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-4xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
          <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
            <DialogTitle className="text-lg md:text-xl pr-2 mt-1 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clientes Ativos do Representante
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 px-1 space-y-6">
            {clientesModal.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Carregando clientes...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground break-words">
                  {clientesModal.representante?.nome} - {clientesModal.clientes.length} cliente(s)
                </p>
                {clientesModal.clientes.length > 0 ? (
                  <>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        💡 <strong>Dica:</strong> Para alterar o representante de um cliente, acesse a página <strong>Clientes</strong> e edite no modal de detalhes do cliente.
                      </p>
                    </div>
                    
                    <div className="grid gap-3">
                      {clientesModal.clientes.map((cliente) => (
                        <Card key={cliente.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold break-words">{cliente.nome}</h4>
                              <p className="text-sm text-muted-foreground break-all">{cliente.email}</p>
                              <p className="text-sm text-muted-foreground">
                                CNPJ/CPF: {formatCpfCnpj(cliente.cnpj_cpf)}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Nenhum cliente ativo atribuído a este representante
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Para atribuir clientes, acesse a página <strong>Clientes</strong> e selecione o representante no modal de detalhes.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Botão no final do conteúdo */}
            <ModalFooter 
              variant="single"
              onClose={() => setClientesModal({ show: false, representante: null, clientes: [], loading: false })}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de detalhes com botões não-fixos */}
      <Dialog open={!!detalhesRepresentante} onOpenChange={open => !open && setDetalhesRepresentante(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
          <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
            <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Detalhes do Representante</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 px-1 space-y-6">
            <div className="space-y-4">
              {detalhesRepresentante && (
                <>
                  <p className="text-sm text-muted-foreground break-words">
                    {detalhesRepresentante?.nome}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Email:</Label>
                      <p className="font-semibold text-sm md:text-base break-all">{detalhesRepresentante.email}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status:</Label>
                      <div className="mt-1">
                        <Badge variant={detalhesRepresentante.ativo ? "default" : "secondary"}>
                          {detalhesRepresentante.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CPF/CNPJ:</Label>
                      <p className="font-semibold text-sm md:text-base break-all">{detalhesRepresentante.cpf ? formatCpfCnpj(detalhesRepresentante.cpf) : "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Telefone:</Label>
                      <p className="font-semibold text-sm md:text-base">{detalhesRepresentante.telefone ? formatPhone(detalhesRepresentante.telefone) : "—"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Região de Atuação:</Label>
                      <p className="font-semibold text-sm md:text-base break-words">{detalhesRepresentante.regiao_atuacao || "—"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Clientes Atribuídos:</Label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-1">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {detalhesRepresentante.clientes_count || 0} cliente(s)
                        </Badge>
                        {(detalhesRepresentante.clientes_count || 0) > 0 && (
                          <Button
                            size="sm"
                            onClick={() => fetchClientesRepresentante(detalhesRepresentante.id, detalhesRepresentante.nome)}
                            className="text-xs min-h-[44px] max-md:min-h-[44px] btn-secondary"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver Clientes
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Botões no final do conteúdo */}
            {canCreate && detalhesRepresentante?.temp_password ? (
              <ModalFooter 
                variant="double"
                onClose={() => setDetalhesRepresentante(null)}
                onConfirm={() => handleShowCredentials(detalhesRepresentante)}
                confirmText="Ver Credenciais"
                confirmIcon={<Key className="h-4 w-4" />}
                cancelText="Fechar"
              />
            ) : (
              <ModalFooter 
                variant="single"
                onClose={() => setDetalhesRepresentante(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista de representantes - Cards responsivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRepresentantes.map((representante) => (
          <Card
            key={representante.id}
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => setDetalhesRepresentante(representante)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <h3 className="font-semibold text-base md:text-lg leading-tight break-words">{representante.nome}</h3>
                <p className="text-sm text-muted-foreground break-all">{representante.email}</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">CPF/CNPJ:</span> 
                  <span className="ml-1 break-all">{formatCpfCnpj(representante.cpf)}</span>
                </p>
                
                {/* Espaço reservado para clientes - altura fixa */}
                <div className="h-6 flex items-center">
                  {(representante.clientes_count || 0) > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchClientesRepresentante(representante.id, representante.nome);
                      }}
                      className="h-6 px-1 text-xs text-primary hover:text-primary-foreground min-h-[44px] max-md:min-h-[44px]"
                    >
                      <Users className="h-3 w-3 mr-1" />
                      {representante.clientes_count} cliente(s)
                    </Button>
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
                  <Badge variant={representante.ativo ? "default" : "secondary"}>
                    {representante.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <div className="relative min-h-[44px] max-md:min-h-[44px] flex items-center">
                    <Switch
                      id={`switch-${representante.id}`}
                      checked={representante.ativo}
                      onCheckedChange={() => handleToggleAtivo(representante.id, representante.ativo)}
                      onClick={e => e.stopPropagation()}
                      disabled={isTogglingStatus[representante.id]}
                      className="data-[state=checked]:bg-primary"
                    />
                    {isTogglingStatus[representante.id] && (
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
      {filteredRepresentantes.length === 0 && (
        <div className="text-center py-12">
          <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? "Nenhum representante encontrado com os filtros aplicados"
              : "Nenhum representante cadastrado ainda"}
          </p>
          {hasActiveFilters && (
            <Button 
              size="sm" 
              onClick={handleClearFilters}
              className="mt-2 min-h-[44px] max-md:min-h-[44px] btn-secondary"
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

export default Representantes;
