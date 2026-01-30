import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Truck, X, Filter as FilterIcon, ChevronDown, ChevronUp, Info, Clock, User, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

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

function formatPlaca(placa: string) {
  if (!placa || placa === "N/A") return placa;
  const cleaned = placa.replace(/[^A-Z0-9]/g, "");
  if (cleaned.length === 7) {
    if (/[A-Z]{3}[0-9][A-Z][0-9]{2}/.test(cleaned)) {
      return cleaned.replace(/^([A-Z]{3})([0-9][A-Z][0-9]{2})$/, "$1-$2");
    }
    return cleaned.replace(/^([A-Z]{3})([0-9]{4})$/, "$1-$2");
  }
  return placa;
}

function formatCPF(cpf: string) {
  if (!cpf || cpf === "N/A") return cpf;
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return cpf;
}

interface CarregamentoItem {
  id: string;
  cliente: string;
  produto: string;
  pedido: string;
  armazem: string;
  quantidade: number;
  placa: string;
  motorista: string;
  documento: string;
  data_retirada: string;
  etapa_atual: number;
  fotosTotal: number;
  numero_nf: string | null;
  cliente_id: string | null;
  armazem_id: string | null;
  status_carregamento: string;
  cor_carregamento: string;
  tooltip_carregamento: string;
  percentual_carregamento: number;
  finalizado: boolean;
}

const STATUS_CARREGAMENTO = [
  { id: "Aguardando", nome: "Aguardando", cor: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  { id: "Em Andamento", nome: "Em Andamento", cor: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  { id: "Finalizado", nome: "Finalizado", cor: "bg-green-100 text-green-800 hover:bg-green-200" },
];

const Carregamentos = () => {
  const { userRole, user } = useAuth();
  const { clienteId, armazemId, representanteId } = usePermissions();
  const [secaoFinalizadosExpandida, setSecaoFinalizadosExpandida] = useState(false);

  // 🆕 SCROLL PARA O TOPO AO CARREGAR A PÁGINA
useEffect(() => {
  if (window.scrollY > 0) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}, []);

  // 🔄 QUERY PRINCIPAL - OTIMIZADA
  const { data: carregamentosData, isLoading, error } = useQuery({
    queryKey: ["carregamentos", clienteId, armazemId, representanteId, userRole],
    queryFn: async () => {
      // 🆕 REPRESENTANTE: Usar function específica
      if (userRole === "representante" && representanteId) {
        const { data, error } = await supabase.rpc('get_carregamentos_by_representante', {
          p_representante_id: representanteId
        });
        
        if (error) throw error;
        return data || [];
      }

      // 🔄 OUTROS ROLES: Query tradicional
      let query = supabase
        .from("carregamentos")
        .select(`
          id,
          etapa_atual,
          numero_nf,
          data_chegada,
          created_at,
          cliente_id,
          armazem_id,
          url_foto_chegada,
          url_foto_inicio,
          url_foto_carregando,
          url_foto_finalizacao,
          agendamento:agendamentos!carregamentos_agendamento_id_fkey (
            id,
            data_retirada,
            quantidade,
            placa_caminhao,
            motorista_nome,
            motorista_documento,
            liberacao:liberacoes!agendamentos_liberacao_id_fkey (
              pedido_interno,
              produto:produtos!liberacoes_produto_id_fkey (
                nome
              ),
              clientes!liberacoes_cliente_id_fkey (
                nome
              ),
              armazem:armazens!liberacoes_armazem_id_fkey (
                nome,
                cidade,
                estado
              )
            )
          )
        `)
        .order("data_chegada", { ascending: false });

      // Aplicar filtros baseados no role
      if (userRole === "cliente" && clienteId) {
        query = query.eq("cliente_id", clienteId);
      } else if (userRole === "armazem" && armazemId) {
        query = query.eq("armazem_id", armazemId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: (() => {
      // 🆕 MESMA LÓGICA ROBUSTA DA PÁGINA DE DETALHES
      if (!user || !userRole) return false;
      if (userRole === "admin" || userRole === "logistica") return true;
      
      const clienteOk = userRole !== "cliente" || (clienteId !== undefined);
      const armazemOk = userRole !== "armazem" || (armazemId !== undefined);
      const representanteOk = userRole !== "representante" || (representanteId !== undefined);
      
      return clienteOk && armazemOk && representanteOk;
    })(),
    refetchInterval: 30000,
  });

  // 🔄 MAPEAMENTO MANTIDO (JÁ ESTÁ OTIMIZADO)
  const carregamentos = useMemo<CarregamentoItem[]>(() => {
    if (!carregamentosData) return [];
    
    return carregamentosData.map((item: any) => {
      const isFromFunction = !!item.cliente_nome;
      
      const fotosCount = [
        item.url_foto_chegada,
        item.url_foto_inicio,
        item.url_foto_carregando,
        item.url_foto_finalizacao
      ].filter(url => url && url.trim() !== '').length;

      const etapaAtual = item.etapa_atual ?? 1;
      const statusInfo = getStatusCarregamento(etapaAtual);
      const finalizado = etapaAtual === 6;

      return {
        id: item.id,
        cliente: isFromFunction ? item.cliente_nome : (item.agendamento?.liberacao?.clientes?.nome || "N/A"),
        produto: isFromFunction ? item.produto_nome : (item.agendamento?.liberacao?.produto?.nome || "N/A"),
        pedido: isFromFunction ? item.pedido_interno : (item.agendamento?.liberacao?.pedido_interno || "N/A"),
        armazem: isFromFunction 
          ? `${item.armazem_nome} - ${item.armazem_cidade}/${item.armazem_estado}`
          : (item.agendamento?.liberacao?.armazem 
            ? `${item.agendamento.liberacao.armazem.nome} - ${item.agendamento.liberacao.armazem.cidade}/${item.agendamento.liberacao.armazem.estado}`
            : "N/A"),
        quantidade: isFromFunction ? item.quantidade : (item.agendamento?.quantidade || 0),
        placa: isFromFunction ? item.placa_caminhao : (item.agendamento?.placa_caminhao || "N/A"),
        motorista: isFromFunction ? item.motorista_nome : (item.agendamento?.motorista_nome || "N/A"),
        documento: isFromFunction ? item.motorista_documento : (item.agendamento?.motorista_documento || "N/A"),
        data_retirada: isFromFunction ? item.data_retirada : (item.agendamento?.data_retirada || "N/A"),
        etapa_atual: etapaAtual,
        fotosTotal: fotosCount,
        numero_nf: item.numero_nf || null,
        cliente_id: item.cliente_id ?? null,
        armazem_id: item.armazem_id ?? null,
        status_carregamento: statusInfo.status,
        cor_carregamento: statusInfo.cor,
        tooltip_carregamento: statusInfo.tooltip,
        percentual_carregamento: statusInfo.percentual,
        finalizado,
      };
    });
  }, [carregamentosData]);

  // Estados de filtros (mantidos)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const toggleStatus = (status: string) =>
    setSelectedStatus((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  
  const clearFilters = () => {
    setSearch("");
    setSelectedStatus([]);
    setDateFrom("");
    setDateTo("");
  };

  // Lógica de filtros (mantida)
  const { carregamentosAtivos, carregamentosFinalizados } = useMemo(() => {
    const filtered = carregamentos.filter((c) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${c.cliente} ${c.motorista} ${c.placa} ${c.pedido}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (selectedStatus.length > 0 && !selectedStatus.includes(c.status_carregamento)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(c.data_retirada) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(c.data_retirada) > to) return false;
      }
      return true;
    });

    const ativos = filtered.filter(c => !c.finalizado);
    const finalizados = filtered.filter(c => c.finalizado);

    return { carregamentosAtivos: ativos, carregamentosFinalizados: finalizados };
  }, [carregamentos, search, selectedStatus, dateFrom, dateTo]);

  // Auto-expansão (mantida)
  useEffect(() => {
    if (search.trim() && carregamentosFinalizados.length > 0 && !secaoFinalizadosExpandida) {
      setSecaoFinalizadosExpandida(true);
    }
  }, [search, carregamentosFinalizados.length, secaoFinalizadosExpandida]);

  const showingCount = carregamentosAtivos.length + carregamentosFinalizados.length;
  const totalCount = carregamentos.length;
  const activeAdvancedCount =
    (selectedStatus.length ? 1 : 0) + 
    ((dateFrom || dateTo) ? 1 : 0);
  
  const hasActiveFilters = search.trim() || selectedStatus.length > 0 || dateFrom || dateTo;

  // Componente de renderização (mantido - já está ótimo)
  const renderCarregamentoCard = (carr: CarregamentoItem) => (
    <Card key={carr.id} className="transition-all hover:shadow-md cursor-pointer">
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <Link 
              to={`/carregamentos/${carr.id}`} 
              className="flex items-start gap-4 flex-1 text-inherit no-underline"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Pedido: {carr.pedido}</h3>
                <p className="text-xs text-muted-foreground">Cliente: <span className="font-semibold">{carr.cliente}</span></p>
                <p className="text-xs text-muted-foreground">Produto: <span className="font-semibold">{carr.produto}</span></p>
                <p className="text-xs text-muted-foreground">Armazém: <span className="font-semibold">{carr.armazem}</span></p>
                <p className="text-xs text-muted-foreground">Quantidade: <span className="font-semibold">{carr.quantidade.toLocaleString('pt-BR')}t</span></p>
                {carr.numero_nf && (
                  <p className="text-xs text-muted-foreground mt-1">Nº NF: <span className="font-semibold">{carr.numero_nf}</span></p>
                )}
              </div>
            </Link>
            
            <div className="flex flex-col items-end gap-2">
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-1 cursor-help"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Badge className={`${carr.cor_carregamento} border-0 font-medium`}>
                      {carr.status_carregamento}
                    </Badge>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{carr.tooltip_carregamento}</p>
                </TooltipContent>
              </Tooltip>
              <div className="text-xs text-muted-foreground">Fotos: <span className="font-semibold">{carr.fotosTotal}</span></div>
            </div>
          </div>

          <Link 
            to={`/carregamentos/${carr.id}`} 
            className="block text-inherit no-underline"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 text-sm pt-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{carr.data_retirada !== "N/A" ? new Date(carr.data_retirada).toLocaleDateString("pt-BR") : "N/A"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>{formatPlaca(carr.placa)}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{carr.motorista}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{formatCPF(carr.documento)}</span>
              </div>
            </div>
          </Link>

          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <Link 
                to={`/carregamentos/${carr.id}`} 
                className="flex items-center gap-2 text-inherit no-underline"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Truck className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-purple-600 font-medium w-24">Carregamento:</span>
              </Link>
              
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div 
                    className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700 cursor-help"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${carr.percentual_carregamento}%` }}
                    ></div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{carr.tooltip_carregamento}</p>
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
                      {carr.percentual_carregamento}%
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{carr.tooltip_carregamento}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Estados de loading e erro (mantidos)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader
          title="Carregamentos"
          subtitle="Acompanhe o progresso dos carregamentos"
          icon={Truck}
        />
        <div className="text-center py-12">
          <div className="flex justify-center items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="text-muted-foreground">Carregando carregamentos...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader
          title="Carregamentos"
          subtitle="Acompanhe o progresso dos carregamentos"
          icon={Truck}
        />
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="text-center text-destructive">
              <p className="font-semibold">Erro ao carregar carregamentos</p>
              <p className="text-sm mt-2">{error instanceof Error ? error.message : "Erro desconhecido"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader
          title="Carregamentos"
          subtitle="Acompanhe o progresso dos carregamentos"
          icon={Truck}
        />

        <div className="flex items-center gap-3">
          <Input className="h-9 flex-1" placeholder="Buscar por cliente, placa, motorista ou pedido..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Mostrando <span className="font-medium">{showingCount}</span> de <span className="font-medium">{totalCount}</span>
          </span>
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
              <Label className="text-sm font-semibold mb-1">Status do Carregamento</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {STATUS_CARREGAMENTO.map((status) => {
                  const active = selectedStatus.includes(status.id);
                  return (
                    <Badge
                      key={status.id}
                      onClick={() => toggleStatus(status.id)}
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

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Carregamentos Ativos ({carregamentosAtivos.length})</h2>
          </div>
          
          <div className="grid gap-4">
            {carregamentosAtivos.map(renderCarregamentoCard)}
            {carregamentosAtivos.length === 0 && (
              <div className="text-center py-8">
                <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {hasActiveFilters
                    ? "Nenhum carregamento ativo encontrado com os filtros aplicados"
                    : "Nenhum carregamento ativo no momento"}
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

        {carregamentosFinalizados.length > 0 && (
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
              <Truck className="h-5 w-5 text-muted-foreground" />
              <span className="text-muted-foreground">
                Carregamentos Finalizados ({carregamentosFinalizados.length})
              </span>
            </Button>
            
            {secaoFinalizadosExpandida && (
              <div className="grid gap-4 ml-7">
                {carregamentosFinalizados.map(renderCarregamentoCard)}
              </div>
            )}
          </div>
        )}

        {carregamentosAtivos.length === 0 && carregamentosFinalizados.length === 0 && (
          <div className="text-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {hasActiveFilters
                ? "Nenhum carregamento encontrado com os filtros aplicados"
                : "Nenhum carregamento cadastrado ainda"}
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

export default Carregamentos;
