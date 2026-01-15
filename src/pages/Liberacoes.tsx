import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ClipboardList, X, Filter as FilterIcon, ChevronDown, ChevronUp, AlertCircle, ExternalLink, Calendar, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// 🔄 TIPOS ATUALIZADOS PARA NOVO SISTEMA
type StatusLiberacao = "disponivel" | "parcialmente_agendada" | "totalmente_agendada";

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
  const canCreate = hasRole("logistica") || hasRole("admin");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 🆕 ESTADO PARA MODAL DE DETALHES
  const [detalhesLiberacao, setDetalhesLiberacao] = useState<LiberacaoItem | null>(null);

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

  // 🔄 QUERY PRINCIPAL - LIBERAÇÕES COM QUANTIDADE_RETIRADA CORRETA DO BACKEND
  const { data: liberacoesData, isLoading, error } = useQuery({
    queryKey: ["liberacoes", currentCliente?.id, currentArmazem?.id],
    queryFn: async () => {
      let query = supabase
        .from("liberacoes")
        .select(`
          id,
          pedido_interno,
          quantidade_liberada,
          quantidade_retirada,
          status,
          data_liberacao,
          created_at,
          cliente_id,
          clientes(nome, cnpj_cpf),
          produto:produtos(id, nome),
          armazem:armazens(id, nome, cidade, estado)
        `)
        .order("created_at", { ascending: false });

      if (userRole === "cliente" && currentCliente?.id) {
        query = query.eq("cliente_id", currentCliente.id);
      }
      if (userRole === "armazem" && currentArmazem?.id) {
        query = query.eq("armazem_id", currentArmazem.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000, // 🔄 ATUALIZAÇÃO AUTOMÁTICA PARA VER MUDANÇAS DE STATUS
    enabled: (userRole !== "cliente" || !!currentCliente?.id) && (userRole !== "armazem" || !!currentArmazem?.id),
  });

  // 📊 BUSCAR QUANTIDADES AGENDADAS - CORRIGIDO PARA INCLUIR TODOS OS STATUS
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
        .in("status", ["pendente", "em_andamento", "concluido"]); // ✅ CORRIGIDO: INCLUIR TODOS OS STATUS
      
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

  // 📊 MAPEAMENTO ATUALIZADO - REMOVIDO "DISPONÍVEL"
  const liberacoes = useMemo(() => {
    if (!liberacoesData) return [];
    return liberacoesData.map((item: any) => {
      // ✅ AGORA quantidade_retirada VEM CORRETA DO BACKEND
      const quantidadeRetirada = item.quantidade_retirada || 0;
      // ✅ AGORA quantidade_agendada INCLUI TODOS OS STATUS
      const quantidadeAgendada = agendamentosData?.[item.id] || 0;
      
      const percentualRetirado = item.quantidade_liberada > 0 
        ? Math.round((quantidadeRetirada / item.quantidade_liberada) * 100) 
        : 0;
      const percentualAgendado = item.quantidade_liberada > 0 
        ? Math.round((quantidadeAgendada / item.quantidade_liberada) * 100) 
        : 0;

      return {
        id: item.id,
        produto: item.produto?.nome || "N/A",
        cliente: item.clientes?.nome || "N/A",
        quantidade: item.quantidade_liberada,
        quantidadeRetirada,
        quantidadeAgendada,
        percentualRetirado,
        percentualAgendado,
        pedido: item.pedido_interno,
        data: new Date(item.data_liberacao || item.created_at).toLocaleDateString("pt-BR"),
        status: item.status as StatusLiberacao,
        armazem: item.armazem ? `${item.armazem.nome} - ${item.armazem.cidade}/${item.armazem.estado}` : "N/A",
        produto_id: item.produto?.id,
        armazem_id: item.armazem?.id,
        created_at: item.created_at,
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

  useEffect(() => {
    // Detectar se deve abrir o modal automaticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      // Limpar o parâmetro da URL sem recarregar a página
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [canCreate]);
  
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

  const filteredLiberacoes = useMemo(() => {
    return liberacoes.filter((l) => {
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
  }, [liberacoes, search, selectedStatuses, selectedArmazens, dateFrom, dateTo]);

  const showingCount = filteredLiberacoes.length;
  const totalCount = liberacoes.length;
  const activeAdvancedCount =
    (selectedStatuses.length ? 1 : 0) +
    (selectedArmazens.length ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  const resetFormNovaLiberacao = () => {
    setNovaLiberacao({ produto: "", armazem: "", cliente_id: "", pedido: "", quantidade: "" });
  };

  // 🔄 FUNÇÃO DE CRIAÇÃO ATUALIZADA PARA NOVO STATUS PADRÃO
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

    const clienteSelecionado = clientesData?.find(c => c.id === cliente_id);
    if (!clienteSelecionado) {
      toast({ variant: "destructive", title: "Cliente inválido" });
      return;
    }

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
          status: "disponivel", // 🔄 STATUS PADRÃO ATUALIZADO
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
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="produto">Produto *</Label>
                      {temProdutosDisponiveis ? (
                        <Select value={novaLiberacao.produto} onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, produto: v }))}>
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
                        <Select value={novaLiberacao.armazem} onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, armazem: v }))}>
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
                        <Select value={novaLiberacao.cliente_id} onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, cliente_id: v }))}>
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
                    
                    {temProdutosDisponiveis && temArmazensDisponiveis && temClientesDisponiveis && (
                      <div className="space-y-2">
                        <Label htmlFor="quantidade">Quantidade (t) *</Label>
                        <Input
                          id="quantidade"
                          type="number"
                          step="0.01"
                          min="0"
                          value={novaLiberacao.quantidade}
                          onChange={(e) => setNovaLiberacao((s) => ({ ...s, quantidade: e.target.value }))}
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button 
                      className="bg-gradient-primary" 
                      onClick={handleCreateLiberacao}
                      disabled={!temProdutosDisponiveis || !temArmazensDisponiveis || !temClientesDisponiveis}
                    >
                      Criar Liberação
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
        </div>

        {filtersOpen && (
          <div className="rounded-md border p-3 space-y-6 relative">
            <div>
              <Label className="text-sm font-semibold mb-1">Status</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {allStatuses.map((st) => {
                  const active = selectedStatuses.includes(st);
                  const label = getStatusLabel(st);
                  return (
                    <Badge key={st} onClick={() => toggleStatus(st)} className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-muted-foreground"}`}>
                      {label}
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
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1"><X className="h-4 w-4" /> Limpar Filtros</Button>
            </div>
          </div>
        )}

        {/* 🆕 MODAL DE DETALHES DA LIBERAÇÃO - SEM "DISPONÍVEL" */}
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
                  {/* Informações Básicas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Número do Pedido:</Label>
                      <p className="font-semibold">{detalhesLiberacao.pedido}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status da Liberação:</Label>
                      <Badge className={getStatusColor(detalhesLiberacao.status)}>
                        {getStatusLabel(detalhesLiberacao.status)}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Produto:</Label>
                      <p className="font-semibold">{detalhesLiberacao.produto}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Data de Criação:</Label>
                      <p className="font-semibold">{detalhesLiberacao.data}</p>
                    </div>
                  </div>

                  {/* Cliente e Armazém */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Cliente e Armazém</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Cliente:</Label>
                        <p className="font-semibold">{detalhesLiberacao.cliente}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Armazém:</Label>
                        <p className="font-semibold">{detalhesLiberacao.armazem}</p>
                      </div>
                    </div>
                  </div>

                  {/* Quantidades - SEM "DISPONÍVEL" */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Informações de Quantidade</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <div className="grid gap-4">
          {filteredLiberacoes.map((lib) => (
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
                      
                      <span className="text-xs text-blue-600 font-medium">
                        {lib.quantidadeAgendada > 0 ? `${lib.quantidadeAgendada.toLocaleString('pt-BR')}t agendada` : 'Nenhum agendamento'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredLiberacoes.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma liberação encontrada.</div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Liberacoes;
