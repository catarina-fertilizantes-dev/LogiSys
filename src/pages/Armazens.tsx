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
import { Warehouse, Plus, Filter as FilterIcon, Key, Loader2 } from "lucide-react";
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

const Armazens = () => {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const { canAccess, loading: permissionsLoading } = usePermissions();

  if (!permissionsLoading && !(hasRole("admin") || hasRole("logistica"))) {
    return <Navigate to="/" replace />;
  }

  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ FORMULÁRIO COM ORDEM CORRETA DOS CAMPOS
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoArmazem, setNovoArmazem] = useState({
    nome: "",
    cidade: "",
    estado: "",
    email: "",
    cnpj_cpf: "",
    telefone: "",
    endereco: "",
    cep: "",
    capacidade_total: "",
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

  // 🚀 NOVOS ESTADOS DE LOADING
  const [isCreating, setIsCreating] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState<Record<string, boolean>>({});

  const resetForm = () => {
    setNovoArmazem({
      nome: "",
      cidade: "",
      estado: "",
      email: "",
      cnpj_cpf: "",
      telefone: "",
      endereco: "",
      cep: "",
      capacidade_total: "",
    });
  };

  const fetchArmazens = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("armazens")
        .select("*, temp_password")
        .order("nome", { ascending: true });
      if (error) {
        setError(error.message);
        toast({
          variant: "destructive",
          title: "Erro ao carregar armazéns",
          description: "Não foi possível carregar a lista de armazéns.",
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

  useEffect(() => {
    // Detectar se deve abrir o modal automaticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      // Limpar o parâmetro da URL sem recarregar a página
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [canCreate]);
  
  useEffect(() => {
    fetchArmazens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateArmazem = async () => {
    const { nome, cidade, estado, email, cnpj_cpf, telefone, endereco, cep, capacidade_total } = novoArmazem;
    
    // ✅ VALIDAÇÃO CORRIGIDA - CAMPOS OBRIGATÓRIOS CONFORME EDGE FUNCTION
    if (!nome.trim() || !cidade.trim() || !estado.trim() || !email.trim() || !cnpj_cpf.trim()) {
      toast({
        variant: "destructive",
        title: "Preencha os campos obrigatórios",
        description: "Nome, Cidade, Estado, Email e CNPJ/CPF são obrigatórios.",
      });
      return;
    }

    // 🚀 ATIVAR LOADING STATE
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
      const cleanCnpjCpf = cnpj_cpf.replace(/\D/g, "");
      const cleanTelefone = telefone ? telefone.replace(/\D/g, "") : null;
      const cleanCep = cep ? cep.replace(/\D/g, "") : null;
      
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

      // ✅ PAYLOAD CORRIGIDO - GARANTIR QUE CAMPOS OBRIGATÓRIOS SEJAM STRINGS
      const response = await fetch(`${supabaseUrl}/functions/v1/create-armazem-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          nome: nome.trim(),                    // ✅ string obrigatória
          cidade: cidade.trim(),                // ✅ string obrigatória
          estado: estado.trim(),                // ✅ string obrigatória (2 chars)
          email: email.trim(),                  // ✅ string obrigatória
          cnpj_cpf: cleanCnpjCpf,              // ✅ string obrigatória
          telefone: cleanTelefone,              // ✅ string opcional (pode ser null)
          endereco: endereco?.trim() || null,   // ✅ string opcional (pode ser null)
          cep: cleanCep,                       // ✅ string opcional (pode ser null)
          capacidade_total: capacidadeTotalNumber, // ✅ number opcional (pode ser null)
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

        setCredenciaisModal({
          show: true,
          email: email.trim(),
          senha: data.senha || "",
          nome: nome.trim(),
        });

        resetForm();
        setDialogOpen(false);
        fetchArmazens();
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
      // 🚀 DESATIVAR LOADING STATE
      setIsCreating(false);
    }
  };

  // 🚀 FUNÇÃO DE TOGGLE STATUS COM LOADING
  const handleToggleAtivo = async (id: string, ativoAtual: boolean) => {
    // Ativar loading para este armazém específico
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
      // Desativar loading para este armazém
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
          armazem.email?.toLowerCase().includes(term) ||
          armazem.cnpj_cpf?.toLowerCase().includes(term) ||
          (armazem.cidade && armazem.cidade.toLowerCase().includes(term));
        if (!matches) return false;
      }
      return true;
    });
  }, [armazens, filterStatus, searchTerm]);

  const canCreate = hasRole("logistica") || hasRole("admin");

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
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHeader
        title="Armazéns"
        subtitle="Gerencie os armazéns do sistema"
        icon={Warehouse}
        actions={
          canCreate && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              // 🚀 BLOQUEAR FECHAMENTO DURANTE CRIAÇÃO
              if (!open && isCreating) return;
              setDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Armazém
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Armazém</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do armazém. Um usuário de acesso será criado automaticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* ✅ FORMULÁRIO COM ORDEM CORRETA E ASTERISCOS */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={novoArmazem.nome}
                        onChange={(e) => setNovoArmazem({ ...novoArmazem, nome: e.target.value })}
                        placeholder="Nome do armazém"
                        disabled={isCreating}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cidade">Cidade *</Label>
                      <Input
                        id="cidade"
                        value={novoArmazem.cidade}
                        onChange={(e) => setNovoArmazem({ ...novoArmazem, cidade: e.target.value })}
                        placeholder="Nome da cidade"
                        disabled={isCreating}
                      />
                    </div>
                    <div>
                      <Label htmlFor="estado">Estado (UF) *</Label>
                      <Select
                        value={novoArmazem.estado}
                        onValueChange={(value) => setNovoArmazem({ ...novoArmazem, estado: value })}
                        disabled={isCreating}
                      >
                        <SelectTrigger id="estado">
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
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={novoArmazem.email}
                        onChange={(e) => setNovoArmazem({ ...novoArmazem, email: e.target.value })}
                        placeholder="email@exemplo.com"
                        disabled={isCreating}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cnpj_cpf">CNPJ/CPF *</Label>
                      <Input
                        id="cnpj_cpf"
                        value={novoArmazem.cnpj_cpf}
                        onChange={(e) =>
                          setNovoArmazem({ ...novoArmazem, cnpj_cpf: maskCpfCnpjInput(e.target.value) })
                        }
                        placeholder="00.000.000/0000-00 ou 000.000.000-00"
                        maxLength={18}
                        disabled={isCreating}
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={novoArmazem.telefone}
                        onChange={e =>
                          setNovoArmazem({
                            ...novoArmazem,
                            telefone: maskPhoneInput(e.target.value),
                          })
                        }
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                        disabled={isCreating}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="endereco">Endereço</Label>
                      <Input
                        id="endereco"
                        value={novoArmazem.endereco}
                        onChange={(e) => setNovoArmazem({ ...novoArmazem, endereco: e.target.value })}
                        placeholder="Rua, número, complemento"
                        disabled={isCreating}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={novoArmazem.cep}
                        onChange={e =>
                          setNovoArmazem({ ...novoArmazem, cep: maskCEPInput(e.target.value) })
                        }
                        placeholder="00000-000"
                        maxLength={9}
                        disabled={isCreating}
                      />
                    </div>
                    <div>
                      <Label htmlFor="capacidade_total">Capacidade Total (toneladas)</Label>
                      <Input
                        id="capacidade_total"
                        type="number"
                        value={novoArmazem.capacidade_total}
                        onChange={(e) => setNovoArmazem({ ...novoArmazem, capacidade_total: e.target.value })}
                        placeholder="Ex: 1000"
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
                    onClick={handleCreateArmazem}
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
                        Criar Armazém
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
            placeholder="Buscar por nome, email, CNPJ/CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
      </div>

      {/* Modal credenciais temporárias do Armazém */}
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
            <DialogTitle>✅ Armazém cadastrado com sucesso!</DialogTitle>
            <DialogDescription>
              Credenciais de acesso criadas. Envie ao responsável por email ou WhatsApp.
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
                ⚠️ <strong>Importante:</strong> Envie estas credenciais ao responsável.
                Por segurança, esta senha só aparece uma vez. O usuário será obrigado a trocar a senha no primeiro login.
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

      {/* Modal de detalhes do armazém */}
      <Dialog open={!!detalhesArmazem} onOpenChange={open => !open && setDetalhesArmazem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detalhesArmazem?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p><b>Email:</b> {detalhesArmazem?.email}</p>
            <p><b>Telefone:</b> {detalhesArmazem?.telefone ? formatPhone(detalhesArmazem.telefone) : "—"}</p>
            <p><b>CEP:</b> {detalhesArmazem?.cep ? formatCEP(detalhesArmazem.cep) : "—"}</p>
            <p><b>Endereço:</b> {detalhesArmazem?.endereco || "—"}</p>
            <p><b>Cidade:</b> {detalhesArmazem?.cidade || "—"}</p>
            <p><b>Estado:</b> {detalhesArmazem?.estado || "—"}</p>
            <p><b>CNPJ/CPF:</b> {detalhesArmazem?.cnpj_cpf ? formatCpfCnpj(detalhesArmazem.cnpj_cpf) : "—"}</p>
            <p><b>Capacidade Total:</b> {detalhesArmazem?.capacidade_total ?? "—"} t</p>
            <p><b>Disponível:</b> {detalhesArmazem?.capacidade_disponivel ?? "—"} t</p>
            <p><b>Status:</b> {detalhesArmazem?.ativo ? "Ativo" : "Inativo"}</p>
          </div>
          <DialogFooter className="flex gap-2">
            {canCreate && detalhesArmazem?.temp_password && (
              <Button
                variant="outline"
                onClick={() => handleShowCredentials(detalhesArmazem)}
                className="flex-1"
              >
                <Key className="h-4 w-4 mr-2" />
                Ver Credenciais
              </Button>
            )}
            <Button onClick={() => setDetalhesArmazem(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lista de armazéns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredArmazens.map((armazem) => (
          <Card
            key={armazem.id}
            className="cursor-pointer transition-all"
            onClick={() => setDetalhesArmazem(armazem)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{armazem.nome}</h3>
                  <p className="text-sm text-muted-foreground">{armazem.email}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={armazem.ativo ? "default" : "secondary"}>
                    {armazem.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  {canCreate && armazem.temp_password && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowCredentials(armazem);
                      }}
                      className="text-xs"
                    >
                      <Key className="h-3 w-3 mr-1" />
                      Credenciais
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">CNPJ/CPF:</span> {formatCpfCnpj(armazem.cnpj_cpf)}
                </p>
                {(armazem.telefone || armazem.cep) && (
                  <>
                    {armazem.telefone && <p><span className="text-muted-foreground">Telefone:</span> {formatPhone(armazem.telefone)}</p>}
                    {armazem.cep && <p><span className="text-muted-foreground">CEP:</span> {formatCEP(armazem.cep)}</p>}
                  </>
                )}
              </div>
              {canCreate && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <Label htmlFor={`switch-${armazem.id}`} className="text-sm">
                    {armazem.ativo ? "Ativo" : "Inativo"}
                  </Label>
                  {/* 🚀 SWITCH COM LOADING STATE */}
                  <div className="relative">
                    <Switch
                      id={`switch-${armazem.id}`}
                      checked={armazem.ativo}
                      onCheckedChange={() => handleToggleAtivo(armazem.id, armazem.ativo)}
                      onClick={e => e.stopPropagation()}
                      disabled={isTogglingStatus[armazem.id]}
                    />
                    {/* 🚀 SPINNER SOBREPOSTO DURANTE LOADING */}
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
      {filteredArmazens.length === 0 && (
        <div className="text-center py-12">
          <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {searchTerm || filterStatus !== "all"
              ? "Nenhum armazém encontrado com os filtros aplicados"
              : "Nenhum armazém cadastrado ainda"}
          </p>
        </div>
      )}
    </div>
  );
};

export default Armazens;
