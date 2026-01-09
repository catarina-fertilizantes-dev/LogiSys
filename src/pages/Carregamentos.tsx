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
import { Truck, X, Filter as FilterIcon, ChevronDown, ChevronUp, Info, Clock, User } from "lucide-react";

// 🎯 FUNÇÃO PARA DETERMINAR STATUS DO CARREGAMENTO (MESMA DA PÁGINA AGENDAMENTOS)
const getStatusCarregamento = (etapaAtual: number) => {
  if (etapaAtual === 0) {
    return {
      status: "Aguardando",
      percentual: 0,
      cor: "bg-yellow-100 text-yellow-800",
      tooltip: "Aguardando chegada do veículo"
    };
  } else if (etapaAtual >= 1 && etapaAtual < 5) {
    const percentual = Math.round((etapaAtual / 5) * 100);
    let tooltip = "";
    
    switch (etapaAtual) {
      case 1:
        tooltip = "Caminhão chegou ao armazém";
        break;
      case 2:
        tooltip = "Carregamento do caminhão iniciado";
        break;
      case 3:
        tooltip = "Carregando o caminhão";
        break;
      case 4:
        tooltip = "Carregamento do caminhão finalizado";
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

// Funções de formatação
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
  // 🎯 NOVOS CAMPOS PARA O SISTEMA DE STATUS
  status_carregamento: string;
  cor_carregamento: string;
  tooltip_carregamento: string;
}

interface SupabaseCarregamentoItem {
  id: string;
  etapa_atual: number | null;
  numero_nf: string | null;
  data_chegada: string | null;
  created_at: string | null;
  cliente_id: string | null;
  armazem_id: string | null;
  // URLs das fotos por etapa
  url_foto_chegada: string | null;
  url_foto_inicio: string | null;
  url_foto_carregando: string | null;
  url_foto_finalizacao: string | null;
  agendamento: {
    id: string;
    data_retirada: string;
    quantidade: number | null;
    placa_caminhao: string | null;
    motorista_nome: string | null;
    motorista_documento: string | null;
    liberacao: {
      pedido_interno: string | null;
      produto: {
        nome: string | null;
      } | null;
      clientes: {
        nome: string | null;
      } | null;
      armazem: {
        nome: string | null;
        cidade: string | null;
        estado: string | null;
      } | null;
    } | null;
  } | null;
}

// 🎯 ARRAY DE STATUS PARA FILTROS (SUBSTITUINDO ETAPAS)
const STATUS_CARREGAMENTO = [
  { id: "Aguardando", nome: "Aguardando", cor: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  { id: "Em Andamento", nome: "Em Andamento", cor: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  { id: "Finalizado", nome: "Finalizado", cor: "bg-green-100 text-green-800 hover:bg-green-200" },
];

const Carregamentos = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [armazemId, setArmazemId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const fetchRoles = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (data) setRoles(data.map((r) => r.role));
    };

    fetchRoles();
  }, [userId]);

  useEffect(() => {
    const fetchVinculos = async () => {
      if (!userId || roles.length === 0) return;
      if (roles.includes("cliente")) {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", userId)
          .single();
        setClienteId(cliente?.id ?? null);
      } else {
        setClienteId(null);
      }
      if (roles.includes("armazem")) {
        const { data: armazem } = await supabase
          .from("armazens")
          .select("id")
          .eq("user_id", userId)
          .single();
        setArmazemId(armazem?.id ?? null);
      } else {
        setArmazemId(null);
      }
    };

    fetchVinculos();
    // eslint-disable-next-line
  }, [userId, roles]);

  // 🔥 QUERY ATUALIZADA PARA BUSCAR DADOS COMPLETOS
  const { data: carregamentosData, isLoading, error } = useQuery({
    queryKey: ["carregamentos", clienteId, armazemId, roles],
    queryFn: async () => {
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

      if (roles.includes("cliente") && clienteId) {
        query = query.eq("cliente_id", clienteId);
      } else if (roles.includes("armazem") && armazemId) {
        query = query.eq("armazem_id", armazemId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[ERROR] Erro ao buscar carregamentos:", error);
        throw error;
      }
      return data;
    },
    enabled:
      userId != null &&
      roles.length > 0 &&
      (
        (!roles.includes("cliente") && !roles.includes("armazem"))
        || (roles.includes("cliente") && clienteId !== null)
        || (roles.includes("armazem") && armazemId !== null)
      ),
    refetchInterval: 30000,
  });

  // 🔥 MAPEAMENTO ATUALIZADO COM NOVO SISTEMA DE STATUS E DADOS COMPLETOS
  const carregamentos = useMemo<CarregamentoItem[]>(() => {
    if (!carregamentosData) return [];
    return carregamentosData.map((item: SupabaseCarregamentoItem) => {
      const agendamento = item.agendamento;
      const liberacao = agendamento?.liberacao;
      
      // Conta quantas fotos existem baseado nas URLs preenchidas
      const fotosCount = [
        item.url_foto_chegada,
        item.url_foto_inicio,
        item.url_foto_carregando,
        item.url_foto_finalizacao
      ].filter(url => url && url.trim() !== '').length;

      const etapaAtual = item.etapa_atual ?? 1;
      
      // 🎯 APLICAR NOVO SISTEMA DE STATUS
      const statusInfo = getStatusCarregamento(etapaAtual);

      return {
        id: item.id,
        cliente: liberacao?.clientes?.nome || "N/A",
        produto: liberacao?.produto?.nome || "N/A",
        pedido: liberacao?.pedido_interno || "N/A",
        armazem: liberacao?.armazem 
          ? `${liberacao.armazem.nome} - ${liberacao.armazem.cidade}/${liberacao.armazem.estado}`
          : "N/A",
        quantidade: agendamento?.quantidade || 0,
        placa: agendamento?.placa_caminhao || "N/A",
        motorista: agendamento?.motorista_nome || "N/A",
        documento: agendamento?.motorista_documento || "N/A",
        data_retirada: agendamento?.data_retirada || "N/A",
        etapa_atual: etapaAtual,
        fotosTotal: fotosCount,
        numero_nf: item.numero_nf || null,
        cliente_id: item.cliente_id ?? null,
        armazem_id: item.armazem_id ?? null,
        // 🎯 NOVOS CAMPOS DO SISTEMA DE STATUS
        status_carregamento: statusInfo.status,
        cor_carregamento: statusInfo.cor,
        tooltip_carregamento: statusInfo.tooltip,
      };
    });
  }, [carregamentosData]);

  // 🎯 FILTROS ATUALIZADOS PARA USAR STATUS EM VEZ DE ETAPAS
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

  const filteredCarregamentos = useMemo(() => {
    return carregamentos.filter((c) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${c.cliente} ${c.motorista} ${c.placa} ${c.pedido}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      // 🎯 FILTRO ATUALIZADO PARA USAR STATUS EM VEZ DE ETAPAS
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
  }, [carregamentos, search, selectedStatus, dateFrom, dateTo]);

  const showingCount = filteredCarregamentos.length;
  const totalCount = carregamentos.length;
  const activeAdvancedCount =
    (selectedStatus.length ? 1 : 0) + 
    ((dateFrom || dateTo) ? 1 : 0);

  if (isLoading || userId == null || roles.length === 0 ||
    (roles.includes("cliente") && clienteId === null) ||
    (roles.includes("armazem") && armazemId === null)
  ) {
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

        {/* Barra de busca/filtro */}
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
        </div>

        {/* 🎯 FILTROS ATUALIZADOS COM SISTEMA DE STATUS */}
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
            <div className="flex flex-col md:flex-row md:items-center gap-2 mt-3">
              <div className="flex items-center gap-3 flex-1">
                <Label className="text-sm font-semibold">Período</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[160px]" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[160px]" />
              </div>
              <div className="flex flex-1 justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-4 w-4" /> Limpar Filtros
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {filteredCarregamentos.map((carr) => {
            return (
              <Link key={carr.id} to={`/carregamentos/${carr.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Card className="transition-all hover:shadow-md cursor-pointer">
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                            <Truck className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            {/* 🎯 NOVO LAYOUT DO CARD CONFORME SOLICITADO */}
                            <h3 className="font-semibold text-foreground">Pedido: {carr.pedido}</h3>
                            <p className="text-xs text-muted-foreground">Cliente: <span className="font-semibold">{carr.cliente}</span></p>
                            <p className="text-xs text-muted-foreground">Produto: <span className="font-semibold">{carr.produto}</span></p>
                            <p className="text-xs text-muted-foreground">Armazém: <span className="font-semibold">{carr.armazem}</span></p>
                            {carr.numero_nf && (
                              <p className="text-xs text-muted-foreground mt-1">Nº NF: <span className="font-semibold">{carr.numero_nf}</span></p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {/* 🎯 NOVO BADGE COM STATUS E TOOLTIP */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1">
                                <Badge className={`${carr.cor_carregamento} border-0 font-medium`}>
                                  {carr.status_carregamento}
                                </Badge>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm">{carr.tooltip_carregamento}</p>
                            </TooltipContent>
                          </Tooltip>
                          <div className="text-xs text-muted-foreground">Fotos: <span className="font-semibold">{carr.fotosTotal}</span></div>
                        </div>
                      </div>

                      {/* 📋 INFORMAÇÕES DO CARREGAMENTO NO ESTILO AGENDAMENTOS */}
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
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {filteredCarregamentos.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhum carregamento encontrado.
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Carregamentos;
