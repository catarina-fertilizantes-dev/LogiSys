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

// 🔄 TIPOS ATUALIZADOS PARA NOVO SISTEMA
type StatusLiberacao = "disponivel" | "parcialmente_agendada" | "totalmente_agendada";

// 🎨 ARRAY DE STATUS PARA FILTROS COM CORES
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
  // 📊 CAMPOS PARA VISUALIZAÇÃO (SEM "DISPONÍVEL")
  quantidadeAgendada: number;
  percentualRetirado: number;
  percentualAgendado: number;
  // 🆕 CAMPO PARA HISTÓRICO
  finalizada: boolean;
}

// 🎯 FUNÇÃO PARA TOOLTIPS DOS STATUS DE LIBERAÇÃO
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

// 🎯 FUNÇÃO PARA TOOLTIPS DA BARRA DE AGENDAMENTO
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

// Componente para exibir quando não há dados disponíveis
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

const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Liberacoes = () => {
  const { hasRole, userRole, user } = useAuth();
  const { clientesDoRepresentante, representanteId } = usePermissions();
  
  // 🆕 LOG PARA DEBUG
  console.log('🔍 [DEBUG] Hook usePermissions retornou:', {
    clientesDoRepresentante,
    representanteId,
    length: clientesDoRepresentante?.length || 0
  });

  // 🆕 VERIFICAR SE OS DADOS ESTÃO CHEGANDO
  useEffect(() => {
    console.log('�� [DEBUG] useEffect - clientesDoRepresentante mudou:', {
      clientesDoRepresentante,
      length: clientesDoRepresentante?.length || 0,
      representanteId
    });
  }, [clientesDoRepresentante, representanteId]);
  
  // 🚫 PROTEÇÃO ADICIONAL: Redirecionar role 'armazem' para dashboard
  useEffect(() => {
    if (userRole === "armazem") {
      window.location.href = "/";
      return;
    }
  }, [userRole]);

  // Se for role 'armazem', não renderizar nada enquanto redireciona
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

  // 🚀 NOVO ESTADO DE LOADING
  const [isCreating, setIsCreating] = useState(false);

  // 🆕 ESTADO PARA MODAL DE DETALHES
  const [detalhesLiberacao, setDetalhesLiberacao] = useState<LiberacaoItem | null>(null);

  // 🆕 ESTADOS PARA SEÇÕES COLAPSÁVEIS
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

  // 🔍 ADICIONAR ESTES LOGS ANTES DA QUERY PRINCIPAL
  console.log('🔍 [DEBUG] Liberacoes - userRole:', userRole);
  console.log('🔍 [DEBUG] Liberacoes - representanteId:', representanteId);
  console.log('🔍 [DEBUG] Liberacoes - clientesDoRepresentante:', clientesDoRepresentante);
  console.log('🔍 [DEBUG] Liberacoes - clientesDoRepresentante.length:', clientesDoRepresentante.length);
  
  // 🔄 QUERY PRINCIPAL - LIBERAÇÕES COM CAMPOS CORRETOS
  const { data: liberacoesData, isLoading, error } = useQuery({
    queryKey: ["liberacoes", currentCliente?.id, currentArmazem?.id, representanteId, clientesDoRepresentante],
    queryFn: async () => {
      console.log('🔍 [DEBUG] Query executando com:', {
        userRole,
        representanteId,
        clientesDoRepresentante,
        clientesLength: clientesDoRepresentante.length
      });
    
      let query = supabase
        .from("liberacoes")
        .select(`
          id,
          pedido_interno,
          quantidade_liberada,
          quantidade_retirada,
          data_liberacao,
          status,
          cliente_id,
          armazem_id,
          produto_id,
          clientes (
            id,
            nome,
            cnpj_cpf
          ),
          armazens (
            id,
            nome,
            endereco,
            cidade,
            estado
          ),
          produtos (
            id,
            nome,
            unidade
          )
        `)
        .order("data_liberacao", { ascending: false });
    
      console.log('🔍 [DEBUG] Query inicial criada');
    
      // 🆕 FILTRO PARA REPRESENTANTE
      if (userRole === "representante") {
        console.log('🔍 [DEBUG] Aplicando filtro representante...');
        if (clientesDoRepresentante.length > 0) {
          console.log('🔍 [DEBUG] Filtro IN aplicado:', clientesDoRepresentante);
          query = query.in("cliente_id", clientesDoRepresentante);
        } else {
          console.log('🔍 [DEBUG] Filtro de segurança aplicado (UUID impossível)');
          query = query.eq("cliente_id", "00000000-0000-0000-0000-000000000000");
        }
      }
    
      console.log('🔍 [DEBUG] Executando query...');
      const { data, error } = await query;
      
      console.log('🔍 [DEBUG] Resultado da query:', {
        error: error?.message,
        dataLength: data?.length || 0,
        primeiros2: data?.slice(0, 2),
        dadosCompletos: data  // 🆕 LOG COMPLETO DOS DADOS
      });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
    enabled: (() => {
      const clienteOk = userRole !== "cliente" || !!currentCliente?.id;
      const armazemOk = userRole !== "armazem" || !!currentArmazem?.id;
      const representanteOk = userRole !== "representante" || (representanteId !== null);
      
      console.log('🔍 [DEBUG] Enabled conditions:', {
        clienteOk,
        armazemOk, 
        representanteOk,
        representanteId,
        clientesLength: clientesDoRepresentante.length,
        final: clienteOk && armazemOk && representanteOk
      });
      
      return clienteOk && armazemOk && representanteOk;
    })(),
  });

  // 📊 BUSCAR QUANTIDADES AGENDADAS - CAMPOS CORRETOS
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
      
      // ✅ CORRIGIDO: Agrupar APENAS por liberacao_id (sem status)
      const agrupados = (data || []).reduce((acc: Record<string, number>, item) => {
        acc[item.liberacao_id] = (acc[item.liberacao_id] || 0) + Number(item.quantidade);
        return acc;
      }, {});
      
      return agrupados;
    },
    refetchInterval: 30000,
  });

  // 📊 MAPEAMENTO CORRIGIDO COM CAMPOS REAIS
  const liberacoes = useMemo(() => {
    if (!liberacoesData) return [];
    return liberacoesData.map((item: any) => {
      const quantidadeRetirada = item.quantidade_retirada || 0;
      const quantidadeAgendada = agendamentosData?.[item.id] || 0;
      
      const percentualRetirado = item.quantidade_liberada > 0 
        ? Math.round((quantidadeRetirada / item.quantidade_liberada) * 100) 
        : 0;
      const percentualAgendado = item.quantidade_liberada > 0 
        ? Math.round((quantidadeAgendada / item.quantidade_liberada) * 100) 
        : 0;

      // 🆕 CRITÉRIO DE FINALIZAÇÃO: quantidade_retirada >= quantidade_liberada
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
        produto_id: item.produtos?.id,
        armazem_id: item.armazens?.id,
        created_at: item.created_at,
        finalizada,
      };
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

  // 🆕 ESTADOS PARA VALIDAÇÃO DE ESTOQUE
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

  // 🆕 FUNÇÃO PARA VALIDAR ESTOQUE
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
        console.error('Erro ao buscar estoque:', error);
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
      console.error('Erro ao validar estoque:', error);
      setQuantidadeEstoque(0);
      setTemEstoqueCadastrado(false);
    } finally {
      setValidandoEstoque(false);
    }
  };

  // 🆕 VALIDAÇÃO EM TEMPO REAL DA QUANTIDADE
  const quantidadeValida = useMemo(() => {
    const qtd = Number(novaLiberacao.quantidade);
    return !isNaN(qtd) && qtd > 0 && qtd <= quantidadeEstoque;
  }, [novaLiberacao.quantidade, quantidadeEstoque]);

  useEffect(() => {
    // Detectar se deve abrir o modal automaticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      // Limpar o parâmetro da URL sem recarregar a página
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [canCreate]);

  // 🆕 EFFECT PARA VALIDAR ESTOQUE QUANDO PRODUTO E ARMAZÉM MUDAREM
  useEffect(() => {
    if (novaLiberacao.produto && novaLiberacao.armazem) {
      validarEstoque(novaLiberacao.produto, novaLiberacao.armazem);
    } else {
      setQuantidadeEstoque(0);
      setTemEstoqueCadastrado(null);
    }
  }, [novaLiberacao.produto, novaLiberacao.armazem]);
  
  // 🔄 FILTROS ATUALIZADOS PARA NOVOS STATUS
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

  // 🆕 SEPARAÇÃO EM ATIVAS E FINALIZADAS + FILTROS
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

  // 🆕 AUTO-EXPANSÃO: Se busca encontrou resultados em finalizadas, expandir automaticamente
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
  
  // 🆕 VERIFICAR SE HÁ FILTROS ATIVOS
  const hasActiveFilters = search.trim() || selectedStatuses.length > 0 || selectedArmazens.length > 0 || dateFrom || dateTo;

  const resetFormNovaLiberacao = () => {
    setNovaLiberacao({ produto: "", armazem: "", cliente_id: "", pedido: "", quantidade: "" });
    setQuantidadeEstoque(0);
    setTemEstoqueCadastrado(null);
    setValidandoEstoque(false);
  };

  // 🚀 FUNÇÃO DE CRIAÇÃO COM LOADING STATE
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

    // 🆕 VALIDAÇÃO DE ESTOQUE
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

    // 🚀 ATIVAR LOADING STATE
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
      // 🚀 DESATIVAR LOADING STATE
      setIsCreating(false);
    }
  };

  // 🎨 FUNÇÃO PARA CORES DOS STATUS ATUALIZADA
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

  // 🆕 COMPONENTE PARA RENDERIZAR CARDS DE LIBERAÇÃO
  const renderLiberacaoCard = (lib: LiberacaoItem) => (
    <Card key={lib.id} className="transition-all hover:shadow-md cursor-pointer">
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div 
              className="flex items-start gap-4 flex-1"
              onClick={() => setDetalhesLiberacao(lib)}
            >
              {/* badge ícone à esquerda com cor do Estoque */}
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                {/* 🎯 LAYOUT DO CARD */}
                <h3 className="font-semibold text-foreground">Pedido: {lib.pedido}</h3>
                <p className="text-xs text-muted-foreground">Cliente: <span className="font-semibold">{lib.cliente}</span></p>
                <p className="text-xs text-muted-foreground">Produto: <span className="font-semibold">{lib.produto}</span></p>
                <p className="text-xs text-muted-foreground">Armazém: <span className="font-semibold">{lib.armazem}</span></p>
                
                {/* 📊 INFORMAÇÕES DETALHADAS - SEM "DISPONÍVEL" */}
                <div className="mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>
                      <span className="font-medium text-foreground">Liberada:</span> {lib.quantidade.toLocaleString('pt-BR')}t
                    </span>
                    <span>
                      <span className="font-medium text-blue-600">Agendada:</span> {lib.quantidadeAgendada.toLocaleString('pt-BR')}t
                    </span>
                    <span>
                      <span className="font-medium text-orange-600">Retirada:</span> {lib.quantidadeRetirada.toLocaleString('pt-BR')}t
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 🎨 BADGE DE STATUS COM TOOLTIP HÍBRIDO */}
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center gap-1 cursor-help"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Badge className={getStatusColor(lib.status)}>
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

          {/* 📊 BARRA DE AGENDAMENTOS COM TOOLTIP HÍBRIDO - IMPLEMENTAÇÃO PRINCIPAL */}
          <div 
            className="pt-2 border-t"
            onClick={() => setDetalhesLiberacao(lib)}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-blue-600 font-medium w-20">Agendamento:</span>
              
              {/* 🎯 BARRA DE PROGRESSO COM TOOLTIP HÍBRIDO */}
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div 
                    className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700 cursor-help"
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
              
              {/* 🎯 ÍCONE "i" COM TOOLTIP HÍBRIDO */}
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-1 cursor-help"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium w-12">
                      {lib.percentualAgendado}%
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{getAgendamentoBarTooltip(lib.percentualAgendado, lib.quantidadeAgendada, lib.quantidade)}</p>
                </TooltipContent>
              </Tooltip>
              
              {/* ✅ ITEM 5.3: REMOVIDO O TEXTO "Xt agendada" */}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Verificar se há dados disponíveis
  const temProdutosDisponiveis = produtos && produtos.length > 0;
  const temArmazensDisponiveis = armazens && armazens.length > 0;
  const temClientesDisponiveis = clientesData && clientesData.length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
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
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader title="Liberações de Produtos" subtitle="Erro ao carregar dados" icon={ClipboardList} actions={<></>} />
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
          title="Liberações de Produtos"
          subtitle="Gerencie as liberações de produtos para clientes"
          icon={ClipboardList}
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
                    Nova Liberação
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Nova Liberação</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="pedido">Número do Pedido *</Label>
                      <Input
                        id="pedido"
                        value={novaLiberacao.pedido}
                        onChange={(e) => setNovaLiberacao((s) => ({ ...s, pedido: e.target.value }))}
                        placeholder="Ex: PED-2024-001"
                        disabled={isCreating}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="produto">Produto *</Label>
                      {temProdutosDisponiveis ? (
                        <Select 
                          value={novaLiberacao.produto} 
                          onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, produto: v, quantidade: "" }))}
                          disabled={isCreating}
                        >
                          <SelectTrigger id="produto">
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
                      <Label htmlFor="armazem">Armazém *</Label>
                      {temArmazensDisponiveis ? (
                        <Select 
                          value={novaLiberacao.armazem} 
                          onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, armazem: v, quantidade: "" }))}
                          disabled={isCreating}
                        >
                          <SelectTrigger id="armazem">
                            <SelectValue placeholder="Selecione o armazém" />
                          </SelectTrigger>
                          <SelectContent>
                            {armazens?.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.cidade}{a.estado ? "/" + a.estado : ""} - {a.nome}
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
                      <Label htmlFor="cliente">Cliente *</Label>
                      {temClientesDisponiveis ? (
                        <Select 
                          value={novaLiberacao.cliente_id} 
                          onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, cliente_id: v }))}
                          disabled={isCreating}
                        >
                          <SelectTrigger id="cliente">
                            <SelectValue placeholder="Selecione o cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientesData?.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id}>
                                {cliente.nome} - {cliente.cnpj_cpf}
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
                    
                    {/* 🆕 VALIDAÇÃO DE ESTOQUE */}
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
                        <Label htmlFor="quantidade">Quantidade (t) *</Label>
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
                          className={
                            novaLiberacao.quantidade && !quantidadeValida 
                              ? "border-red-500 focus:border-red-500" 
                              : novaLiberacao.quantidade && quantidadeValida
                              ? "border-green-500 focus:border-green-500"
                              : ""
                          }
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
                      onClick={handleCreateLiberacao}
                      disabled={
                        !temProdutosDisponiveis || 
                        !temArmazensDisponiveis || 
                        !temClientesDisponiveis || 
                        !temEstoqueCadastrado || 
                        !quantidadeValida || 
                        validandoEstoque ||
                        isCreating
                      }
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        "Criar Liberação"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />
        
        <div className="flex items-center gap-3">
          <Input className="h-9 flex-1" placeholder="Buscar por produto, cliente ou pedido..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <Label className="text-sm font-semibold mb-1">Status da Liberação</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {STATUS_LIBERACAO.map((status) => {
                  const active = selectedStatuses.includes(status.id as StatusLiberacao);
                  return (
                    <Badge
                      key={status.id}
                      onClick={() => toggleStatus(status.id as StatusLiberacao)}
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
            {allArmazens.length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-1">Armazém</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {allArmazens.map((a) => {
                    const active = selectedArmazens.includes(a);
                    return (
                      <Badge key={a} onClick={() => toggleArmazem(a)} className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-muted-foreground"}`}>
                        {a}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center gap-4">
              <Label className="text-sm font-semibold mb-1">Período</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[160px]" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[160px]" />
              <div className="flex-1"></div>
            </div>
          </div>
        )}

        {/* 🆕 MODAL DE DETALHES DA LIBERAÇÃO - ITEM 5.5: LAYOUT COMPACTADO */}
        <Dialog open={!!detalhesLiberacao} onOpenChange={open => !open && setDetalhesLiberacao(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Liberação</DialogTitle>
              <DialogDescription>
                Pedido: {detalhesLiberacao?.pedido}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {detalhesLiberacao && (
                <>
                  {/* ✅ ITEM 5.5: LAYOUT COMPACTADO CONFORME ESPECIFICAÇÃO */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Data de Criação:</Label>
                      <p className="font-semibold">{detalhesLiberacao.data}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status:</Label>
                      <Badge className={getStatusColor(detalhesLiberacao.status)}>
                        {getStatusLabel(detalhesLiberacao.status)}
                      </Badge>
                    </div>
                  </div>

                  {/* Separador */}
                  <div className="border-t"></div>

                  {/* Cliente e Armazém */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cliente:</Label>
                      <p className="font-semibold">{detalhesLiberacao.cliente}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Armazém:</Label>
                      <p className="font-semibold">{detalhesLiberacao.armazem}</p>
                    </div>
                  </div>

                  {/* Separador */}
                  <div className="border-t"></div>

                  {/* Produto */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Produto:</Label>
                    <p className="font-semibold">{detalhesLiberacao.produto}</p>
                  </div>

                  {/* Quantidades em linha */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantidade Liberada:</Label>
                      <p className="font-semibold text-lg">{detalhesLiberacao.quantidade.toLocaleString('pt-BR')}t</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantidade Agendada:</Label>
                      <p className="font-semibold text-lg text-blue-600">{detalhesLiberacao.quantidadeAgendada.toLocaleString('pt-BR')}t</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantidade Retirada:</Label>
                      <p className="font-semibold text-lg text-orange-600">{detalhesLiberacao.quantidadeRetirada.toLocaleString('pt-BR')}t</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setDetalhesLiberacao(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 🆕 SEÇÃO DE LIBERAÇÕES ATIVAS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Liberações Ativas ({liberacoesAtivas.length})</h2>
          </div>
          
          <div className="grid gap-4">
            {liberacoesAtivas.map(renderLiberacaoCard)}
            {liberacoesAtivas.length === 0 && (
              <div className="text-center py-8">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {hasActiveFilters
                    ? "Nenhuma liberação ativa encontrada com os filtros aplicados"
                    : "Nenhuma liberação ativa no momento"}
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

        {/* 🆕 SEÇÃO DE LIBERAÇÕES FINALIZADAS (COLAPSÁVEL) */}
        {liberacoesFinalizadas.length > 0 && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              className="flex items-center gap-2 p-0 h-auto text-lg font-semibold hover:bg-transparent"
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
              <div className="grid gap-4 ml-7">
                {liberacoesFinalizadas.map(renderLiberacaoCard)}
              </div>
            )}
          </div>
        )}

        {/* Mensagem quando não há dados */}
        {liberacoesAtivas.length === 0 && liberacoesFinalizadas.length === 0 && (
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {hasActiveFilters
                ? "Nenhuma liberação encontrada com os filtros aplicados"
                : "Nenhuma liberação cadastrada ainda"}
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

export default Liberacoes;
