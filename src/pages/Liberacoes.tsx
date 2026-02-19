import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ClipboardList, X, Filter as FilterIcon, ChevronDown, ChevronUp, AlertCircle, ExternalLink, Calendar, Info, Loader2, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { ModalFooter } from "@/components/ui/modal-footer";

type StatusLiberacao = "disponivel" | "parcialmente_agendada" | "totalmente_agendada";

const STATUS_LIBERACAO = [
  { id: "disponivel", nome: "Disponível", cor: "bg-green-100 text-green-800 hover:bg-green-200" },
  { id: "parcialmente_agendada", nome: "Parcialmente Agendada", cor: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  { id: "totalmente_agendada", nome: "Totalmente Agendada", cor: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
];

interface LiberacaoItem {
  id: string;
  produto: string;
  cliente: string;
  quantidade: number;
  quantidadeRetirada: number;
  pedido: string;
  data: string;
  status: StatusLiberacao;
  armazem?: string;
  produto_id?: string;
  armazem_id?: string;
  created_at?: string;
  quantidadeAgendada: number;
  percentualRetirado: number;
  percentualAgendado: number;
  finalizada: boolean;
}

const getLiberacaoStatusTooltip = (status: StatusLiberacao) => {
  switch (status) {
    case "disponivel":
      return "Esta liberação está disponível para agendamento de retirada";
    case "parcialmente_agendada":
      return "Esta liberação possui agendamentos, mas ainda há quantidade disponível";
    case "totalmente_agendada":
      return "Toda a quantidade desta liberação já foi agendada para retirada";
    default:
      return "";
  }
};

const getAgendamentoBarTooltip = (percentualAgendado: number, quantidadeAgendada: number, quantidadeTotal: number) => {
  if (percentualAgendado === 0) {
    return "Nenhuma quantidade desta liberação foi agendada para retirada";
  } else if (percentualAgendado === 100) {
    return `Toda a quantidade desta liberação (${quantidadeTotal.toLocaleString('pt-BR')}t) foi agendada para retirada`;
  } else {
    const quantidadeRestante = quantidadeTotal - quantidadeAgendada;
    return `${quantidadeAgendada.toLocaleString('pt-BR')}t agendada de ${quantidadeTotal.toLocaleString('pt-BR')}t total. Restam ${quantidadeRestante.toLocaleString('pt-BR')}t disponíveis para agendamento`;
  }
};

const EmptyStateCard = ({ 
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

const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Liberacoes = () => {
  useScrollToTop();
  
  const { hasRole, userRole, user } = useAuth();
  const { clientesDoRepresentante, representanteId } = usePermissions();

  
  useEffect(() => {
    if (userRole === "armazem") {
      window.location.href = "/";
      return;
    }
  }, [userRole]);

  if (userRole === "armazem") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  const canCreate = hasRole("logistica") || hasRole("admin");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [detalhesLiberacao, setDetalhesLiberacao] = useState<LiberacaoItem | null>(null);
  const [secaoFinalizadasExpandida, setSecaoFinalizadasExpandida] = useState(false);

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
  const { data: liberacoesData, isLoading, error } = useQuery({
    queryKey: ["liberacoes", currentCliente?.id, currentArmazem?.id, representanteId, userRole],
    queryFn: async () => {

      
      // 🚀 USAR FUNÇÃO UNIVERSAL PARA TODOS OS ROLES
      const { data, error } = await supabase.rpc('get_liberacoes_universal', {
        p_user_role: userRole,
        p_user_id: user?.id,
        p_cliente_id: currentCliente?.id || null,
        p_armazem_id: currentArmazem?.id || null,
        p_representante_id: representanteId || null
      });
      
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
      
      return clienteOk && armazemOk && representanteOk;
    })(),
  });

  const { data: agendamentosData } = useQuery({
    queryKey: ["agendamentos-totais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          liberacao_id,
          quantidade,
          status
        `)
        .in("status", ["pendente", "em_andamento", "concluido"]);

      if (error) throw error;
      
      const agrupados = (data || []).reduce((acc: Record<string, number>, item) => {
        acc[item.liberacao_id] = (acc[item.liberacao_id] || 0) + Number(item.quantidade);
        return acc;
      }, {});
      
      return agrupados;
    },
    refetchInterval: 30000,
  });

  // ✅ USEMEMO HÍBRIDO - SUPORTA FUNÇÃO UNIVERSAL E FALLBACK
  const liberacoes = useMemo(() => {
    if (!liberacoesData) return [];
    
    return liberacoesData.map((item: any) => {
      // ✅ Verificar se vem da função universal (tem campos calculados)
      const isFromFunction = !!item.produto_nome;
      
      if (isFromFunction) {
        // ✅ Dados já calculados da função universal
        return {
          id: item.id,
          produto: item.produto_nome,
          cliente: item.cliente_nome,
          quantidade: item.quantidade_liberada,
          quantidadeRetirada: item.quantidade_retirada,
          quantidadeAgendada: item.quantidade_agendada,
          percentualRetirado: item.percentual_retirado,
          percentualAgendado: item.percentual_agendado,
          pedido: item.pedido_interno,
          data: new Date(item.data_liberacao).toLocaleDateString("pt-BR"),
          status: item.status,
          armazem: `${item.armazem_nome} - ${item.armazem_cidade}/${item.armazem_estado}`,
          produto_id: item.produto_id,
          armazem_id: item.armazem_id,
          created_at: item.created_at,
          finalizada: item.finalizada || false,
        };
      } else {
        // ❌ Fallback para dados da query tradicional (não deveria acontecer)
        const quantidadeRetirada = item.quantidade_retirada || 0;
        const quantidadeAgendada = agendamentosData?.[item.id] || 0;
        
        const percentualRetirado = item.quantidade_liberada > 0 
          ? Math.round((quantidadeRetirada / item.quantidade_liberada) * 100) 
          : 0;
        const percentualAgendado = item.quantidade_liberada > 0 
          ? Math.round((quantidadeAgendada / item.quantidade_liberada) * 100) 
          : 0;

        const finalizada = quantidadeRetirada >= item.quantidade_liberada;

        return {
          id: item.id,
          produto: item.produtos?.nome || "N/A",
          cliente: item.clientes?.nome || "N/A",
          quantidade: item.quantidade_liberada,
          quantidadeRetirada,
          quantidadeAgendada,
          percentualRetirado,
          percentualAgendado,
          pedido: item.pedido_interno,
          data: new Date(item.data_liberacao || item.created_at).toLocaleDateString("pt-BR"),
          status: item.status as StatusLiberacao,
          armazem: item.armazens ? `${item.armazens.nome} - ${item.armazens.cidade}/${item.armazens.estado}` : "N/A",
          produto_id: item.produto_id,
          armazem_id: item.armazem_id,
          created_at: item.created_at,
          finalizada,
        };
      }
    });
  }, [liberacoesData, agendamentosData]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaLiberacao, setNovaLiberacao] = useState({
    produto: "",
    armazem: "",
    cliente_id: "",
    pedido: "",
    quantidade: "",
  });
  const [quantidadeEstoque, setQuantidadeEstoque] = useState<number>(0);
  const [validandoEstoque, setValidandoEstoque] = useState(false);
  const [temEstoqueCadastrado, setTemEstoqueCadastrado] = useState<boolean | null>(null);

  const { data: produtos } = useQuery({
    queryKey: ["produtos-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
  });
  
  const { data: armazens } = useQuery({
    queryKey: ["armazens-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado")
        .eq("ativo", true)
        .order("cidade");
      return data || [];
    },
  });
  
  const { data: clientesData } = useQuery({
    queryKey: ["clientes-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, cnpj_cpf")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const validarEstoque = async (produtoId: string, armazemId: string) => {
    if (!produtoId || !armazemId) {
      setQuantidadeEstoque(0);
      setTemEstoqueCadastrado(null);
      return;
    }
    
    setValidandoEstoque(true);
    try {
      const { data: estoqueData, error } = await supabase
        .from("estoque")
        .select("quantidade")
        .eq("produto_id", produtoId)
        .eq("armazem_id", armazemId)
        .maybeSingle();

      if (error) {
        setQuantidadeEstoque(0);
        setTemEstoqueCadastrado(false);
        return;
      }

      if (estoqueData) {
        setQuantidadeEstoque(estoqueData.quantidade || 0);
        setTemEstoqueCadastrado(true);
      } else {
        setQuantidadeEstoque(0);
        setTemEstoqueCadastrado(false);
      }
      
    } catch (error) {
      setQuantidadeEstoque(0);
      setTemEstoqueCadastrado(false);
    } finally {
      setValidandoEstoque(false);
    }
  };

  const quantidadeValida = useMemo(() => {
    const qtd = Number(novaLiberacao.quantidade);
    return !isNaN(qtd) && qtd > 0 && qtd <= quantidadeEstoque;
  }, [novaLiberacao.quantidade, quantidadeEstoque]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [canCreate]);

  useEffect(() => {
    if (novaLiberacao.produto && novaLiberacao.armazem) {
      validarEstoque(novaLiberacao.produto, novaLiberacao.armazem);
    } else {
      setQuantidadeEstoque(0);
      setTemEstoqueCadastrado(null);
    }
  }, [novaLiberacao.produto, novaLiberacao.armazem]);
  
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusLiberacao[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedArmazens, setSelectedArmazens] = useState<string[]>([]);

  const allStatuses: StatusLiberacao[] = ["disponivel", "parcialmente_agendada", "totalmente_agendada"];
  const allArmazens = useMemo(
    () => Array.from(new Set(liberacoes.map((l) => l.armazem).filter(Boolean))) as string[],
    [liberacoes]
  );

  const toggleStatus = (st: StatusLiberacao) =>
    setSelectedStatuses((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  const toggleArmazem = (a: string) =>
    setSelectedArmazens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  const clearFilters = () => {
    setSearch("");
    setSelectedStatuses([]);
    setDateFrom("");
    setDateTo("");
    setSelectedArmazens([]);
  };

  const { liberacoesAtivas, liberacoesFinalizadas } = useMemo(() => {
    const filtered = liberacoes.filter((l) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${l.produto} ${l.cliente} ${l.pedido}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(l.status)) return false;
      if (selectedArmazens.length > 0 && l.armazem && !selectedArmazens.includes(l.armazem)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (parseDate(l.data) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (parseDate(l.data) > to) return false;
      }
      return true;
    });

    const ativas = filtered.filter(l => !l.finalizada);
    const finalizadas = filtered.filter(l => l.finalizada);

    return { liberacoesAtivas: ativas, liberacoesFinalizadas: finalizadas };
  }, [liberacoes, search, selectedStatuses, selectedArmazens, dateFrom, dateTo]);

  useEffect(() => {
    if (search.trim() && liberacoesFinalizadas.length > 0 && !secaoFinalizadasExpandida) {
      setSecaoFinalizadasExpandida(true);
    }
  }, [search, liberacoesFinalizadas.length, secaoFinalizadasExpandida]);

  const showingCount = liberacoesAtivas.length + liberacoesFinalizadas.length;
  const totalCount = liberacoes.length;
  const activeAdvancedCount =
    (selectedStatuses.length ? 1 : 0) +
    (selectedArmazens.length ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);
  
  const hasActiveFilters = search.trim() || selectedStatuses.length > 0 || selectedArmazens.length > 0 || dateFrom || dateTo;

  const resetFormNovaLiberacao = () => {
    setNovaLiberacao({ produto: "", armazem: "", cliente_id: "", pedido: "", quantidade: "" });
    setQuantidadeEstoque(0);
    setTemEstoqueCadastrado(null);
    setValidandoEstoque(false);
  };

  const handleCreateLiberacao = async () => {
    const { produto, armazem, cliente_id, pedido, quantidade } = novaLiberacao;

    if (!produto || !armazem || !cliente_id || !pedido.trim() || !quantidade) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }
    const qtdNum = Number(quantidade);
    if (Number.isNaN(qtdNum) || qtdNum <= 0) {
      toast({ variant: "destructive", title: "Quantidade inválida" });
      return;
    }

    if (!temEstoqueCadastrado) {
      toast({ 
        variant: "destructive", 
        title: "Estoque não cadastrado", 
        description: "É necessário cadastrar estoque para este produto no armazém selecionado." 
      });
      return;
    }

    if (qtdNum > quantidadeEstoque) {
      toast({ 
        variant: "destructive", 
        title: "Estoque insuficiente", 
        description: `Quantidade solicitada (${qtdNum.toLocaleString('pt-BR')}t) excede o estoque disponível (${quantidadeEstoque.toLocaleString('pt-BR')}t).` 
      });
      return;
    }

    const clienteSelecionado = clientesData?.find(c => c.id === cliente_id);
    if (!clienteSelecionado) {
      toast({ variant: "destructive", title: "Cliente inválido" });
      return;
    }

    setIsCreating(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error: errLib } = await supabase
        .from("liberacoes")
        .insert({
          produto_id: produto,
          armazem_id: armazem,
          cliente_id: cliente_id,
          pedido_interno: pedido.trim(),
          quantidade_liberada: qtdNum,
          quantidade_retirada: 0,
          status: "disponivel",
          data_liberacao: new Date().toISOString().split('T')[0],
          created_by: userData.user?.id,
        })
        .select("id")
        .single();

      if (errLib) {
        throw new Error(`Erro ao criar liberação: ${errLib.message} (${errLib.code || 'N/A'})`);
      }

      toast({
        title: "Liberação criada com sucesso!",
        description: `Pedido ${pedido} para ${clienteSelecionado.nome} - ${qtdNum}t`
      });

      resetFormNovaLiberacao();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["liberacoes", currentCliente?.id, currentArmazem?.id] });

    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Erro ao criar liberação",
        description: err instanceof Error ? err.message : "Erro desconhecido"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusColor = (status: StatusLiberacao) => {
    switch (status) {
      case "disponivel":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "parcialmente_agendada":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "totalmente_agendada":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const getStatusLabel = (status: StatusLiberacao) => {
    switch (status) {
      case "disponivel":
        return "Disponível";
      case "parcialmente_agendada":
        return "Parcialmente Agendada";
      case "totalmente_agendada":
        return "Totalmente Agendada";
      default:
        return status;
    }
  };

  const renderLiberacaoCard = (lib: LiberacaoItem) => (
    <Card key={lib.id} className="transition-all hover:shadow-md cursor-pointer">
      <CardContent className="p-4 md:p-5">
        <div className="space-y-3">
          {/* Layout Mobile-First: Badge no topo em mobile, ao lado em desktop */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            {/* Badge - Primeiro em mobile, à direita em desktop */}
            <div className="flex justify-start md:order-2 md:justify-end">
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-1 cursor-help"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Badge className={`${getStatusColor(lib.status)} text-xs px-2 py-1 text-center`}>
                      {getStatusLabel(lib.status)}
                    </Badge>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{getLiberacaoStatusTooltip(lib.status)}</p>
                </TooltipContent>
              </Tooltip>
            </div>
  
            {/* Conteúdo principal - Segundo em mobile, à esquerda em desktop */}
            <div 
              className="flex items-start gap-3 md:gap-4 flex-1 min-w-0 md:order-1"
              onClick={() => setDetalhesLiberacao(lib)}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary shrink-0">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-semibold text-foreground text-sm md:text-base">Pedido: {lib.pedido}</h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><span className="font-semibold">Cliente:</span> {lib.cliente}</p>
                  <p><span className="font-semibold">Produto:</span> {lib.produto}</p>
                  <p className="break-words"><span className="font-semibold">Armazém:</span> {lib.armazem}</p>
                </div>
                
                <div className="mt-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="whitespace-nowrap">
                      <span className="font-medium text-foreground">Liberada:</span> {lib.quantidade.toLocaleString('pt-BR')}t
                    </span>
                    <span className="whitespace-nowrap">
                      <span className="font-medium text-blue-600">Agendada:</span> {lib.quantidadeAgendada.toLocaleString('pt-BR')}t
                    </span>
                    <span className="whitespace-nowrap">
                      <span className="font-medium text-orange-600">Retirada:</span> {lib.quantidadeRetirada.toLocaleString('pt-BR')}t
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
  
          {/* Barra de progresso - Sempre na parte inferior */}
          <div 
            className="pt-2 border-t"
            onClick={() => setDetalhesLiberacao(lib)}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-xs text-blue-600 font-medium shrink-0">Agendamento:</span>
              
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div 
                    className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700 cursor-help min-w-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${lib.percentualAgendado}%` }}
                    ></div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{getAgendamentoBarTooltip(lib.percentualAgendado, lib.quantidadeAgendada, lib.quantidade)}</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-1 cursor-help shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium w-8 text-right">
                      {lib.percentualAgendado}%
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{getAgendamentoBarTooltip(lib.percentualAgendado, lib.quantidadeAgendada, lib.quantidade)}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const temProdutosDisponiveis = produtos && produtos.length > 0;
  const temArmazensDisponiveis = armazens && armazens.length > 0;
  const temClientesDisponiveis = clientesData && clientesData.length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader title="Liberações de Produtos" subtitle="Carregando..." icon={ClipboardList} actions={<></>} />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando liberações...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader title="Liberações de Produtos" subtitle="Erro ao carregar dados" icon={ClipboardList} actions={<></>} />
        <div className="text-center">
          <p className="text-destructive">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader
          title="Liberações de Produtos"
          subtitle="Gerencie as liberações de produtos para clientes"
          icon={ClipboardList}
          actions={
            canCreate ? (
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                if (!open && isCreating) return;
                setDialogOpen(open);
              }}>
                <DialogTrigger asChild>
                  <Button className="btn-primary min-h-[44px] max-md:min-h-[44px]">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Liberação
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-lg max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
                  <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
                    <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Nova Liberação</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 px-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pedido" className="text-sm font-medium">Número do Pedido *</Label>
                      <Input
                        id="pedido"
                        value={novaLiberacao.pedido}
                        onChange={(e) => setNovaLiberacao((s) => ({ ...s, pedido: e.target.value }))}
                        placeholder="Ex: PED-2024-001"
                        disabled={isCreating}
                        className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="produto" className="text-sm font-medium">Produto *</Label>
                      {temProdutosDisponiveis ? (
                        <Select 
                          value={novaLiberacao.produto} 
                          onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, produto: v, quantidade: "" }))}
                          disabled={isCreating}
                        >
                          <SelectTrigger id="produto" className="min-h-[44px] max-md:min-h-[44px]">
                            <SelectValue placeholder="Selecione o produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {produtos?.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <EmptyStateCard
                          title="Nenhum produto cadastrado"
                          description="Para criar liberações, você precisa cadastrar produtos primeiro."
                          actionText="Cadastrar Produto"
                          actionUrl="https://logi-sys-shiy.vercel.app/produtos?modal=novo"
                        />
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="armazem" className="text-sm font-medium">Armazém *</Label>
                      {temArmazensDisponiveis ? (
                        <Select 
                          value={novaLiberacao.armazem} 
                          onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, armazem: v, quantidade: "" }))}
                          disabled={isCreating}
                        >
                          <SelectTrigger id="armazem" className="min-h-[44px] max-md:min-h-[44px]">
                            <SelectValue placeholder="Selecione o armazém" />
                          </SelectTrigger>
                          <SelectContent>
                            {armazens?.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                <span className="break-words">{a.cidade}{a.estado ? "/" + a.estado : ""} - {a.nome}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <EmptyStateCard
                          title="Nenhum armazém cadastrado"
                          description="Para criar liberações, você precisa cadastrar armazéns primeiro."
                          actionText="Cadastrar Armazém"
                          actionUrl="https://logi-sys-shiy.vercel.app/armazens?modal=novo"
                        />
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cliente" className="text-sm font-medium">Cliente *</Label>
                      {temClientesDisponiveis ? (
                        <Select 
                          value={novaLiberacao.cliente_id} 
                          onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, cliente_id: v }))}
                          disabled={isCreating}
                        >
                          <SelectTrigger id="cliente" className="min-h-[44px] max-md:min-h-[44px]">
                            <SelectValue placeholder="Selecione o cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientesData?.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id}>
                                <span className="break-words">{cliente.nome} - {cliente.cnpj_cpf}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <EmptyStateCard
                          title="Nenhum cliente cadastrado"
                          description="Para criar liberações, você precisa cadastrar clientes primeiro."
                          actionText="Cadastrar Cliente"
                          actionUrl="https://logi-sys-shiy.vercel.app/clientes?modal=novo"
                        />
                      )}
                    </div>
                    
                    {novaLiberacao.produto && novaLiberacao.armazem && temEstoqueCadastrado === false && (
                      <EmptyStateCard
                        title="Estoque não cadastrado"
                        description="Este produto não possui estoque cadastrado no armazém selecionado. É necessário registrar uma entrada de estoque primeiro."
                        actionText="Registrar Estoque"
                        actionUrl={`https://logi-sys-shiy.vercel.app/estoque?modal=novo&produto=${novaLiberacao.produto}&armazem=${novaLiberacao.armazem}`}
                      />
                    )}
                    
                    {temProdutosDisponiveis && temArmazensDisponiveis && temClientesDisponiveis && temEstoqueCadastrado && (
                      <div className="space-y-2">
                        <Label htmlFor="quantidade" className="text-sm font-medium">Quantidade (t) *</Label>
                        {novaLiberacao.produto && novaLiberacao.armazem && (
                          <div className="text-sm text-muted-foreground mb-1">
                            {validandoEstoque ? (
                              <span className="flex items-center gap-1">
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                Verificando estoque...
                              </span>
                            ) : (
                              <span className={quantidadeEstoque > 0 ? "text-green-600" : "text-red-600"}>
                                Estoque disponível: {quantidadeEstoque.toLocaleString('pt-BR')}t
                              </span>
                            )}
                          </div>
                        )}
                        <Input
                          id="quantidade"
                          type="number"
                          step="0.01"
                          min="0"
                          max={quantidadeEstoque || undefined}
                          value={novaLiberacao.quantidade}
                          onChange={(e) => setNovaLiberacao((s) => ({ ...s, quantidade: e.target.value }))}
                          placeholder="0.00"
                          className={`min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base ${
                            novaLiberacao.quantidade && !quantidadeValida 
                              ? "border-red-500 focus:border-red-500" 
                              : novaLiberacao.quantidade && quantidadeValida
                              ? "border-green-500 focus:border-green-500"
                              : ""
                          }`}
                          disabled={isCreating}
                        />
                        {novaLiberacao.quantidade && !quantidadeValida && (
                          <p className="text-xs text-red-600">
                            {Number(novaLiberacao.quantidade) > quantidadeEstoque 
                              ? `Quantidade excede o estoque disponível (${quantidadeEstoque.toLocaleString('pt-BR')}t)`
                              : "Quantidade deve ser maior que zero"
                            }
                          </p>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      * Campos obrigatórios
                    </p>
                  </div>
                  
                  {/* Botões no final do conteúdo */}
                  <ModalFooter 
                    variant="double"
                    onClose={() => setDialogOpen(false)}
                    onConfirm={handleCreateLiberacao}
                    confirmText="Criar Liberação"
                    isLoading={isCreating}
                    disabled={
                      !temProdutosDisponiveis || 
                      !temArmazensDisponiveis || 
                      !temClientesDisponiveis || 
                      !temEstoqueCadastrado || 
                      !quantidadeValida || 
                      validandoEstoque ||
                      isCreating
                    }
                  />
                </DialogContent>
              </Dialog>
            ) : null
          }
        />
        
        {/* Barra de filtros otimizada para mobile */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Input 
              className="h-9 flex-1 min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base" 
              placeholder="Buscar por produto, cliente ou pedido..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
            <Button 
              size="sm" 
              className="whitespace-nowrap min-h-[44px] max-md:min-h-[44px] btn-secondary" 
              onClick={() => setFiltersOpen((v) => !v)}
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

        {/* Filtros otimizados para mobile */}
        {filtersOpen && (
          <div className="rounded-md border p-3 space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Status da Liberação</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_LIBERACAO.map((status) => {
                  const active = selectedStatuses.includes(status.id as StatusLiberacao);
                  return (
                    <Badge
                      key={status.id}
                      onClick={() => toggleStatus(status.id as StatusLiberacao)}
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
            
            {allArmazens.length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Armazém</Label>
                <div className="flex flex-wrap gap-2">
                  {allArmazens.map((a) => {
                    const active = selectedArmazens.includes(a);
                    return (
                      <Badge 
                        key={a} 
                        onClick={() => toggleArmazem(a)} 
                        className={`cursor-pointer text-xs px-2 py-1 min-h-[32px] break-words ${
                          active ? "bg-gradient-primary text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {a}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            
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

        {/* Modal de detalhes otimizado para mobile */}
        <Dialog open={!!detalhesLiberacao} onOpenChange={open => !open && setDetalhesLiberacao(null)}>
          <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[90vh] overflow-y-auto my-4 md:my-8">
            <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
              <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Detalhes da Liberação</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Pedido: {detalhesLiberacao?.pedido}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 px-1 space-y-4">
              {detalhesLiberacao && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Data de Criação:</Label>
                      <p className="font-semibold text-sm md:text-base">{detalhesLiberacao.data}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status:</Label>
                      <Badge className={`${getStatusColor(detalhesLiberacao.status)} mt-1`}>
                        {getStatusLabel(detalhesLiberacao.status)}
                      </Badge>
                    </div>
                  </div>

                  <div className="border-t"></div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cliente:</Label>
                      <p className="font-semibold text-sm md:text-base break-words">{detalhesLiberacao.cliente}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Armazém:</Label>
                      <p className="font-semibold text-sm md:text-base break-words">{detalhesLiberacao.armazem}</p>
                    </div>
                  </div>

                  <div className="border-t"></div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Produto:</Label>
                    <p className="font-semibold text-sm md:text-base break-words">{detalhesLiberacao.produto}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantidade Liberada:</Label>
                      <p className="font-semibold text-base md:text-lg">{detalhesLiberacao.quantidade.toLocaleString('pt-BR')}t</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantidade Agendada:</Label>
                      <p className="font-semibold text-base md:text-lg text-blue-600">{detalhesLiberacao.quantidadeAgendada.toLocaleString('pt-BR')}t</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantidade Retirada:</Label>
                      <p className="font-semibold text-base md:text-lg text-orange-600">{detalhesLiberacao.quantidadeRetirada.toLocaleString('pt-BR')}t</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="pt-4 border-t border-border bg-background flex justify-end">
              <Button 
                onClick={() => setDetalhesLiberacao(null)}
                className="min-h-[44px] max-md:min-h-[44px] w-full md:w-auto btn-primary"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-base md:text-lg font-semibold">Liberações Ativas ({liberacoesAtivas.length})</h2>
          </div>
          
          <div className="grid gap-3 md:gap-4">
            {liberacoesAtivas.map(renderLiberacaoCard)}
            {liberacoesAtivas.length === 0 && (
              <div className="text-center py-8">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-sm md:text-base">
                  {hasActiveFilters
                    ? "Nenhuma liberação ativa encontrada com os filtros aplicados"
                    : "Nenhuma liberação ativa no momento"}
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

        {liberacoesFinalizadas.length > 0 && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              className="flex items-center gap-2 p-0 h-auto text-base md:text-lg font-semibold hover:bg-transparent min-h-[44px] max-md:min-h-[44px]"
              onClick={() => setSecaoFinalizadasExpandida(!secaoFinalizadasExpandida)}
            >
              {secaoFinalizadasExpandida ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              <span className="text-muted-foreground">
                Liberações Finalizadas ({liberacoesFinalizadas.length})
              </span>
            </Button>
            
            {secaoFinalizadasExpandida && (
              <div className="grid gap-3 md:gap-4 ml-7">
                {liberacoesFinalizadas.map(renderLiberacaoCard)}
              </div>
            )}
          </div>
        )}

        {liberacoesAtivas.length === 0 && liberacoesFinalizadas.length === 0 && (
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-sm md:text-base">
              {hasActiveFilters
                ? "Nenhuma liberação encontrada com os filtros aplicados"
                : "Nenhuma liberação cadastrada ainda"}
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

export default Liberacoes;
