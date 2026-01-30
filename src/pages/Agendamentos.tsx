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
import { useToast } from "@/hooks/use-toast";

// 🎯 FUNÇÃO CORRIGIDA PARA DETERMINAR STATUS DO CARREGAMENTO (IGUAL À PÁGINA CARREGAMENTOS)
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

// 🎯 FUNÇÃO PARA TOOLTIPS DOS STATUS DE AGENDAMENTO
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

// 🎨 ARRAY DE STATUS PARA FILTROS COM CORES
const STATUS_AGENDAMENTO = [
  { id: "pendente", nome: "Pendente", cor: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  { id: "em_andamento", nome: "Em Andamento", cor: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  { id: "concluido", nome: "Concluído", cor: "bg-green-100 text-green-800 hover:bg-green-200" },
];

// Componente para exibir quando não há dados disponíveis - COM LINK
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
      <AlertCircle className="h-5 w-5" />
      <span className="font-medium">{title}</span>
    </div>
    <p className="text-sm text-amber-700 dark:text-amber-300">
      {description}
    </p>
    <Button 
      variant="outline" 
      size="sm" 
      className="w-full border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20"
      onClick={() => window.location.href = actionUrl}
    >
      <ExternalLink className="h-4 w-4 mr-2" />
      {actionText}
    </Button>
  </div>
);

// Componente para exibir quando não há dados disponíveis - SEM LINK (para clientes)
const EmptyStateCardWithoutAction = ({ 
  title, 
  description 
}: { 
  title: string; 
  description: string; 
}) => (
  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
      <AlertCircle className="h-5 w-5" />
      <span className="font-medium">{title}</span>
    </div>
    <p className="text-sm text-blue-700 dark:text-blue-300">
      {description}
    </p>
  </div>
);

// Funções de máscaras/formatadores
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

// 🔄 TIPOS ATUALIZADOS PARA NOVO SISTEMA
type AgendamentoStatus = "pendente" | "em_andamento" | "concluido";

// 🆕 INTERFACE ATUALIZADA COM CAMPO DE FINALIZAÇÃO
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
  // 🆕 CAMPO PARA HISTÓRICO
  finalizado: boolean;
}

// 🔄 VALIDAÇÃO ATUALIZADA
const validateAgendamento = (ag: any, quantidadeDisponivel: number) => {
  const errors = [];
  if (!ag.liberacao) errors.push("Liberação");
  if (!ag.quantidade || Number(ag.quantidade) <= 0) errors.push("Quantidade");
  
  // Validação de quantidade disponível
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole, userRole, user, representanteId } = useAuth();
  const canCreate = hasRole("admin") || hasRole("logistica") || hasRole("cliente");

  // 🚀 NOVO ESTADO DE LOADING
  const [isCreating, setIsCreating] = useState(false);

  // 🆕 ESTADO PARA MODAL DE DETALHES
  const [detalhesAgendamento, setDetalhesAgendamento] = useState<AgendamentoItem | null>(null);

  // 🆕 ESTADOS PARA SEÇÕES COLAPSÁVEIS
  const [secaoFinalizadosExpandida, setSecaoFinalizadosExpandida] = useState(false);

  // Buscar cliente atual vinculado ao usuário logado
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

  // Buscar armazém atual vinculado ao usuário logado
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

  // 🔄 QUERY PRINCIPAL - VERSÃO COM FUNCTION PARA REPRESENTANTES
  const { data: agendamentosData, isLoading, error } = useQuery({
    queryKey: ["agendamentos", currentCliente?.id, currentArmazem?.id, representanteId, userRole],
    queryFn: async () => {
      console.log('🔍 [DEBUG] Agendamentos Query executando com:', {
        userRole,
        representanteId,
        currentClienteId: currentCliente?.id,
        currentArmazemId: currentArmazem?.id
      });
  
      // 🆕 REPRESENTANTE: Usar function específica
      if (userRole === "representante" && representanteId) {
        console.log('🔍 [DEBUG] Usando function para representante:', representanteId);
        
        const { data, error } = await supabase.rpc('get_agendamentos_by_representante', {
          p_representante_id: representanteId
        });
        
        console.log('🔍 [DEBUG] Agendamentos Function result:', {
          error: error?.message,
          dataLength: data?.length || 0,
          primeiros2: data?.slice(0, 2)
        });
        
        if (error) throw error;
        return data || [];
      }
  
      // 🔄 CLIENTE E OUTROS: Query original
      let query = supabase
        .from("agendamentos")
        .select(`
          id,
          data_retirada,
          quantidade,
          motorista_nome,
          motorista_documento,
          placa_caminhao,
          tipo_caminhao,
          status,
          observacoes,
          created_at,
          updated_at,
          liberacao:liberacoes(
            id,
            pedido_interno,
            quantidade_liberada,
            quantidade_retirada,
            status,
            cliente_id,
            clientes(nome, cnpj_cpf),
            produto:produtos(id, nome),
            armazem:armazens(id, nome, cidade, estado)
          ),
          carregamentos!carregamentos_agendamento_id_fkey(
            id,
            etapa_atual
          )
        `)
        .order("created_at", { ascending: false });
  
      if (userRole === "cliente" && currentCliente?.id) {
        console.log('🔍 [DEBUG] Aplicando filtro cliente:', currentCliente.id);
        query = query.eq("cliente_id", currentCliente.id);
      }
      if (userRole === "armazem" && currentArmazem?.id) {
        console.log('🔍 [DEBUG] Aplicando filtro armazem:', currentArmazem.id);
        query = query.eq("armazem_id", currentArmazem.id);
      }
  
      console.log('🔍 [DEBUG] Executando query tradicional...');
      const { data, error } = await query;
      
      console.log('🔍 [DEBUG] Agendamentos Query tradicional result:', {
        error: error?.message,
        dataLength: data?.length || 0,
        primeiros2: data?.slice(0, 2)
      });
      
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
    enabled: (() => {
      const clienteOk = userRole !== "cliente" || !!currentCliente?.id;
      const armazemOk = userRole !== "armazem" || !!currentArmazem?.id;
      const representanteOk = userRole !== "representante" || !!representanteId;
      
      console.log('🔍 [DEBUG] Agendamentos Enabled conditions:', {
        clienteOk,
        armazemOk, 
        representanteOk,
        representanteId,
        final: clienteOk && armazemOk && representanteOk
      });
      
      return clienteOk && armazemOk && representanteOk;
    })(),
  });

  // Query de agendamentos hoje usando data_retirada
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

  // 🔄 MAPEAMENTO CORRIGIDO - SUPORTE PARA FUNCTION E QUERY TRADICIONAL
  const agendamentos = useMemo(() => {
    if (!agendamentosData) return [];
    
    return agendamentosData.map((item: any): AgendamentoItem => {
      // 🆕 DETECTAR SE OS DADOS VIERAM DA FUNCTION (representante) OU QUERY TRADICIONAL
      const isFromFunction = !!item.cliente_nome; // Se tem cliente_nome, veio da function
      
      // 🚛 DADOS DO CARREGAMENTO
      let etapaAtual = 1;
      if (isFromFunction) {
        // Da function: etapa_atual vem diretamente
        etapaAtual = item.etapa_atual ?? 1;
      } else {
        // Da query tradicional: carregamentos é array
        const carregamento = item.carregamentos?.[0];
        etapaAtual = carregamento?.etapa_atual ?? 1;
      }
      
      const statusInfo = getStatusCarregamento(etapaAtual);
      
      // 🆕 CRITÉRIO DE FINALIZAÇÃO: status === 'concluido'
      const finalizado = item.status === 'concluido';
      
      return {
        id: item.id,
        cliente: isFromFunction ? item.cliente_nome : (item.liberacao?.clientes?.nome || "N/A"),
        produto: isFromFunction ? item.produto_nome : (item.liberacao?.produto?.nome || "N/A"),
        quantidade: item.quantidade,
        data: item.data_retirada
          ? new Date(item.data_retirada).toLocaleDateString("pt-BR")
          : "",
        placa: item.placa_caminhao || "N/A",
        motorista: item.motorista_nome || "N/A",
        documento: item.motorista_documento || "N/A",
        pedido: isFromFunction ? item.pedido_interno : (item.liberacao?.pedido_interno || "N/A"),
        status: item.status as AgendamentoStatus,
        armazem: isFromFunction 
          ? `${item.armazem_nome} - ${item.armazem_cidade}/${item.armazem_estado}`
          : (item.liberacao?.armazem ? `${item.liberacao.armazem.nome} - ${item.liberacao.armazem.cidade}/${item.liberacao.armazem.estado}` : "N/A"),
        produto_id: isFromFunction ? item.produto_id : item.liberacao?.produto?.id,
        armazem_id: isFromFunction ? item.armazem_id : item.liberacao?.armazem?.id,
        liberacao_id: isFromFunction ? item.liberacao_id : item.liberacao?.id,
        updated_at: item.updated_at,
        tipo_caminhao: item.tipo_caminhao,
        observacoes: item.observacoes,
        // 🚛 DADOS DO CARREGAMENTO PARA BARRA DE PROGRESSO
        etapa_carregamento: etapaAtual,
        status_carregamento: statusInfo.status,
        percentual_carregamento: statusInfo.percentual,
        cor_carregamento: statusInfo.cor,
        tooltip_carregamento: statusInfo.tooltip,
        finalizado, // 🆕 CAMPO PARA SEPARAR SEÇÕES
      };
    });
  }, [agendamentosData]);

  // Estado do formulário
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
  
  // Estados para validação de quantidade
  const [quantidadeDisponivel, setQuantidadeDisponivel] = useState<number>(0);
  const [validandoQuantidade, setValidandoQuantidade] = useState(false);

  // 🔄 QUERY DE LIBERAÇÕES DISPONÍVEIS ATUALIZADA PARA NOVOS STATUS
  const { data: liberacoesDisponiveis } = useQuery({
    queryKey: ["liberacoes-disponiveis", currentCliente?.id],
    queryFn: async () => {
      let query = supabase
        .from("liberacoes")
        .select(`
          id,
          pedido_interno,
          quantidade_liberada,
          quantidade_retirada,
          status,
          cliente_id,
          clientes(nome),
          produto:produtos(nome),
          armazem:armazens(id, cidade, estado, nome)
        `)
        .in("status", ["disponivel", "parcialmente_agendada"])
        .order("created_at", { ascending: false });

      if (userRole === "cliente" && currentCliente?.id) {
        query = query.eq("cliente_id", currentCliente.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      if (!data) return [];

      // 📊 CALCULAR DISPONIBILIDADE REAL PARA CADA LIBERAÇÃO
      const liberacoesComDisponibilidade = await Promise.all(
        data.map(async (lib: any) => {
          // Buscar agendamentos pendentes para esta liberação
          const { data: agendamentosPendentes } = await supabase
            .from("agendamentos")
            .select("quantidade")
            .eq("liberacao_id", lib.id)
            .in("status", ["pendente", "em_andamento"]);

          const totalAgendado = (agendamentosPendentes || []).reduce(
            (total, ag) => total + (ag.quantidade || 0), 
            0
          );

          const disponivel = Math.max(
            0, 
            lib.quantidade_liberada - (lib.quantidade_retirada || 0) - totalAgendado
          );

          return {
            ...lib,
            quantidade_disponivel_real: disponivel
          };
        })
      );
      
      return liberacoesComDisponibilidade.filter(lib => lib.quantidade_disponivel_real > 0);
    },
    enabled: userRole !== "cliente" || !!currentCliente?.id,
  });

  useEffect(() => {
    // Detectar se deve abrir o modal automaticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      // Limpar o parâmetro da URL sem recarregar a página
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
  };

  // 🔄 FUNÇÃO CORRIGIDA PARA CALCULAR QUANTIDADE DISPONÍVEL
  const atualizarQuantidadeDisponivel = async (liberacaoId: string) => {
    if (!liberacaoId) {
      setQuantidadeDisponivel(0);
      return;
    }
    
    setValidandoQuantidade(true);
    try {
      // 1. Buscar dados da liberação
      const liberacao = liberacoesDisponiveis?.find(lib => lib.id === liberacaoId);
      if (!liberacao) {
        setQuantidadeDisponivel(0);
        return;
      }

      // 2. Buscar agendamentos pendentes/em_andamento para esta liberação
      const { data: agendamentosPendentes, error } = await supabase
        .from("agendamentos")
        .select("quantidade")
        .eq("liberacao_id", liberacaoId)
        .in("status", ["pendente", "em_andamento"]);

      if (error) {
        console.error('Erro ao buscar agendamentos pendentes:', error);
        setQuantidadeDisponivel(0);
        return;
      }

      // 3. Calcular total agendado (pendente + em_andamento)
      const totalAgendado = (agendamentosPendentes || []).reduce(
        (total, agendamento) => total + (agendamento.quantidade || 0), 
        0
      );

      // 4. Calcular disponível = liberada - retirada - agendado
      const quantidadeLiberada = liberacao.quantidade_liberada || 0;
      const quantidadeRetirada = liberacao.quantidade_retirada || 0;
      const disponivel = Math.max(0, quantidadeLiberada - quantidadeRetirada - totalAgendado);
      
      setQuantidadeDisponivel(disponivel);
      
    } catch (error) {
      console.error('Erro ao calcular quantidade disponível:', error);
      setQuantidadeDisponivel(0);
    } finally {
      setValidandoQuantidade(false);
    }
  };

  // 🚀 FUNÇÃO DE CRIAÇÃO COM LOADING STATE
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

    // 🚀 ATIVAR LOADING STATE
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
      // 🚀 DESATIVAR LOADING STATE
      setIsCreating(false);
    }
  };

  // Filtros e busca
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<AgendamentoStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const allStatuses: AgendamentoStatus[] = ["pendente", "em_andamento", "concluido"];
  const toggleStatus = (st: AgendamentoStatus) => setSelectedStatuses((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  const clearFilters = () => { setSearch(""); setSelectedStatuses([]); setDateFrom(""); setDateTo(""); };

  // 🆕 SEPARAÇÃO EM ATIVOS E FINALIZADOS + FILTROS
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

  // 🆕 AUTO-EXPANSÃO: Se busca encontrou resultados em finalizados, expandir automaticamente
  useEffect(() => {
    if (search.trim() && agendamentosFinalizados.length > 0 && !secaoFinalizadosExpandida) {
      setSecaoFinalizadosExpandida(true);
    }
  }, [search, agendamentosFinalizados.length, secaoFinalizadosExpandida]);

  const showingCount = agendamentosAtivos.length + agendamentosFinalizados.length;
  const totalCount = agendamentos.length;
  const activeAdvancedCount = (selectedStatuses.length ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);
  
  // 🆕 VERIFICAR SE HÁ FILTROS ATIVOS
  const hasActiveFilters = search.trim() || selectedStatuses.length > 0 || dateFrom || dateTo;

  // Verificar se há liberações disponíveis
  const temLiberacoesDisponiveis = liberacoesDisponiveis && liberacoesDisponiveis.length > 0;

  // 🎯 LÓGICA PARA RENDERIZAR CARD PERSONALIZADO BASEADO NO PERFIL
  const renderEmptyLiberacoesCard = () => {
    if (userRole === "cliente") {
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

  // Validação em tempo real da quantidade
  const quantidadeValida = useMemo(() => {
    const qtd = Number(novoAgendamento.quantidade);
    return !isNaN(qtd) && qtd > 0 && qtd <= quantidadeDisponivel;
  }, [novoAgendamento.quantidade, quantidadeDisponivel]);

  // 🎨 FUNÇÃO PARA CORES DOS STATUS DE AGENDAMENTO
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

  // 🆕 COMPONENTE PARA RENDERIZAR CARDS DE AGENDAMENTO
  const renderAgendamentoCard = (ag: AgendamentoItem) => (
    <Card key={ag.id} className="transition-all hover:shadow-md cursor-pointer">
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div 
              className="flex items-start gap-4 flex-1"
              onClick={() => setDetalhesAgendamento(ag)}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                {/* 🎯 LAYOUT DO CARD COM "QUANTIDADE" */}
                <h3 className="font-semibold text-foreground">Pedido: {ag.pedido}</h3>
                <p className="text-xs text-muted-foreground">Cliente: <span className="font-semibold">{ag.cliente}</span></p>
                <p className="text-xs text-muted-foreground">Produto: <span className="font-semibold">{ag.produto}</span></p>
                <p className="text-xs text-muted-foreground">Armazém: <span className="font-semibold">{ag.armazem}</span></p>
                <p className="text-xs text-muted-foreground">Quantidade: <span className="font-semibold">{ag.quantidade.toLocaleString('pt-BR')}t</span></p>
              </div>
            </div>
            
            {/* 🎨 BADGE DE STATUS DO AGENDAMENTO COM TOOLTIP HÍBRIDO */}
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center gap-1 cursor-help"
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

          {/* 📋 INFORMAÇÕES DO AGENDAMENTO - CLICÁVEL */}
          <div 
            className="grid grid-cols-1 lg:grid-cols-4 gap-4 text-sm pt-2"
            onClick={() => setDetalhesAgendamento(ag)}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{ag.data}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span>{formatPlaca(ag.placa)}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{ag.motorista}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{formatCPF(ag.documento)}</span>
            </div>
          </div>

          {/* 📊 BARRA DE PROGRESSO CORRIGIDA COM TOOLTIP HÍBRIDO E ÍCONE "i" */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <div 
                className="flex items-center gap-2"
                onClick={() => setDetalhesAgendamento(ag)}
              >
                <Truck className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-purple-600 font-medium w-24">Carregamento:</span>
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
                    className="flex items-center gap-1 cursor-help"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium w-12">
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
      <div className="min-h-screen bg-background p-6 space-y-6">
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
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader title="Agendamentos de Retirada" subtitle="Erro ao carregar dados" icon={Calendar} actions={<></>} />
        <div className="text-center">
          <p className="text-destructive">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader
          title="Agendamentos de Retirada"
          subtitle="Gerencie os agendamentos de retirada de produtos"
          icon={Calendar}
          actions={
            canCreate ? (
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                // 🚀 BLOQUEAR FECHAMENTO DURANTE CRIAÇÃO
                if (!open && isCreating) return;
                setDialogOpen(open);
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Agendamento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Agendamento</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="liberacao">Liberação *</Label>
                      {temLiberacoesDisponiveis ? (
                        <Select
                          value={novoAgendamento.liberacao}
                          onValueChange={async (v) => {
                            setNovoAgendamento((s) => ({ ...s, liberacao: v, quantidade: "" }));
                            await atualizarQuantidadeDisponivel(v);
                          }}
                          disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
                        >
                          <SelectTrigger id="liberacao">
                            <SelectValue placeholder="Selecione a liberação" />
                          </SelectTrigger>
                          <SelectContent>
                            {liberacoesDisponiveis?.map((lib: any) => {
                              const disponivel = lib.quantidade_disponivel_real || 
                                (lib.quantidade_liberada - (lib.quantidade_retirada || 0));
                              return (
                                <SelectItem key={lib.id} value={lib.id}>
                                  {lib.pedido_interno} - {lib.clientes?.nome} - {lib.produto?.nome} ({disponivel.toLocaleString('pt-BR')}t disponível) - {lib.armazem?.cidade}/{lib.armazem?.estado}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="quantidade">Quantidade (t) *</Label>
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
                              onChange={(e) => setNovoAgendamento((s) => ({ ...s, quantidade: e.target.value }))}
                              placeholder="0.00"
                              className={
                                novoAgendamento.quantidade && !quantidadeValida 
                                  ? "border-red-500 focus:border-red-500" 
                                  : novoAgendamento.quantidade && quantidadeValida
                                  ? "border-green-500 focus:border-green-500"
                                  : ""
                              }
                              disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
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
                            <Label htmlFor="data">Data *</Label>
                            <Input
                              id="data"
                              type="date"
                              value={novoAgendamento.data}
                              onChange={(e) => setNovoAgendamento((s) => ({ ...s, data: e.target.value }))}
                              disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="placa">Placa do Veículo *</Label>
                          <Input
                            id="placa"
                            value={novoAgendamento.placa}
                            onChange={(e) =>
                              setNovoAgendamento((s) => ({
                                ...s,
                                placa: maskPlaca(e.target.value),
                              }))
                            }
                            placeholder="Ex: ABC-1234 ou ABC-1D23"
                            maxLength={9}
                            autoCapitalize="characters"
                            spellCheck={false}
                            inputMode="text"
                            disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
                          />
                          <p className="text-xs text-muted-foreground">Formato antigo (ABC-1234) ou Mercosul (ABC-1D23)</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="motorista">Nome do Motorista *</Label>
                            <Input
                              id="motorista"
                              value={novoAgendamento.motorista}
                              onChange={(e) => setNovoAgendamento((s) => ({ ...s, motorista: e.target.value }))}
                              placeholder="Ex: João Silva"
                              disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="documento">Documento (CPF) *</Label>
                            <Input
                              id="documento"
                              value={novoAgendamento.documento}
                              onChange={(e) =>
                                setNovoAgendamento((s) => ({
                                  ...s,
                                  documento: maskCPF(e.target.value),
                                }))
                              }
                              placeholder="Ex: 123.456.789-00"
                              maxLength={14}
                              disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="tipoCaminhao">Tipo de Caminhão</Label>
                          <Input
                            id="tipoCaminhao"
                            value={novoAgendamento.tipoCaminhao}
                            onChange={(e) => setNovoAgendamento((s) => ({ ...s, tipoCaminhao: e.target.value }))}
                            placeholder="Ex: Bitrem, Carreta, Truck"
                            disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="observacoes">Observações</Label>
                          <Input
                            id="observacoes"
                            value={novoAgendamento.observacoes}
                            onChange={(e) => setNovoAgendamento((s) => ({ ...s, observacoes: e.target.value }))}
                            placeholder="Informações adicionais sobre o agendamento"
                            disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
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
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setDialogOpen(false)}
                      disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
                    >
                      Cancelar
                    </Button>
                    <Button 
                      className="bg-gradient-primary" 
                      onClick={handleCreateAgendamento}
                      disabled={!temLiberacoesDisponiveis || !quantidadeValida || validandoQuantidade || isCreating} // 🚀 DESABILITAR DURANTE LOADING
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        "Criar Agendamento"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        <div className="flex items-center gap-3">
          <Input className="h-9 flex-1" placeholder="Buscar por cliente, produto, pedido ou motorista..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Mostrando <span className="font-medium">{showingCount}</span> de <span className="font-medium">{totalCount}</span></span>
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen((v) => !v)}>
            <FilterIcon className="h-4 w-4 mr-1" />
            Filtros {activeAdvancedCount ? `(${activeAdvancedCount})` : ""}
            {filtersOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-4 w-4" /> 
              Limpar Filtros
            </Button>
          )}
        </div>
        
        {filtersOpen && (
          <div className="rounded-md border p-3 space-y-6 relative">
            <div>
              <Label className="text-sm font-semibold mb-1">Status do Agendamento</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {STATUS_AGENDAMENTO.map((status) => {
                  const active = selectedStatuses.includes(status.id as AgendamentoStatus);
                  return (
                    <Badge
                      key={status.id}
                      onClick={() => toggleStatus(status.id as AgendamentoStatus)}
                      className={`cursor-pointer text-xs px-2 py-1 border-0 ${
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
            <div className="flex items-center gap-4">
              <Label className="text-sm font-semibold mb-1">Período</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[160px]" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[160px]" />
              <div className="flex-1"></div>
            </div>
          </div>
        )}

        {/* ✅ ITEM 5.6: MODAL DE DETALHES DO AGENDAMENTO COMPACTADO */}
        <Dialog open={!!detalhesAgendamento} onOpenChange={open => !open && setDetalhesAgendamento(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Agendamento</DialogTitle>
              <DialogDescription>
                Pedido: {detalhesAgendamento?.pedido}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {detalhesAgendamento && (
                <>
                  {/* ✅ ITEM 5.6: LAYOUT COMPACTADO CONFORME ESPECIFICAÇÃO */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Data de Retirada:</Label>
                      <p className="font-semibold">{detalhesAgendamento.data}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status:</Label>
                      <Badge className={getStatusColor(detalhesAgendamento.status)}>
                        {getStatusLabel(detalhesAgendamento.status)}
                      </Badge>
                    </div>
                  </div>

                  {/* Separador */}
                  <div className="border-t"></div>

                  {/* Cliente e Armazém */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cliente:</Label>
                      <p className="font-semibold">{detalhesAgendamento.cliente}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Armazém:</Label>
                      <p className="font-semibold">{detalhesAgendamento.armazem}</p>
                    </div>
                  </div>

                  {/* Separador */}
                  <div className="border-t"></div>

                  {/* Produto e Quantidade */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Produto:</Label>
                      <p className="font-semibold">{detalhesAgendamento.produto}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantidade:</Label>
                      <p className="font-semibold">{detalhesAgendamento.quantidade.toLocaleString('pt-BR')}t</p>
                    </div>
                  </div>

                  {/* Separador */}
                  <div className="border-t"></div>

                  {/* Informações do Motorista e Veículo */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome do Motorista:</Label>
                      <p className="font-semibold">{detalhesAgendamento.motorista}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CPF do Motorista:</Label>
                      <p className="font-semibold">{formatCPF(detalhesAgendamento.documento)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Placa do Veículo:</Label>
                      <p className="font-semibold">{formatPlaca(detalhesAgendamento.placa)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Tipo de Caminhão:</Label>
                      <p className="font-semibold">{detalhesAgendamento.tipo_caminhao || "—"}</p>
                    </div>
                  </div>

                  {/* Observações (se houver) */}
                  {detalhesAgendamento.observacoes && (
                    <>
                      <div className="border-t"></div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Observações:</Label>
                        <p className="text-sm bg-muted p-3 rounded-md mt-1">
                          {detalhesAgendamento.observacoes}
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setDetalhesAgendamento(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 🆕 SEÇÃO DE AGENDAMENTOS ATIVOS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Agendamentos Ativos ({agendamentosAtivos.length})</h2>
          </div>
          
          <div className="grid gap-4">
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
                    variant="outline" 
                    size="sm" 
                    onClick={clearFilters}
                    className="mt-2"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 🆕 SEÇÃO DE AGENDAMENTOS FINALIZADOS (COLAPSÁVEL) */}
        {agendamentosFinalizados.length > 0 && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              className="flex items-center gap-2 p-0 h-auto text-lg font-semibold hover:bg-transparent"
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
              <div className="grid gap-4 ml-7">
                {agendamentosFinalizados.map(renderAgendamentoCard)}
              </div>
            )}
          </div>
        )}

        {/* Mensagem quando não há dados */}
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
                variant="outline" 
                size="sm" 
                onClick={clearFilters}
                className="mt-2"
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
