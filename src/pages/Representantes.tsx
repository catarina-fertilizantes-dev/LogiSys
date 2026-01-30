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
  DialogFooter,
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

type Representante = Database['public']['Tables']['representantes']['Row'] & {
  temp_password?: string | null;
  clientes_count?: number;
};

// 🔧 HELPERS DE FORMATAÇÃO SEGUROS (baseados no código de Clientes)
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

  // 🔧 FORMULÁRIO USANDO CAMPO EXISTENTE (cpf) - mantendo compatibilidade com backend
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoRepresentante, setNovoRepresentante] = useState({
    nome: "",
    cpf: "", // 🔧 Mantendo 'cpf' para compatibilidade com backend existente
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

  // MODAL PARA VISUALIZAR CLIENTES ATIVOS
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

  // Estados de loading
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

  // 🔧 FUNÇÃO PARA BUSCAR REPRESENTANTES COM CONTAGEM DE CLIENTES ATIVOS
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

      // 🔧 BUSCAR CONTAGEM DE CLIENTES ATIVOS SEPARADAMENTE
      const representantesComContagem = await Promise.all(
        (data || []).map(async (rep) => {
          const { count } = await supabase
            .from("clientes")
            .select("*", { count: "exact", head: true })
            .eq("representante_id", rep.id)
            .eq("ativo", true); // 🔧 Apenas clientes ativos

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

  // 🔧 FUNÇÃO PARA VISUALIZAR APENAS CLIENTES ATIVOS
  const fetchClientesRepresentante = async (representanteId: string, representanteNome: string) => {
    setClientesModal(prev => ({ ...prev, loading: true }));

    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, email, cnpj_cpf, ativo")
        .eq("representante_id", representanteId)
        .eq("ativo", true) // 🔧 Apenas clientes ativos
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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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

      // 🔧 LIMPAR DADOS ANTES DE ENVIAR
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
          cpf: cleanCpf, // 🔧 Usando 'cpf' para compatibilidade com backend
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

  // Verificar se há filtros ativos
  const hasActiveFilters = searchTerm.trim() || filterStatus !== "all";

  const canCreate = hasRole("logistica") || hasRole("admin");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando representantes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar representantes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
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
                <Button className="bg-gradient-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Representante
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Representante</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do representante. Um usuário de acesso será criado automaticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={novoRepresentante.nome}
                        onChange={(e) => setNovoRepresentante({ ...novoRepresentante, nome: e.target.value })}
                        placeholder="Nome completo ou razão social"
                        disabled={isCreating}
                      />
                    </div>
                    <div>
                      {/* 🔧 CAMPO PARA CPF/CNPJ COM MÁSCARA AUTOMÁTICA */}
                      <Label htmlFor="cpf">CPF/CNPJ *</Label>
                      <Input
                        id="cpf"
                        value={novoRepresentante.cpf}
                        onChange={(e) =>
                          setNovoRepresentante({ ...novoRepresentante, cpf: maskCpfCnpjInput(e.target.value) })
                        }
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        maxLength={18}
                        disabled={isCreating}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={novoRepresentante.email}
                        onChange={(e) => setNovoRepresentante({ ...novoRepresentante, email: e.target.value })}
                        placeholder="email@exemplo.com"
                        disabled={isCreating}
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone</Label>
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
                      />
                    </div>
                    <div>
                      <Label htmlFor="regiao_atuacao">Região de Atuação</Label>
                      <Input
                        id="regiao_atuacao"
                        value={novoRepresentante.regiao_atuacao}
                        onChange={(e) => setNovoRepresentante({ ...novoRepresentante, regiao_atuacao: e.target.value })}
                        placeholder="Ex: São Paulo, Rio de Janeiro"
                        disabled={isCreating}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    * Campos obrigatórios. Um usuário será criado automaticamente com uma senha temporária.
                  </p>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setDialogOpen(false)}
                    disabled={isCreating}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    className="bg-gradient-primary" 
                    onClick={handleCreateRepresentante}
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
                        Criar Representante
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {/* Filtros e busca */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="flex gap-2 items-center">
            <FilterIcon className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "ativo" | "inativo")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Buscar por nome, email, CPF/CNPJ, região..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSearchTerm("");
                setFilterStatus("all");
              }}
              className="gap-1"
            >
              <X className="h-4 w-4" /> 
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* Modal credenciais temporárias */}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>✅ Representante cadastrado com sucesso!</DialogTitle>
            <DialogDescription>
              Credenciais de acesso criadas. Envie ao representante por email ou WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border p-4 space-y-3 bg-muted/50">
              <p className="text-sm font-medium">Credenciais de acesso para:</p>
              <p className="text-base font-semibold">{credenciaisModal.nome}</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Acesse:</Label>
                  <p className="font-mono text-sm text-blue-600">{window.location.origin}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email:</Label>
                  <p className="font-mono text-sm">{credenciaisModal.email}</p>
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
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const baseUrl = window.location.origin;
                const texto = `Credenciais de acesso ao LogiSys\n\nAcesse: ${baseUrl}\nEmail: ${credenciaisModal.email}\nSenha: ${credenciaisModal.senha}\n\nImportante: Troque a senha no primeiro acesso.`;
                navigator.clipboard.writeText(texto);
                toast({ title: "Credenciais copiadas!" });
              }}
            >
              📋 Copiar credenciais
            </Button>
            <Button onClick={() => setCredenciaisModal({ show: false, email: "", senha: "", nome: "" })}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔧 MODAL PARA VISUALIZAR APENAS CLIENTES ATIVOS */}
      <Dialog 
        open={clientesModal.show} 
        onOpenChange={(open) => !open && setClientesModal({ show: false, representante: null, clientes: [], loading: false })}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clientes Ativos do Representante
            </DialogTitle>
            <DialogDescription>
              {clientesModal.representante?.nome} - {clientesModal.clientes.length} cliente(s)
            </DialogDescription>
          </DialogHeader>
          
          {clientesModal.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Carregando clientes...</span>
            </div>
          ) : (
            <div className="space-y-4 py-4">
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
                          <div className="flex-1">
                            <h4 className="font-semibold">{cliente.nome}</h4>
                            <p className="text-sm text-muted-foreground">{cliente.email}</p>
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
          
          <DialogFooter>
            <Button onClick={() => setClientesModal({ show: false, representante: null, clientes: [], loading: false })}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de detalhes do representante */}
      <Dialog open={!!detalhesRepresentante} onOpenChange={open => !open && setDetalhesRepresentante(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Representante</DialogTitle>
            <DialogDescription>
              {detalhesRepresentante?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {detalhesRepresentante && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Email:</Label>
                    <p className="font-semibold">{detalhesRepresentante.email}</p>
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
                    <p className="font-semibold">{detalhesRepresentante.cpf ? formatCpfCnpj(detalhesRepresentante.cpf) : "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Telefone:</Label>
                    <p className="font-semibold">{detalhesRepresentante.telefone ? formatPhone(detalhesRepresentante.telefone) : "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Região de Atuação:</Label>
                    <p className="font-semibold">{detalhesRepresentante.regiao_atuacao || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Clientes Atribuídos:</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {detalhesRepresentante.clientes_count || 0} cliente(s)
                      </Badge>
                      {(detalhesRepresentante.clientes_count || 0) > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchClientesRepresentante(detalhesRepresentante.id, detalhesRepresentante.nome)}
                          className="text-xs"
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
          <DialogFooter className="flex gap-2">
            {canCreate && detalhesRepresentante?.temp_password && (
              <Button
                variant="outline"
                onClick={() => handleShowCredentials(detalhesRepresentante)}
                className="flex-1"
              >
                <Key className="h-4 w-4 mr-2" />
                Ver Credenciais
              </Button>
            )}
            <Button onClick={() => setDetalhesRepresentante(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔧 LISTA DE REPRESENTANTES COM LAYOUT MODIFICADO SEGUINDO O PADRÃO DE CLIENTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRepresentantes.map((representante) => (
          <Card
            key={representante.id}
            className="cursor-pointer transition-all"
            onClick={() => setDetalhesRepresentante(representante)}
          >
            <CardContent className="p-4 space-y-3">
              {/* 🔧 LAYOUT MODIFICADO SEGUINDO O PADRÃO DE CLIENTES */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{representante.nome}</h3>
                <p className="text-sm text-muted-foreground">{representante.email}</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">CPF/CNPJ:</span> {formatCpfCnpj(representante.cpf)}
                </p>
                
                {/* 🔧 ESPAÇO RESERVADO PARA NÚMERO DE CLIENTES - ALTURA FIXA */}
                <div className="h-5 flex items-center">
                  {(representante.clientes_count || 0) > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchClientesRepresentante(representante.id, representante.nome);
                      }}
                      className="h-5 px-1 text-xs text-primary hover:text-primary-foreground"
                    >
                      <Users className="h-3 w-3 mr-1" />
                      {representante.clientes_count} cliente(s)
                    </Button>
                  ) : (
                    <div></div> // 🔧 DIV VAZIA PARA MANTER ALTURA
                  )}
                </div>
              </div>
              
              {/* Separador */}
              <div className="border-t"></div>
              
              {/* 🔧 BADGE E SWITCH NA MESMA LINHA */}
              {canCreate && (
                <div className="flex items-center justify-between">
                  <Badge variant={representante.ativo ? "default" : "secondary"}>
                    {representante.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <div className="relative">
                    <Switch
                      id={`switch-${representante.id}`}
                      checked={representante.ativo}
                      onCheckedChange={() => handleToggleAtivo(representante.id, representante.ativo)}
                      onClick={e => e.stopPropagation()}
                      disabled={isTogglingStatus[representante.id]}
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
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSearchTerm("");
                setFilterStatus("all");
              }}
              className="mt-2"
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
