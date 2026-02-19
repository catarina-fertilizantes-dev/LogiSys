import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Clock, User, Truck, Plus, X, Filter as FilterIcon, ChevronDown, ChevronUp, AlertCircle, ExternalLink, Info, Loader2, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { ModalFooter } from "@/components/ui/modal-footer";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesAlert } from "@/components/UnsavedChangesAlert";

const getStatusCarregamento = (etapaAtual: number) => {
  if (etapaAtual === 1) {
    return {
      status: "Aguardando",
      percentual: 0,
      cor: "bg-yellow-100 text-yellow-800",
      tooltip: "Aguardando chegada do veículo"
    };
  } else if (etapaAtual >= 2 && etapaAtual <= 5) {
    const percentual = Math.round(((etapaAtual - 1) / 5) * 100);
    let tooltip = "";
    
    switch (etapaAtual) {
      case 2:
        tooltip = "Carregamento do caminhão iniciado";
        break;
      case 3:
        tooltip = "Carregando o caminhão";
        break;
      case 4:
        tooltip = "Carregamento do caminhão finalizado";
        break;
      case 5:
        tooltip = "Anexando documentação";
        break;
      default:
        tooltip = `Etapa ${etapaAtual} em andamento`;
    }
    
    return {
      status: "Em Andamento",
      percentual,
      cor: "bg-blue-100 text-blue-800",
      tooltip
    };
  } else {
    return {
      status: "Finalizado",
      percentual: 100,
      cor: "bg-green-100 text-green-800",
      tooltip: "Documentação anexada e processo concluído"
    };
  }
};

const getAgendamentoStatusTooltip = (status: string) => {
  switch (status) {
    case "pendente":
      return "O carregamento referente à este agendamento ainda não foi iniciado";
    case "em_andamento":
      return "O carregamento referente à este agendamento está sendo realizado";
    case "concluido":
      return "O carregamento referente à este agendamento foi finalizado e o caminhão liberado";
    default:
      return "";
  }
};

const STATUS_AGENDAMENTO = [
  { id: "pendente", nome: "Pendente", cor: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  { id: "em_andamento", nome: "Em Andamento", cor: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  { id: "concluido", nome: "Concluído", cor: "bg-green-100 text-green-800 hover:bg-green-200" },
];

const EmptyStateCardWithAction = ({ 
  title, 
  description, 
  actionText, 
  actionUrl 
}: { 
  title: string; 
  description: string; 
  actionText: string; 
  actionUrl: string; 
}) => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
      <AlertCircle className="h-5 w-5 flex-shrink-0" />
      <span className="font-medium">{title}</span>
    </div>
    <p className="text-sm text-amber-700 dark:text-amber-300">
      {description}
    </p>
    <Button 
      size="sm" 
      className="w-full border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20 min-h-[44px] max-md:min-h-[44px] btn-secondary"
      onClick={() => window.location.href = actionUrl}
    >
      <ExternalLink className="h-4 w-4 mr-2" />
      {actionText}
    </Button>
  </div>
);

const EmptyStateCardWithoutAction = ({ 
  title, 
  description 
}: { 
  title: string; 
  description: string; 
}) => (
  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
      <AlertCircle className="h-5 w-5 flex-shrink-0" />
      <span className="font-medium">{title}</span>
    </div>
    <p className="text-sm text-blue-700 dark:text-blue-300">
      {description}
    </p>
  </div>
);

function maskPlaca(value: string): string {
  let up = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (up.length > 7) up = up.slice(0, 7);
  if (up.length === 7) {
    if (/[A-Z]{3}[0-9][A-Z][0-9]{2}/.test(up)) {
      return up.replace(/^([A-Z]{3})([0-9][A-Z][0-9]{2})$/, "$1-$2");
    }
    return up.replace(/^([A-Z]{3})([0-9]{4})$/, "$1-$2");
  }
  if (up.length > 3) return `${up.slice(0, 3)}-${up.slice(3)}`;
  return up;
}

function formatPlaca(placa: string) {
  return maskPlaca(placa ?? "");
}

function maskCPF(value: string): string {
  let cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length > 9)
    return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})$/, "$1.$2.$3-$4");
  if (cleaned.length > 6)
    return cleaned.replace(/^(\d{3})(\d{3})(\d{0,3})$/, "$1.$2.$3");
  if (cleaned.length > 3)
    return cleaned.replace(/^(\d{3})(\d{0,3})$/, "$1.$2");
  return cleaned;
}

function formatCPF(cpf: string) {
  const cleaned = (cpf ?? "").replace(/\D/g, "").slice(0, 11);
  if (cleaned.length < 11) return maskCPF(cleaned);
  return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

type AgendamentoStatus = "pendente" | "em_andamento" | "concluido";

interface AgendamentoItem {
  id: string;
  cliente: string;
  produto: string;
  quantidade: number;
  data: string;
  placa: string;
  motorista: string;
  documento: string;
  pedido: string;
  status: AgendamentoStatus;
  armazem: string;
  produto_id: string | null;
  armazem_id: string | null;
  liberacao_id: string | null;
  updated_at: string;
  tipo_caminhao: string | null;
  observacoes: string | null;
  etapa_carregamento: number;
  status_carregamento: string;
  percentual_carregamento: number;
  cor_carregamento: string;
  tooltip_carregamento: string;
  finalizado: boolean;
}

const validateAgendamento = (ag: any, quantidadeDisponivel: number) => {
  const errors = [];
  if (!ag.liberacao) errors.push("Liberação");
  if (!ag.quantidade || Number(ag.quantidade) <= 0) errors.push("Quantidade");
  
  const qtdSolicitada = Number(ag.quantidade);
  if (qtdSolicitada > quantidadeDisponivel) {
    errors.push(`Quantidade excede o disponível (${quantidadeDisponivel}t)`);
  }
  
  if (!ag.data || isNaN(Date.parse(ag.data))) errors.push("Data");
  const placaSemMascara = (ag.placa ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (placaSemMascara.length < 7) errors.push("Placa do veículo");
  if (!validatePlaca(placaSemMascara)) errors.push("Formato da placa inválido");
  if (!ag.motorista || ag.motorista.trim().length < 3) errors.push("Nome do motorista");
  if (!ag.documento || ag.documento.replace(/\D/g, "").length !== 11) errors.push("Documento (CPF) do motorista");
  return errors;
};

function validatePlaca(placa: string) {
  if (/^[A-Z]{3}[0-9]{4}$/.test(placa)) return true;
  if (/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(placa)) return true;
  return false;
}

const Agendamentos = () => {
  useScrollToTop();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole, userRole, user } = useAuth();
  const { representanteId, clientesDoRepresentante } = usePermissions();
  
  // ✅ Hook para controle de mudanças não salvas
  const {
    hasUnsavedChanges,
    showAlert,
    markAsChanged,
    markAsSaved,
    reset: resetUnsavedChanges,
    handleClose,
    confirmClose,
    cancelClose
  } = useUnsavedChanges();
  
  const canCreate = hasRole("admin") || hasRole("logistica") || hasRole("cliente") || hasRole("representante");
  const [isCreating, setIsCreating] = useState(false);
  const [detalhesAgendamento, setDetalhesAgendamento] = useState<AgendamentoItem | null>(null);
  const [secaoFinalizadosExpandida, setSecaoFinalizadosExpandida] = useState(false);

  const { data: currentCliente } = useQuery({
    queryKey: ["current-cliente", user?.id],
    queryFn: async () => {
      if (!user || userRole !== "cliente") return null;
      const { data, error } = await supabase
        .from("clientes")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && userRole === "cliente",
  });

  const { data: currentArmazem } = useQuery({
    queryKey: ["current-armazem", user?.id],
    queryFn: async () => {
      if (!user || userRole !== "armazem") return null;
      const { data, error } = await supabase
        .from("armazens")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && userRole === "armazem",
  });

  // 🚀 MIGRAÇÃO PARA FUNÇÃO UNIVERSAL
  const { data: agendamentosData, isLoading, error } = useQuery({
    queryKey: ["agendamentos", currentCliente?.id, currentArmazem?.id, representanteId, userRole],
    queryFn: async () => {
      console.log("🔍 [DEBUG] Query agendamentos executando:");
      console.log("- userRole:", userRole);
      console.log("- representanteId:", representanteId);
      console.log("- currentCliente?.id:", currentCliente?.id);
      console.log("- user:", user);
      
      // 🚀 USAR FUNÇÃO UNIVERSAL PARA TODOS OS ROLES
      const { data, error } = await supabase.rpc('get_agendamentos_universal', {
        p_user_role: userRole,
        p_user_id: user?.id,
        p_cliente_id: currentCliente?.id || null,
        p_armazem_id: currentArmazem?.id || null,
        p_representante_id: representanteId || null
      });
      
      console.log("🔍 [DEBUG] Resultado função universal:", { data, error });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
    enabled: (() => {
      if (!user || !userRole) return false;
      if (userRole === "admin" || userRole === "logistica") return true;
      
      const clienteOk = userRole !== "cliente" || (currentCliente !== undefined);
      const armazemOk = userRole !== "armazem" || (currentArmazem !== undefined);
      const representanteOk = userRole !== "representante" || (representanteId !== undefined);
      
      console.log("🔍 [DEBUG] Enabled check:", { clienteOk, armazemOk, representanteOk });
      
      return clienteOk && armazemOk && representanteOk;
    })(),
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);
  useQuery({
    queryKey: ["agendamentos-hoje", hoje.toISOString().split('T')[0]],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id")
        .gte("data_retirada", hoje.toISOString())
        .lt("data_retirada", amanha.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // ✅ USEMEMO HÍBRIDO - SUPORTA FUNÇÃO UNIVERSAL E FALLBACK
  const agendamentos = useMemo(() => {
    if (!agendamentosData) return [];
    
    return agendamentosData.map((item: any): AgendamentoItem => {
      // ✅ Verificar se vem da função universal (tem campos calculados)
      const isFromFunction = !!item.cliente_nome;
      
      if (isFromFunction) {
        // ✅ Dados já calculados da função universal
        const etapaAtual = item.etapa_atual ?? 1;
        const statusInfo = getStatusCarregamento(etapaAtual);
        const finalizado = item.status === 'concluido';
        
        return {
          id: item.id,
          cliente: item.cliente_nome,
          produto: item.produto_nome,
          quantidade: item.quantidade,
          data: new Date(item.data_retirada).toLocaleDateString("pt-BR"),
          placa: item.placa_caminhao || "N/A",
          motorista: item.motorista_nome || "N/A",
          documento: item.motorista_documento || "N/A",
          pedido: item.pedido_interno,
          status: item.status as AgendamentoStatus,
          armazem: `${item.armazem_nome} - ${item.armazem_cidade}/${item.armazem_estado}`,
          produto_id: item.produto_id,
          armazem_id: item.armazem_id,
          liberacao_id: item.liberacao_id,
          updated_at: item.updated_at,
          tipo_caminhao: item.tipo_caminhao,
          observacoes: item.observacoes,
          etapa_carregamento: etapaAtual,
          status_carregamento: statusInfo.status,
          percentual_carregamento: statusInfo.percentual,
          cor_carregamento: statusInfo.cor,
          tooltip_carregamento: statusInfo.tooltip,
          finalizado,
        };
      } else {
        // ❌ Fallback para dados da query tradicional (não deveria acontecer)
        let etapaAtual = 1;
        const carregamento = item.carregamentos?.[0];
        etapaAtual = carregamento?.etapa_atual ?? 1;
        
        const statusInfo = getStatusCarregamento(etapaAtual);
        const finalizado = item.status === 'concluido';
        
        return {
          id: item.id,
          cliente: item.liberacao?.clientes?.nome || "N/A",
          produto: item.liberacao?.produto?.nome || "N/A",
          quantidade: item.quantidade,
          data: item.data_retirada
            ? new Date(item.data_retirada).toLocaleDateString("pt-BR")
            : "",
          placa: item.placa_caminhao || "N/A",
          motorista: item.motorista_nome || "N/A",
          documento: item.motorista_documento || "N/A",
          pedido: item.liberacao?.pedido_interno || "N/A",
          status: item.status as AgendamentoStatus,
          armazem: item.liberacao?.armazem ? `${item.liberacao.armazem.nome} - ${item.liberacao.armazem.cidade}/${item.liberacao.armazem.estado}` : "N/A",
          produto_id: item.liberacao?.produto?.id,
          armazem_id: item.liberacao?.armazem?.id,
          liberacao_id: item.liberacao?.id,
          updated_at: item.updated_at,
          tipo_caminhao: item.tipo_caminhao,
          observacoes: item.observacoes,
          etapa_carregamento: etapaAtual,
          status_carregamento: statusInfo.status,
          percentual_carregamento: statusInfo.percentual,
          cor_carregamento: statusInfo.cor,
          tooltip_carregamento: statusInfo.tooltip,
          finalizado,
        };
      }
    });
  }, [agendamentosData]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoAgendamento, setNovoAgendamento] = useState({
    liberacao: "",
    quantidade: "",
    data: "",
    placa: "",
    motorista: "",
    documento: "",
    tipoCaminhao: "",
    observacoes: "",
  });
  const [formError, setFormError] = useState("");
  const [quantidadeDisponivel, setQuantidadeDisponivel] = useState<number>(0);
  const [validandoQuantidade, setValidandoQuantidade] = useState(false);

  // 🚀 MIGRAÇÃO PARA FUNÇÃO UNIVERSAL - LIBERAÇÕES DISPONÍVEIS
  const { data: liberacoesDisponiveis } = useQuery({
    queryKey: ["liberacoes-disponiveis", currentCliente?.id, representanteId, userRole],
    queryFn: async () => {
      console.log("🔍 [DEBUG] Query liberacoes-disponiveis executando:");
      console.log("- userRole:", userRole);
      console.log("- representanteId:", representanteId);
      console.log("- currentCliente?.id:", currentCliente?.id);
      
      // 🚀 USAR FUNÇÃO UNIVERSAL PARA LIBERAÇÕES DISPONÍVEIS
      const { data, error } = await supabase.rpc('get_liberacoes_universal', {
        p_user_role: userRole,
        p_user_id: user?.id,
        p_cliente_id: currentCliente?.id || null,
        p_armazem_id: null, // Para agendamentos, não filtramos por armazém específico
        p_representante_id: representanteId || null
      });
      
      console.log("🔍 [DEBUG] Resultado função universal liberações:", { data, error });
      
      if (error) throw error;
      
      // Filtrar apenas liberações disponíveis e calcular disponibilidade
      const liberacoesDisponiveis = (data || []).filter((lib: any) => 
        lib.status === 'disponivel' || lib.status === 'parcialmente_agendada'
      );

      const liberacoesComDisponibilidade = liberacoesDisponiveis.map((lib: any) => ({
        id: lib.id,
        pedido_interno: lib.pedido_interno,
        quantidade_liberada: lib.quantidade_liberada,
        quantidade_retirada: lib.quantidade_retirada,
        status: lib.status,
        cliente_id: lib.cliente_id,
        clientes: { nome: lib.cliente_nome },
        produto: { nome: lib.produto_nome },
        armazem: {
          id: lib.armazem_id,
          cidade: lib.armazem_cidade,
          estado: lib.armazem_estado,
          nome: lib.armazem_nome
        },
        quantidade_disponivel_real: lib.quantidade_disponivel || 
          (lib.quantidade_liberada - (lib.quantidade_retirada || 0) - (lib.quantidade_agendada || 0))
      }));
      
      return liberacoesComDisponibilidade.filter(lib => lib.quantidade_disponivel_real > 0);
    },
    enabled: (() => {
      if (!user || !userRole) return false;
      if (userRole === "admin" || userRole === "logistica") return true;
      
      const clienteOk = userRole !== "cliente" || (currentCliente !== undefined);
      const representanteOk = userRole !== "representante" || (representanteId !== undefined);
      
      console.log("🔍 [DEBUG] Liberações enabled check:", { clienteOk, representanteOk });
      
      return clienteOk && representanteOk;
    })(),
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [canCreate]);

  const resetFormNovoAgendamento = () => {
    setNovoAgendamento({
      liberacao: "",
      quantidade: "",
      data: "",
      placa: "",
      motorista: "",
      documento: "",
      tipoCaminhao: "",
      observacoes: "",
    });
    setFormError("");
    setQuantidadeDisponivel(0);
    setValidandoQuantidade(false);
    resetUnsavedChanges(); // ✅ Limpar estado de mudanças
  };

  // ✅ Função para fechar modal com verificação
  const handleCloseModal = () => {
    handleClose(() => {
      setDialogOpen(false);
      resetFormNovoAgendamento(); // ✅ Limpar dados ao fechar
    });
  };

  const atualizarQuantidadeDisponivel = async (liberacaoId: string) => {
    if (!liberacaoId) {
      setQuantidadeDisponivel(0);
      return;
    }
    
    setValidandoQuantidade(true);
    try {
      const liberacao = liberacoesDisponiveis?.find(lib => lib.id === liberacaoId);
      if (!liberacao) {
        setQuantidadeDisponivel(0);
        return;
      }

      const { data: agendamentosPendentes, error } = await supabase
        .from("agendamentos")
        .select("quantidade")
        .eq("liberacao_id", liberacaoId)
        .in("status", ["pendente", "em_andamento"]);

      if (error) {
        setQuantidadeDisponivel(0);
        return;
      }

      const totalAgendado = (agendamentosPendentes || []).reduce(
        (total, agendamento) => total + (agendamento.quantidade || 0), 
        0
      );

      const quantidadeLiberada = liberacao.quantidade_liberada || 0;
      const quantidadeRetirada = liberacao.quantidade_retirada || 0;
      const disponivel = Math.max(0, quantidadeLiberada - quantidadeRetirada - totalAgendado);
      
      setQuantidadeDisponivel(disponivel);
      
    } catch (error) {
      setQuantidadeDisponivel(0);
    } finally {
      setValidandoQuantidade(false);
    }
  };

  const handleCreateAgendamento = async () => {
    setFormError("");
    const erros = validateAgendamento(novoAgendamento, quantidadeDisponivel);
    if (erros.length > 0) {
      setFormError("Preencha: " + erros.join(", "));
      toast({
        variant: "destructive",
        title: "Campos obrigatórios ausentes ou inválidos",
        description: "Preencha: " + erros.join(", "),
      });
      return;
    }
    const qtdNum = Number(novoAgendamento.quantidade);
    if (Number.isNaN(qtdNum) || qtdNum <= 0) {
      setFormError("Quantidade inválida.");
      toast({ variant: "destructive", title: "Quantidade inválida" });
      return;
    }

    setIsCreating(true);

    try {
      const placaSemMascara = (novoAgendamento.placa ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
      const cpfSemMascara = (novoAgendamento.documento ?? "").replace(/\D/g, "");

      const selectedLiberacao = liberacoesDisponiveis?.find((l) => l.id === novoAgendamento.liberacao);
      const clienteIdDaLiberacao = selectedLiberacao?.cliente_id || null;
      const armazemIdDaLiberacao = selectedLiberacao?.armazem?.id || null;

      const { data: userData } = await supabase.auth.getUser();
      const { data: agendData, error: errAgend } = await supabase
        .from("agendamentos")
        .insert({
          liberacao_id: novoAgendamento.liberacao,
          quantidade: qtdNum,
          data_retirada: novoAgendamento.data,
          placa_caminhao: placaSemMascara,
          motorista_nome: novoAgendamento.motorista.trim(),
          motorista_documento: cpfSemMascara,
          tipo_caminhao: novoAgendamento.tipoCaminhao || null,
          observacoes: novoAgendamento.observacoes || null,
          created_by: userData.user?.id,
          cliente_id: clienteIdDaLiberacao,
          armazem_id: armazemIdDaLiberacao,
        })
        .select(`
          id,
          data_retirada,
          liberacao:liberacoes(
            pedido_interno,
            clientes(nome),
            produto:produtos(nome)
          )
        `)
        .single();

      if (errAgend) {
        if (
          errAgend.message?.includes("violates not-null constraint") ||
          errAgend.code === "23502"
        ) {
          setFormError("Erro do banco: campo obrigatório não enviado (verifique todos os campos).");
          toast({
            variant: "destructive",
            title: "Erro ao criar agendamento",
            description: "Erro do banco: campo obrigatório não enviado (verifique todos os campos).",
          });
        } else if (errAgend.message?.includes("Quantidade solicitada") && errAgend.message?.includes("excede o disponível")) {
          setFormError("Quantidade solicitada excede o disponível para esta liberação.");
          toast({
            variant: "destructive",
            title: "Quantidade inválida",
            description: "A quantidade solicitada excede o disponível para esta liberação.",
          });
        } else {
          setFormError(errAgend.message || "Erro desconhecido");
          toast({ variant: "destructive", title: "Erro ao criar agendamento", description: errAgend.message });
        }
        return;
      }

      markAsSaved(); // ✅ Marcar como salvo ANTES de resetar

      toast({
        title: "Agendamento criado com sucesso!",
        description: `${(agendData.liberacao as any)?.clientes?.nome ?? ""} - ${new Date(agendData.data_retirada).toLocaleDateString("pt-BR")} - ${qtdNum}t`
      });
      resetFormNovoAgendamento();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["liberacoes-disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["liberacoes"] });

    } catch (err: any) {
      setFormError(err.message || "Erro desconhecido.");
      if (err.message?.includes("violates not-null constraint")) {
        toast({
          variant: "destructive",
          title: "Erro ao criar agendamento",
          description: "Erro do banco: campo obrigatório não enviado (verifique todos os campos).",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao criar agendamento",
          description: err instanceof Error ? err.message : "Erro desconhecido"
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<AgendamentoStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const allStatuses: AgendamentoStatus[] = ["pendente", "em_andamento", "concluido"];
  const toggleStatus = (st: AgendamentoStatus) => setSelectedStatuses((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  const clearFilters = () => { setSearch(""); setSelectedStatuses([]); setDateFrom(""); setDateTo(""); };

  const { agendamentosAtivos, agendamentosFinalizados } = useMemo(() => {
    const filtered = agendamentos.filter((a) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${a.cliente} ${a.produto} ${a.pedido} ${a.motorista}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(a.status)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (parseDate(a.data) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (parseDate(a.data) > to) return false;
      }
      return true;
    });

    const ativos = filtered.filter(a => !a.finalizado);
    const finalizados = filtered.filter(a => a.finalizado);

    return { agendamentosAtivos: ativos, agendamentosFinalizados: finalizados };
  }, [agendamentos, search, selectedStatuses, dateFrom, dateTo]);

  useEffect(() => {
    if (search.trim() && agendamentosFinalizados.length > 0 && !secaoFinalizadosExpandida) {
      setSecaoFinalizadosExpandida(true);
    }
  }, [search, agendamentosFinalizados.length, secaoFinalizadosExpandida]);

  const showingCount = agendamentosAtivos.length + agendamentosFinalizados.length;
  const totalCount = agendamentos.length;
  const activeAdvancedCount = (selectedStatuses.length ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);
  const hasActiveFilters = search.trim() || selectedStatuses.length > 0 || dateFrom || dateTo;
  const temLiberacoesDisponiveis = liberacoesDisponiveis && liberacoesDisponiveis.length > 0;

  const renderEmptyLiberacoesCard = () => {
    if (userRole === "cliente" || userRole === "representante") {
      return (
        <EmptyStateCardWithoutAction
          title="Nenhuma liberação disponível"
          description="Você não possui liberações disponíveis para agendamento no momento. Se acredita que isso é um erro, entre em contato com a equipe de operações para verificar o status dos seus pedidos."
        />
      );
    } else {
      return (
        <EmptyStateCardWithAction
          title="Nenhuma liberação disponível"
          description="Para criar agendamentos, você precisa ter liberações disponíveis primeiro."
          actionText="Criar Liberação"
          actionUrl="https://logi-sys-shiy.vercel.app/liberacoes?modal=novo"
        />
      );
    }
  };

  const quantidadeValida = useMemo(() => {
    const qtd = Number(novoAgendamento.quantidade);
    return !isNaN(qtd) && qtd > 0 && qtd <= quantidadeDisponivel;
  }, [novoAgendamento.quantidade, quantidadeDisponivel]);

  const getStatusColor = (status: AgendamentoStatus) => {
    switch (status) {
      case "pendente":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "em_andamento":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "concluido":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const getStatusLabel = (status: AgendamentoStatus) => {
    switch (status) {
      case "pendente":
        return "Pendente";
      case "em_andamento":
        return "Em Andamento";
      case "concluido":
        return "Concluído";
      default:
        return status;
    }
  };

  const renderAgendamentoCard = (ag: AgendamentoItem) => (
    <Card key={ag.id} className="transition-all hover:shadow-md cursor-pointer">
      <CardContent className="p-4 md:p-5">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
            <div 
              className="flex items-start gap-3 md:gap-4 flex-1 w-full"
              onClick={() => setDetalhesAgendamento(ag)}
            >
              <div className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-lg bg-gradient-primary shrink-0">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm md:text-base">Pedido: {ag.pedido}</h3>
                <p className="text-xs text-muted-foreground">Cliente: <span className="font-semibold">{ag.cliente}</span></p>
                <p className="text-xs text-muted-foreground">Produto: <span className="font-semibold">{ag.produto}</span></p>
                <p className="text-xs text-muted-foreground break-words">Armazém: <span className="font-semibold">{ag.armazem}</span></p>
                <p className="text-xs text-muted-foreground">Quantidade: <span className="font-semibold">{ag.quantidade.toLocaleString('pt-BR')}t</span></p>
              </div>
            </div>
            
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center gap-1 cursor-help shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Badge className={getStatusColor(ag.status)}>
                    {getStatusLabel(ag.status)}
                  </Badge>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">{getAgendamentoStatusTooltip(ag.status)}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm pt-2"
            onClick={() => setDetalhesAgendamento(ag)}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{ag.data}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{formatPlaca(ag.placa)}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{ag.motorista}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{formatCPF(ag.documento)}</span>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <div 
                className="flex items-center gap-2 shrink-0"
                onClick={() => setDetalhesAgendamento(ag)}
              >
                <Truck className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-purple-600 font-medium w-20 sm:w-24">Carregamento:</span>
              </div>
              
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div 
                    className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700 cursor-help"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${ag.percentual_carregamento}%` }}
                    ></div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{ag.tooltip_carregamento}</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-1 cursor-help shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium w-10 sm:w-12">
                      {ag.percentual_carregamento}%
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{ag.tooltip_carregamento}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader title="Agendamentos de Retirada" subtitle="Carregando..." icon={Calendar} actions={<></>} />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando agendamentos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader title="Agendamentos de Retirada" subtitle="Erro ao carregar dados" icon={Calendar} actions={<></>} />
        <div className="text-center">
          <p className="text-destructive">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        
        {/* ✅ Componente de alerta */}
        <UnsavedChangesAlert 
          open={showAlert}
          onConfirm={confirmClose}
          onCancel={cancelClose}
        />

        <PageHeader
          title="Agendamentos de Retirada"
          subtitle="Gerencie os agendamentos de retirada de produtos"
          icon={Calendar}
          actions={
            canCreate ? (
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                if (!open && isCreating) return; // Não fechar durante criação
                if (!open) {
                  handleCloseModal(); // ✅ Usar nova função
                } else {
                  setDialogOpen(open);
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="btn-primary min-h-[44px] max-md:min-h-[44px]">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Agendamento
                  </Button>
                </DialogTrigger>
                
                {/* Modal de Novo Agendamento - Mobile Otimizado */}
                <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
                  <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
                    <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Novo Agendamento</DialogTitle>
                  </DialogHeader>
                  
                  <div className="py-4 px-1 space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="liberacao" className="text-sm font-medium">Liberação *</Label>
                        {temLiberacoesDisponiveis ? (
                          <Select
                            value={novoAgendamento.liberacao}
                            onValueChange={async (v) => {
                              setNovoAgendamento((s) => ({ ...s, liberacao: v, quantidade: "" }));
                              markAsChanged(); // ✅ Marcar como alterado
                              await atualizarQuantidadeDisponivel(v);
                            }}
                            disabled={isCreating}
                          >
                            <SelectTrigger id="liberacao" className="min-h-[44px] max-md:min-h-[44px]">
                              <SelectValue placeholder="Selecione a liberação" />
                            </SelectTrigger>
                            <SelectContent>
                              {liberacoesDisponiveis?.map((lib: any) => {
                                const disponivel = lib.quantidade_disponivel_real || 
                                  (lib.quantidade_liberada - (lib.quantidade_retirada || 0));
                                return (
                                  <SelectItem key={lib.id} value={lib.id}>
                                    <span className="break-words">
                                      {lib.pedido_interno} - {lib.clientes?.nome} - {lib.produto?.nome} ({disponivel.toLocaleString('pt-BR')}t disponível) - {lib.armazem?.cidade}/{lib.armazem?.estado}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          renderEmptyLiberacoesCard()
                        )}
                      </div>

                      {temLiberacoesDisponiveis && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="quantidade" className="text-sm font-medium">Quantidade (t) *</Label>
                              {novoAgendamento.liberacao && (
                                <div className="text-sm text-muted-foreground mb-1">
                                  {validandoQuantidade ? (
                                    <span className="flex items-center gap-1">
                                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                      Verificando disponibilidade...
                                    </span>
                                  ) : (
                                    <span className={quantidadeDisponivel > 0 ? "text-green-600" : "text-red-600"}>
                                      Disponível: {quantidadeDisponivel.toLocaleString('pt-BR')}t
                                    </span>
                                  )}
                                </div>
                              )}
                              <Input
                                id="quantidade"
                                type="number"
                                step="0.01"
                                min="0"
                                max={quantidadeDisponivel || undefined}
                                value={novoAgendamento.quantidade}
                                onChange={(e) => {
                                  setNovoAgendamento((s) => ({ ...s, quantidade: e.target.value }));
                                  markAsChanged(); // ✅ Marcar como alterado
                                }}
                                placeholder="0.00"
                                className={`min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base ${
                                  novoAgendamento.quantidade && !quantidadeValida 
                                    ? "border-red-500 focus:border-red-500" 
                                    : novoAgendamento.quantidade && quantidadeValida
                                    ? "border-green-500 focus:border-green-500"
                                    : ""
                                }`}
                                disabled={isCreating}
                              />
                              {novoAgendamento.quantidade && !quantidadeValida && (
                                <p className="text-xs text-red-600">
                                  {Number(novoAgendamento.quantidade) > quantidadeDisponivel 
                                    ? `Quantidade excede o disponível (${quantidadeDisponivel.toLocaleString('pt-BR')}t)`
                                    : "Quantidade deve ser maior que zero"
                                  }
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="data" className="text-sm font-medium">Data *</Label>
                              <Input
                                id="data"
                                type="date"
                                value={novoAgendamento.data}
                                onChange={(e) => {
                                  setNovoAgendamento((s) => ({ ...s, data: e.target.value }));
                                  markAsChanged(); // ✅ Marcar como alterado
                                }}
                                disabled={isCreating}
                                className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="placa" className="text-sm font-medium">Placa do Veículo *</Label>
                            <Input
                              id="placa"
                              value={novoAgendamento.placa}
                              onChange={(e) => {
                                setNovoAgendamento((s) => ({
                                  ...s,
                                  placa: maskPlaca(e.target.value),
                                }));
                                markAsChanged(); // ✅ Marcar como alterado
                              }}
                              placeholder="Ex: ABC-1234 ou ABC-1D23"
                              maxLength={9}
                              autoCapitalize="characters"
                              spellCheck={false}
                              inputMode="text"
                              disabled={isCreating}
                              className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                            />
                            <p className="text-xs text-muted-foreground">Formato antigo (ABC-1234) ou Mercosul (ABC-1D23)</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="motorista" className="text-sm font-medium">Nome do Motorista *</Label>
                              <Input
                                id="motorista"
                                value={novoAgendamento.motorista}
                                onChange={(e) => {
                                  setNovoAgendamento((s) => ({ ...s, motorista: e.target.value }));
                                  markAsChanged(); // ✅ Marcar como alterado
                                }}
                                placeholder="Ex: João Silva"
                                disabled={isCreating}
                                className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="documento" className="text-sm font-medium">Documento (CPF) *</Label>
                              <Input
                                id="documento"
                                value={novoAgendamento.documento}
                                onChange={(e) => {
                                  setNovoAgendamento((s) => ({
                                    ...s,
                                    documento: maskCPF(e.target.value),
                                  }));
                                  markAsChanged(); // ✅ Marcar como alterado
                                }}
                                placeholder="Ex: 123.456.789-00"
                                maxLength={14}
                                disabled={isCreating}
                                className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="tipoCaminhao" className="text-sm font-medium">Tipo de Caminhão</Label>
                            <Input
                              id="tipoCaminhao"
                              value={novoAgendamento.tipoCaminhao}
                              onChange={(e) => {
                                setNovoAgendamento((s) => ({ ...s, tipoCaminhao: e.target.value }));
                                markAsChanged(); // ✅ Marcar como alterado
                              }}
                              placeholder="Ex: Bitrem, Carreta, Truck"
                              disabled={isCreating}
                              className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="observacoes" className="text-sm font-medium">Observações</Label>
                            <Input
                              id="observacoes"
                              value={novoAgendamento.observacoes}
                              onChange={(e) => {
                                setNovoAgendamento((s) => ({ ...s, observacoes: e.target.value }));
                                markAsChanged(); // ✅ Marcar como alterado
                              }}
                              placeholder="Informações adicionais sobre o agendamento"
                              disabled={isCreating}
                              className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                            />
                          </div>
                          
                          {formError && (
                            <div className="pt-3 text-destructive text-sm font-semibold border-t">
                              {formError}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Botões no final do conteúdo */}
                    <ModalFooter 
                      variant="double"
                      onClose={() => handleCloseModal()}
                      onConfirm={handleCreateAgendamento}
                      confirmText="Criar Agendamento"
                      confirmIcon={<Plus className="h-4 w-4" />}
                      isLoading={isCreating}
                      disabled={!temLiberacoesDisponiveis || !quantidadeValida || validandoQuantidade}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        {/* Barra de filtros - Mobile otimizada */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Input 
              className="h-9 flex-1 min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base" 
              placeholder="Buscar por cliente, produto, pedido ou motorista..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
            <Button 
              size="sm" 
              onClick={() => setFiltersOpen((v) => !v)} 
              className="whitespace-nowrap min-h-[44px] max-md:min-h-[44px] btn-secondary"
            >
              <FilterIcon className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Filtros</span>
              {activeAdvancedCount ? ` (${activeAdvancedCount})` : ""}
              {filtersOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Mostrando <span className="font-medium">{showingCount}</span> de <span className="font-medium">{totalCount}</span>
            </span>
            {hasActiveFilters && (
              <Button 
                size="sm" 
                onClick={clearFilters} 
                className="gap-1 min-h-[44px] max-md:min-h-[44px] btn-secondary"
              >
                <X className="h-4 w-4" /> 
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>
        
        {/* Filtros expandidos - Mobile otimizado */}
        {filtersOpen && (
          <div className="rounded-md border p-3 space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Status do Agendamento</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_AGENDAMENTO.map((status) => {
                  const active = selectedStatuses.includes(status.id as AgendamentoStatus);
                  return (
                    <Badge
                      key={status.id}
                      onClick={() => toggleStatus(status.id as AgendamentoStatus)}
                      className={`cursor-pointer text-xs px-2 py-1 border-0 min-h-[32px] ${
                        active 
                          ? "bg-gradient-primary text-white"
                          : status.cor
                      }`}>
                      {status.nome}
                    </Badge>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Período</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => setDateFrom(e.target.value)} 
                  className="min-h-[44px] max-md:min-h-[44px]" 
                  placeholder="Data inicial"
                />
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => setDateTo(e.target.value)} 
                  className="min-h-[44px] max-md:min-h-[44px]" 
                  placeholder="Data final"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal de Detalhes - Mobile Otimizado */}
        <Dialog open={!!detalhesAgendamento} onOpenChange={open => !open && setDetalhesAgendamento(null)}>
          <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
            <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
              <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Detalhes do Agendamento</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Pedido: {detalhesAgendamento?.pedido}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4 px-1 space-y-4">
              {detalhesAgendamento && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Data de Retirada:</Label>
                      <p className="font-semibold text-sm">{detalhesAgendamento.data}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status:</Label>
                      <Badge className={getStatusColor(detalhesAgendamento.status)}>
                        {getStatusLabel(detalhesAgendamento.status)}
                      </Badge>
                    </div>
                  </div>

                  <div className="border-t"></div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cliente:</Label>
                      <p className="font-semibold text-sm break-words">{detalhesAgendamento.cliente}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Armazém:</Label>
                      <p className="font-semibold text-sm break-words">{detalhesAgendamento.armazem}</p>
                    </div>
                  </div>

                  <div className="border-t"></div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Produto:</Label>
                      <p className="font-semibold text-sm break-words">{detalhesAgendamento.produto}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantidade:</Label>
                      <p className="font-semibold text-sm">{detalhesAgendamento.quantidade.toLocaleString('pt-BR')}t</p>
                    </div>
                  </div>

                  <div className="border-t"></div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome do Motorista:</Label>
                      <p className="font-semibold text-sm break-words">{detalhesAgendamento.motorista}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CPF do Motorista:</Label>
                      <p className="font-semibold text-sm">{formatCPF(detalhesAgendamento.documento)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Placa do Veículo:</Label>
                      <p className="font-semibold text-sm">{formatPlaca(detalhesAgendamento.placa)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Tipo de Caminhão:</Label>
                      <p className="font-semibold text-sm">{detalhesAgendamento.tipo_caminhao || "—"}</p>
                    </div>
                  </div>

                  {detalhesAgendamento.observacoes && (
                    <>
                      <div className="border-t"></div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Observações:</Label>
                        <p className="text-sm bg-muted p-3 rounded-md mt-1 break-words">
                          {detalhesAgendamento.observacoes}
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            
            <ModalFooter 
              variant="single"
              onClose={() => setDetalhesAgendamento(null)}
            />
          </DialogContent>
        </Dialog>

        {/* Lista de Agendamentos - Mobile Otimizada */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Agendamentos Ativos ({agendamentosAtivos.length})</h2>
          </div>
          
          <div className="grid gap-3">
            {agendamentosAtivos.map(renderAgendamentoCard)}
            {agendamentosAtivos.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {hasActiveFilters
                    ? "Nenhum agendamento ativo encontrado com os filtros aplicados"
                    : "Nenhum agendamento ativo no momento"}
                </p>
                {hasActiveFilters && (
                  <Button 
                    size="sm" 
                    onClick={clearFilters}
                    className="mt-2 min-h-[44px] max-md:min-h-[44px] btn-secondary"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Seção de Agendamentos Finalizados - Mobile Otimizada */}
        {agendamentosFinalizados.length > 0 && (
          <div className="space-y-4">
            <Button
              className="flex items-center gap-2 p-0 h-auto text-lg font-semibold hover:bg-transparent btn-secondary min-h-[44px] max-md:min-h-[44px]"
              onClick={() => setSecaoFinalizadosExpandida(!secaoFinalizadosExpandida)}
            >
              {secaoFinalizadosExpandida ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="text-muted-foreground">
                Agendamentos Finalizados ({agendamentosFinalizados.length})
              </span>
            </Button>
            
            {secaoFinalizadosExpandida && (
              <div className="grid gap-3 ml-0 sm:ml-7">
                {agendamentosFinalizados.map(renderAgendamentoCard)}
              </div>
            )}
          </div>
        )}

        {/* Estado vazio geral - Mobile Otimizado */}
        {agendamentosAtivos.length === 0 && agendamentosFinalizados.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {hasActiveFilters
                ? "Nenhum agendamento encontrado com os filtros aplicados"
                : "Nenhum agendamento cadastrado ainda"}
            </p>
            {hasActiveFilters && (
              <Button 
                size="sm" 
                onClick={clearFilters}
                className="mt-2 min-h-[44px] max-md:min-h-[44px] btn-secondary"
              >
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default Agendamentos;
