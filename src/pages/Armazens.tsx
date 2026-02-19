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
import { Warehouse, Plus, Filter as FilterIcon, Key, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { ModalFooter } from "@/components/ui/modal-footer";
import type { Database } from "@/integrations/supabase/types";

// Helpers de máscara e formatação
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
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (cleaned.length === 10)
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return phone;
}
function maskCEPInput(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 8);
  if (cleaned.length > 5)
    return cleaned.replace(/^(\d{5})(\d{0,3})$/, "$1-$2");
  return cleaned;
}
function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, "").slice(0, 8);
  if (cleaned.length === 8)
    return cleaned.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return cep;
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
function formatCpfCnpj(v: string): string {
  const onlyDigits = v.replace(/\D/g, "");
  if (onlyDigits.length <= 11) {
    return onlyDigits.padStart(11, "0").replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return onlyDigits.padStart(14, "0").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

type Armazem = {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  email: string;
  telefone?: string | null;
  endereco?: string | null;
  capacidade_total?: number | null;
  capacidade_disponivel?: number | null;
  ativo: boolean;
  created_at: string;
  updated_at?: string | null;
  cep?: string | null;
  cnpj_cpf?: string | null;
  user_id?: string | null;
  temp_password?: string | null;
};

const Armazens = () => {
  useScrollToTop();
  
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const { canAccess, loading: permissionsLoading } = usePermissions();

  if (!permissionsLoading && !(hasRole("admin") || hasRole("logistica"))) {
    return <Navigate to="/" replace />;
  }

  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoArmazem, setNovoArmazem] = useState({
    nome: "",
    cidade: "",
    estado: "",
    email: "",
    telefone: "",
    endereco: "",
    capacidade_total: "",
    cep: "",
    cnpj_cpf: "",
  });

  const [credenciaisModal, setCredenciaisModal] = useState({
    show: false,
    email: "",
    senha: "",
    nome: "",
  });

  const [detalhesArmazem, setDetalhesArmazem] = useState<Armazem | null>(null);

  const [filterStatus, setFilterStatus] = useState<"all" | "ativo" | "inativo">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState<Record<string, boolean>>({});

  const resetForm = () => {
    setNovoArmazem({
      nome: "",
      cidade: "",
      estado: "",
      email: "",
      telefone: "",
      endereco: "",
      capacidade_total: "",
      cep: "",
      cnpj_cpf: "",
    });
  };

  const fetchArmazens = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("armazens")
        .select("*, temp_password")
        .order("cidade", { ascending: true });
      if (error) {
        setError(error.message);
        toast({
          variant: "destructive",
          title: "Erro ao carregar armazéns",
          description: "Não foi possível carregar os armazéns.",
        });
        setLoading(false);
        return;
      }
      setArmazens(data as Armazem[]);
      setLoading(false);
    } catch (err) {
      setError("Erro desconhecido");
      toast({
        variant: "destructive",
        title: "Erro ao carregar armazéns",
        description: "Erro inesperado ao carregar armazéns.",
      });
      setLoading(false);
    }
  };

  const canCreate = hasRole("admin") || hasRole("logistica");

  useEffect(() => {
    fetchArmazens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [canCreate]);

  const handleCreateArmazem = async () => {
    const { nome, cidade, estado, email, telefone, endereco, capacidade_total, cep, cnpj_cpf } = novoArmazem;
    if (!nome.trim() || !cidade.trim() || !estado.trim() || !email.trim() || !cnpj_cpf.trim()) {
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
      let capacidadeTotalNumber: number | undefined = undefined;
      if (capacidade_total && capacidade_total.trim()) {
        capacidadeTotalNumber = parseFloat(capacidade_total);
        if (isNaN(capacidadeTotalNumber) || capacidadeTotalNumber < 0) {
          toast({
            variant: "destructive",
            title: "Capacidade inválida",
            description: "A capacidade deve ser um número positivo",
          });
          return;
        }
      }

      const cleanTelefone = telefone ? telefone.replace(/\D/g, "") : undefined;
      const cleanCep = cep ? cep.replace(/\D/g, "") : undefined;
      const cleanCnpjCpf = cnpj_cpf.replace(/\D/g, "");

      const response = await fetch(`${supabaseUrl}/functions/v1/create-armazem-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          cidade: cidade.trim(),
          estado: estado.trim(),
          telefone: cleanTelefone,
          endereco: endereco?.trim() || undefined,
          capacidade_total: capacidadeTotalNumber,
          cep: cleanCep,
          cnpj_cpf: cleanCnpjCpf,
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
        let errorMessage = "Erro ao criar armazém";
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
                      : msg)
              .join(" | ");
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
          title: "Erro ao criar armazém",
          description: errorMessage,
        });
        return;
      }

      if (data && data.success) {
        toast({
          title: "Armazém criado com sucesso!",
          description: `${nome} foi adicionado ao sistema.`,
        });

        await fetchArmazens();

        setCredenciaisModal({
          show: true,
          email: email.trim(),
          senha: data.senha || "",
          nome: nome.trim(),
        });

        resetForm();
        setDialogOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao criar armazém",
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
      const { error } = await supabase
        .from("armazens")
        .update({ ativo: !ativoAtual, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({
        title: `Armazém ${!ativoAtual ? "ativado" : "desativado"} com sucesso!`,
      });
      fetchArmazens();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar status",
      });
    } finally {
      setIsTogglingStatus(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleShowCredentials = (armazem: Armazem) => {
    if (!armazem.temp_password) {
      toast({
        variant: "destructive",
        title: "Credenciais não disponíveis",
        description: "O usuário já fez o primeiro login ou as credenciais expiraram.",
      });
      return;
    }

    setCredenciaisModal({
      show: true,
      email: armazem.email || "",
      senha: armazem.temp_password,
      nome: armazem.nome || "",
    });
  };

  const filteredArmazens = useMemo(() => {
    if (!armazens) return [];
    return armazens.filter((armazem) => {
      if (filterStatus === "ativo" && !armazem.ativo) return false;
      if (filterStatus === "inativo" && armazem.ativo) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          armazem.nome?.toLowerCase().includes(term) ||
          armazem.cidade?.toLowerCase().includes(term) ||
          armazem.estado?.toLowerCase().includes(term) ||
          armazem.email?.toLowerCase().includes(term) ||
          (armazem.cnpj_cpf && armazem.cnpj_cpf.toLowerCase().includes(term));
        if (!matches) return false;
      }
      return true;
    });
  }, [armazens, filterStatus, searchTerm]);
  
  const hasActiveFilters = searchTerm.trim() || filterStatus !== "all";

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando armazéns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar armazéns</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader
        title="Armazéns"
        subtitle="Gerencie os armazéns do sistema"
        icon={Warehouse}
        actions={
          canCreate && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              if (!open && isCreating) return;
              setDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button className="btn-primary min-h-[44px] max-md:min-h-[44px]">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Armazém
                </Button>
              </DialogTrigger>
              
              {/* Modal de Criação com Botões Não-Fixos */}
              <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
                <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
                  <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Cadastrar Novo Armazém</DialogTitle>
                </DialogHeader>
                
                <div className="py-4 px-1 space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="nome" className="text-sm font-medium">Nome *</Label>
                        <Input
                          id="nome"
                          value={novoArmazem.nome}
                          onChange={(e) => setNovoArmazem({ ...novoArmazem, nome: e.target.value })}
                          placeholder="Nome do armazém"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cidade" className="text-sm font-medium">Cidade *</Label>
                        <Input
                          id="cidade"
                          value={novoArmazem.cidade}
                          onChange={(e) => setNovoArmazem({ ...novoArmazem, cidade: e.target.value })}
                          placeholder="Cidade"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="estado" className="text-sm font-medium">Estado (UF) *</Label>
                        <Select
                          value={novoArmazem.estado}
                          onValueChange={(value) => setNovoArmazem({ ...novoArmazem, estado: value })}
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
                      <div>
                        <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={novoArmazem.email}
                          onChange={(e) => setNovoArmazem({ ...novoArmazem, email: e.target.value })}
                          placeholder="email@exemplo.com"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cnpj_cpf" className="text-sm font-medium">CNPJ/CPF *</Label>
                        <Input
                          id="cnpj_cpf"
                          value={novoArmazem.cnpj_cpf}
                          onChange={(e) =>
                            setNovoArmazem({ ...novoArmazem, cnpj_cpf: maskCpfCnpjInput(e.target.value) })
                          }
                          placeholder="00.000.000/0000-00 ou 000.000.000-00"
                          maxLength={18}
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="telefone" className="text-sm font-medium">Telefone</Label>
                        <Input
                          id="telefone"
                          value={novoArmazem.telefone}
                          onChange={(e) =>
                            setNovoArmazem({
                              ...novoArmazem,
                              telefone: maskPhoneInput(e.target.value),
                            })
                          }
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="endereco" className="text-sm font-medium">Endereço</Label>
                        <Input
                          id="endereco"
                          value={novoArmazem.endereco}
                          onChange={(e) => setNovoArmazem({ ...novoArmazem, endereco: e.target.value })}
                          placeholder="Rua, número, complemento"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cep" className="text-sm font-medium">CEP</Label>
                        <Input
                          id="cep"
                          value={novoArmazem.cep}
                          onChange={(e) =>
                            setNovoArmazem({
                              ...novoArmazem,
                              cep: maskCEPInput(e.target.value),
                            })
                          }
                          placeholder="00000-000"
                          maxLength={9}
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="capacidade_total" className="text-sm font-medium">Capacidade Total (toneladas)</Label>
                        <Input
                          id="capacidade_total"
                          type="number"
                          value={novoArmazem.capacidade_total}
                          onChange={(e) => setNovoArmazem({ ...novoArmazem, capacidade_total: e.target.value })}
                          placeholder="Ex: 1000"
                          disabled={isCreating}
                          className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      * Campos obrigatórios. Um usuário será criado automaticamente com uma senha temporária.
                    </p>
                  </div>

                  {/* Adicionar import do ModalFooter no topo do arquivo */}
                  <ModalFooter 
                    variant="double"
                    onClose={() => setDialogOpen(false)}
                    onConfirm={handleCreateArmazem}
                    confirmText="Criar Armazém"
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
          <Input
            placeholder="Buscar por nome, cidade, estado, email ou CNPJ/CPF..."
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
            <DialogTitle className="text-lg md:text-xl pr-2 mt-1">✅ Armazém cadastrado com sucesso!</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 px-1 space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Credenciais de acesso criadas. Envie ao responsável por email ou WhatsApp.
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
                  ⚠️ <strong>Importante:</strong> Envie estas credenciais ao responsável.
                  Por segurança, esta senha só aparece uma vez. O usuário será obrigado a trocar a senha no primeiro login.
                </p>
              </div>
            </div>

            {/* Botões no final do conteúdo */}
            <div className="pt-4 border-t border-border bg-background flex flex-col-reverse gap-2 md:flex-row md:gap-0 md:justify-end">
              <Button
                onClick={() => {
                  const baseUrl = window.location.origin;
                  const texto = `Credenciais de acesso ao LogiSys\n\nAcesse: ${baseUrl}\nEmail: ${credenciaisModal.email}\nSenha: ${credenciaisModal.senha}\n\nImportante: Troque a senha no primeiro acesso.`;
                  navigator.clipboard.writeText(texto);
                  toast({ title: "Credenciais copiadas!" });
                }}
                className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px] md:mr-2 btn-secondary"
              >
                �� Copiar credenciais
              </Button>
              <Button 
                onClick={() => setCredenciaisModal({ show: false, email: "", senha: "", nome: "" })}
                className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px] btn-primary"
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de detalhes com botões não-fixos */}
      <Dialog open={!!detalhesArmazem} onOpenChange={open => !open && setDetalhesArmazem(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
          <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
            <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Detalhes do Armazém</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 px-1 space-y-6">
            <div className="space-y-4">
              {detalhesArmazem && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {detalhesArmazem?.nome}
                  </p>
                  {/* Informações Básicas - Layout responsivo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Email:</Label>
                      <p className="font-semibold break-all">{detalhesArmazem.email ?? "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status:</Label>
                      <div className="mt-1">
                        <Badge variant={detalhesArmazem.ativo ? "default" : "secondary"}>
                          {detalhesArmazem.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CNPJ/CPF:</Label>
                      <p className="font-semibold break-all">{detalhesArmazem.cnpj_cpf ? formatCpfCnpj(detalhesArmazem.cnpj_cpf) : "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Telefone:</Label>
                      <p className="font-semibold">{detalhesArmazem.telefone ? formatPhone(detalhesArmazem.telefone) : "—"}</p>
                    </div>
                  </div>
        
                  {/* Separador */}
                  <div className="border-t"></div>
        
                  {/* Localização - Layout responsivo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cidade:</Label>
                      <p className="font-semibold">{detalhesArmazem.cidade || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Estado:</Label>
                      <p className="font-semibold">{detalhesArmazem.estado || "—"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Endereço:</Label>
                      <p className="font-semibold break-words">{detalhesArmazem.endereco || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CEP:</Label>
                      <p className="font-semibold">{detalhesArmazem.cep ? formatCEP(detalhesArmazem.cep) : "—"}</p>
                    </div>
                  </div>
        
                  {/* Separador */}
                  <div className="border-t"></div>
        
                  {/* Capacidade - Layout responsivo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Capacidade Total:</Label>
                      <p className="font-semibold">{detalhesArmazem.capacidade_total ?? "—"} t</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Capacidade Disponível:</Label>
                      <p className="font-semibold">{detalhesArmazem.capacidade_disponivel ?? "—"} t</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Botões no final do conteúdo */}
            <div className="pt-4 border-t border-border bg-background flex flex-col-reverse gap-2 md:flex-row md:gap-0 md:justify-end">
              {canCreate && detalhesArmazem?.temp_password && (
                <Button
                  onClick={() => handleShowCredentials(detalhesArmazem)}
                  className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px] md:mr-2 btn-secondary"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Ver Credenciais
                </Button>
              )}
              <Button 
                onClick={() => setDetalhesArmazem(null)}
                className="w-full md:w-auto min-h-[44px] max-md:min-h-[44px] btn-primary"
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grid de armazéns - Cards responsivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {filteredArmazens.map((armazem) => (
          <Card
            key={armazem.id}
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => setDetalhesArmazem(armazem)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg leading-tight">{armazem.nome}</h3>
                  <p className="text-sm text-muted-foreground">{armazem.cidade}/{armazem.estado}</p>
                </div>
                <div className="flex flex-col gap-2 items-end ml-2">
                  {canCreate && armazem.temp_password && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowCredentials(armazem);
                      }}
                      className="text-xs min-h-[32px] btn-secondary"
                    >
                      <Key className="h-3 w-3 mr-1" />
                      Credenciais
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p className="break-all">
                  <span className="text-muted-foreground">Email:</span> {armazem.email ?? "—"}
                </p>
                {armazem.telefone && (
                  <p>
                    <span className="text-muted-foreground">Telefone:</span> {formatPhone(armazem.telefone)}
                  </p>
                )}
                {armazem.cep && (
                  <p>
                    <span className="text-muted-foreground">CEP:</span> {formatCEP(armazem.cep)}
                  </p>
                )}
                {armazem.cnpj_cpf && (
                  <p className="break-all">
                    <span className="text-muted-foreground">CNPJ/CPF:</span> {formatCpfCnpj(armazem.cnpj_cpf)}
                  </p>
                )}
              </div>
              {canCreate && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <Badge variant={armazem.ativo ? "default" : "secondary"}>
                    {armazem.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <div className="relative">
                    <Switch
                      id={`switch-${armazem.id}`}
                      checked={armazem.ativo}
                      onCheckedChange={() => handleToggleAtivo(armazem.id, armazem.ativo)}
                      onClick={e => e.stopPropagation()}
                      disabled={isTogglingStatus[armazem.id]}
                    />
                    {isTogglingStatus[armazem.id] && (
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
      {filteredArmazens.length === 0 && (
        <div className="text-center py-12">
          <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? "Nenhum armazém encontrado com os filtros aplicados"
              : "Nenhum armazém cadastrado ainda"}
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

export default Armazens;
