import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { DocumentViewer } from "@/components/DocumentViewer";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { 
  Loader2, 
  ArrowLeft, 
  Package, 
  MapPin,
  Filter as FilterIcon,
  X,
  ChevronDown,
  ChevronUp,
  Archive,
  Layers
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface RemessaItem {
  id: string;
  quantidade_original: number;
  numero_remessa: string | null;
  observacoes: string | null;
  url_nota_remessa: string | null;
  url_xml_remessa: string | null;
  created_at: string;
  created_by: string | null;
}

interface EstoqueDetalhes {
  produto: {
    id: string;
    nome: string;
    unidade: string;
  };
  armazem: {
    id: string;
    nome: string;
    cidade: string;
    estado: string;
  };
  quantidade_total: number;
  remessas: RemessaItem[];
}

const formatarDataHora = (data: string) => {
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit", 
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const parseDate = (d: string) => {
  return new Date(d);
};

const EstoqueDetalhe = () => {
  useScrollToTop();
  
  const { produtoId, armazemId } = useParams<{ produtoId: string; armazemId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, userRole } = useAuth();

  // Estados para filtros
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quantidadeMin, setQuantidadeMin] = useState("");
  const [quantidadeMax, setQuantidadeMax] = useState("");

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setQuantidadeMin("");
    setQuantidadeMax("");
  };

  const { data: currentArmazem } = useQuery({
    queryKey: ["current-armazem-detalhe", user?.id],
    queryFn: async () => {
      if (!user || userRole !== "armazem") return null;
      const { data, error } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && userRole === "armazem",
  });

  console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - Renderização iniciada");
  console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - produtoId (URL):", produtoId);
  console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - armazemId (URL):", armazemId);
  console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - userRole:", userRole);
  console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - user?.id:", user?.id);
  console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - currentArmazem:", currentArmazem);

  const handleGoBack = () => {
    navigate("/estoque");
  };

  const { data: estoqueDetalhes, isLoading, error } = useQuery({
    queryKey: ["estoque-detalhe", produtoId, armazemId, user?.id],
    queryFn: async () => {
      console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - queryFn executada");
      console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - Parâmetros:", { 
        produtoId, 
        armazemId, 
        userId: user?.id, 
        userRole, 
        currentArmazem 
      });
      
      if (userRole === "armazem" && currentArmazem && currentArmazem.id !== armazemId) {
        console.log("❌ [ERROR] EstoqueDetalhe.jsx - Sem permissão para este armazém");
        throw new Error("Sem permissão para visualizar este armazém");
      }

      const { data: estoqueData, error: estoqueError } = await supabase
        .from("estoque")
        .select(`
          quantidade,
          produto:produtos(id, nome, unidade),
          armazem:armazens(id, nome, cidade, estado)
        `)
        .eq("produto_id", produtoId)
        .eq("armazem_id", armazemId)
        .maybeSingle();

      if (estoqueError) {
        console.error("❌ [ERROR] EstoqueDetalhe - Erro ao buscar estoque:", estoqueError);
        throw estoqueError;
      }

      if (!estoqueData) {
        throw new Error("Estoque não encontrado");
      }

      const { data: remessasData, error: remessasError } = await supabase
        .from("estoque_remessas")
        .select(`
          id,
          quantidade_original,
          numero_remessa,
          observacoes,
          url_nota_remessa,
          url_xml_remessa,
          created_at,
          created_by
        `)
        .eq("produto_id", produtoId)
        .eq("armazem_id", armazemId)
        .order("created_at", { ascending: false });

      if (remessasError) {
        console.error("❌ [ERROR] EstoqueDetalhe - Erro ao buscar remessas:", remessasError);
        throw remessasError;
      }

      const resultado: EstoqueDetalhes = {
        produto: estoqueData.produto,
        armazem: estoqueData.armazem,
        quantidade_total: estoqueData.quantidade,
        remessas: remessasData || []
      };

      console.log("✅ [SUCCESS] EstoqueDetalhe - Dados carregados:", resultado);
      return resultado;
    },
    enabled: (() => {
      const enabled = !!produtoId && !!armazemId && !!user?.id && 
                     (userRole !== "armazem" || !!currentArmazem);
      console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - Query enabled:", {
        produtoId: !!produtoId,
        armazemId: !!armazemId,
        userId: !!user?.id,
        userRole,
        currentArmazem: !!currentArmazem,
        enabled
      });
      return enabled;
    })(),
  });

  useEffect(() => {
    console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - useEffect permissão disparado");
    console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - Condições verificação:", {
      isLoading,
      estoqueDetalhes: !!estoqueDetalhes,
      userId: !!user?.id,
      userRole,
      currentArmazem,
      armazemId
    });
    
    if (!isLoading && estoqueDetalhes && user?.id) {
      console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - Entrando na verificação de permissão");
      
      if (userRole === "armazem" && !currentArmazem) {
        console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - Aguardando currentArmazem ser carregado");
        return;
      }
      
      const hasPermission = 
        userRole === "admin" ||
        userRole === "logistica" ||
        (userRole === "armazem" && currentArmazem?.id === armazemId);
      
      console.log("🔍 [DEBUG] EstoqueDetalhe.jsx - Verificação de permissão:", {
        userRole,
        isAdmin: userRole === "admin",
        isLogistica: userRole === "logistica",
        isArmazem: userRole === "armazem",
        currentArmazemId: currentArmazem?.id,
        armazemIdFromUrl: armazemId,
        armazemMatch: currentArmazem?.id === armazemId,
        hasPermission
      });
      
      if (!hasPermission) {
        console.log("❌ [ERROR] EstoqueDetalhe - Sem permissão, redirecionando");
        navigate("/estoque");
      } else {
        console.log("✅ [SUCCESS] EstoqueDetalhe - Permissão concedida");
      }
    }
  }, [isLoading, estoqueDetalhes, user?.id, userRole, currentArmazem, armazemId, navigate]);

  const aplicarFiltros = (remessas: RemessaItem[]): RemessaItem[] => {
    return remessas.filter(remessa => {
      if (search.trim()) {
        const termo = search.trim().toLowerCase();
        const numeroRemessa = (remessa.numero_remessa || '').toLowerCase();
        const idRemessa = remessa.id.toLowerCase();
        if (!numeroRemessa.includes(termo) && !idRemessa.includes(termo)) {
          return false;
        }
      }

      if (dateFrom) {
        const dataRemessa = parseDate(remessa.created_at);
        const dataInicio = new Date(dateFrom);
        if (dataRemessa < dataInicio) return false;
      }

      if (dateTo) {
        const dataRemessa = parseDate(remessa.created_at);
        const dataFim = new Date(dateTo);
        dataFim.setHours(23, 59, 59, 999);
        if (dataRemessa > dataFim) return false;
      }

      if (quantidadeMin.trim()) {
        const qtdMin = parseFloat(quantidadeMin);
        if (!isNaN(qtdMin) && remessa.quantidade_original < qtdMin) return false;
      }

      if (quantidadeMax.trim()) {
        const qtdMax = parseFloat(quantidadeMax);
        if (!isNaN(qtdMax) && remessa.quantidade_original > qtdMax) return false;
      }

      return true;
    });
  };

  const remessasFiltradas = estoqueDetalhes ? aplicarFiltros(estoqueDetalhes.remessas) : [];
  const entradaTotal = remessasFiltradas.reduce((total, remessa) => total + remessa.quantidade_original, 0);
  const numeroRemessasFiltradas = remessasFiltradas.length;

  const activeFiltersCount = 
    (search.trim() ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (quantidadeMin.trim() || quantidadeMax.trim() ? 1 : 0);
  
  const hasActiveFilters = search.trim() || dateFrom || dateTo || quantidadeMin.trim() || quantidadeMax.trim();

  const renderRemessaCard = (remessa: RemessaItem) => (
    <Card key={remessa.id} className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header da remessa - Layout responsivo */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-lg bg-gradient-primary flex-shrink-0">
                <Package className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm md:text-base text-foreground leading-tight break-words">
                  {remessa.numero_remessa || `Remessa ${remessa.id.slice(-8)}`}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Quantidade: <span className="font-semibold">{remessa.quantidade_original.toLocaleString('pt-BR')} {estoqueDetalhes?.produto.unidade}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Registrada em: {formatarDataHora(remessa.created_at)}
                </p>
              </div>
            </div>
            
            <Badge variant="secondary" className="text-xs self-start sm:self-auto">
              Remessa
            </Badge>
          </div>

          {/* Observações (se houver) */}
          {remessa.observacoes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Observações:</p>
              <p className="text-xs md:text-sm bg-muted p-2 rounded-md break-words">{remessa.observacoes}</p>
            </div>
          )}

          {/* Documentos - Layout responsivo */}
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Documentos:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DocumentViewer
                url={remessa.url_nota_remessa}
                type="pdf"
                bucket="estoque-documentos"
                title="Nota de Remessa"
                description="PDF"
                variant="button"
                size="md"
                showPreview={true}
              />

              <DocumentViewer
                url={remessa.url_xml_remessa}
                type="xml"
                bucket="estoque-documentos"
                title="Arquivo XML"
                description="XML"
                variant="button"
                size="md"
                showPreview={true}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader 
          title="Detalhes do Estoque"
          backButton={
            <Button
              size="sm"
              onClick={handleGoBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mr-2 min-h-[44px] max-md:min-h-[44px] btn-secondary"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
          }
        />
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="ml-3 text-muted-foreground">Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (error || !estoqueDetalhes) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader 
          title="Detalhes do Estoque"
          backButton={
            <Button
              size="sm"
              onClick={handleGoBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mr-2 min-h-[44px] max-md:min-h-[44px] btn-secondary"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
          }
        />
        <Card className="border-destructive">
          <CardContent className="p-4 md:p-6">
            <div className="text-center text-destructive">
              <p className="font-semibold">Erro ao carregar detalhes do estoque</p>
              <p className="text-sm mt-2">
                {error instanceof Error
                  ? error.message
                  : "Erro desconhecido ou sem permissão"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader 
        title="Detalhes do Estoque"
        subtitle={`${estoqueDetalhes.produto.nome} - ${estoqueDetalhes.armazem.nome}`}
        backButton={
          <Button
            size="sm"
            onClick={handleGoBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mr-2 min-h-[44px] max-md:min-h-[44px] btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
        }
      />
      
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        {/* Card de informações gerais - Otimizado para mobile */}
        <Card className="shadow-sm">
          <CardContent className="p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold mb-4">Informações do Estoque</h2>
            
            {/* Layout otimizado responsivo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Produto */}
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-muted-foreground">Produto:</p>
                  <p className="font-semibold text-sm md:text-base break-words">{estoqueDetalhes.produto.nome}</p>
                </div>
              </div>

              {/* Armazém */}
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-muted-foreground">Armazém:</p>
                  <p className="font-semibold text-sm md:text-base break-words">{estoqueDetalhes.armazem.nome}</p>
                </div>
              </div>

              {/* Nº de Remessas */}
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-muted-foreground">Nº de Remessas:</p>
                  <p className="font-semibold text-sm md:text-base">{numeroRemessasFiltradas}</p>
                </div>
              </div>

              {/* Localização */}
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-muted-foreground">Localização:</p>
                  <p className="font-semibold text-sm md:text-base break-words">{estoqueDetalhes.armazem.cidade}/{estoqueDetalhes.armazem.estado}</p>
                </div>
              </div>
            </div>

            {/* Totalizadores - Layout responsivo */}
            <div className="pt-4 border-t mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-green-50 p-3 md:p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Archive className="h-4 w-4 md:h-5 md:w-5 text-green-600 flex-shrink-0" />
                    <span className="font-medium text-green-800 text-sm md:text-base">Entrada Total</span>
                  </div>
                  <p className="text-base md:text-xl font-bold text-green-700 break-words">
                    {entradaTotal.toLocaleString('pt-BR')} {estoqueDetalhes.produto.unidade}
                  </p>
                </div>

                <div className="bg-blue-50 p-3 md:p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 md:h-5 md:w-5 text-blue-600 flex-shrink-0" />
                    <span className="font-medium text-blue-800 text-sm md:text-base">Estoque Atual</span>
                  </div>
                  <p className="text-base md:text-xl font-bold text-blue-700 break-words">
                    {estoqueDetalhes.quantidade_total.toLocaleString('pt-BR')} {estoqueDetalhes.produto.unidade}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Barra de filtros - Mobile otimizada */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Input
              className="h-9 flex-1 min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
              placeholder="Buscar por número da remessa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button 
              size="sm" 
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="whitespace-nowrap min-h-[44px] max-md:min-h-[44px] btn-secondary"
            >
              <FilterIcon className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltersCount ? ` (${activeFiltersCount})` : ""}
              {filtersOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Mostrando <span className="font-medium">{numeroRemessasFiltradas}</span> de <span className="font-medium">{estoqueDetalhes.remessas.length}</span>
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

        {/* Filtros avançados - Mobile otimizado */}
        {filtersOpen && (
          <div className="rounded-md border p-3 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Período */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Período</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input 
                    type="date" 
                    value={dateFrom} 
                    onChange={(e) => setDateFrom(e.target.value)} 
                    className="min-h-[44px] max-md:min-h-[44px]" 
                    placeholder="De"
                  />
                  <Input 
                    type="date" 
                    value={dateTo} 
                    onChange={(e) => setDateTo(e.target.value)} 
                    className="min-h-[44px] max-md:min-h-[44px]" 
                    placeholder="Até"
                  />
                </div>
              </div>

              {/* Quantidade */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Quantidade ({estoqueDetalhes.produto.unidade})
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={quantidadeMin} 
                    onChange={(e) => setQuantidadeMin(e.target.value)} 
                    className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base" 
                    placeholder="Mín"
                  />
                  <Input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={quantidadeMax} 
                    onChange={(e) => setQuantidadeMax(e.target.value)} 
                    className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base" 
                    placeholder="Máx"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de remessas */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary flex-shrink-0" />
            <h2 className="text-base md:text-lg font-semibold">
              Histórico de Remessas 
              {activeFiltersCount > 0 ? (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({numeroRemessasFiltradas} de {estoqueDetalhes.remessas.length})
                </span>
              ) : (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({estoqueDetalhes.remessas.length})
                </span>
              )}
            </h2>
          </div>
          
          <div className="space-y-3">
            {remessasFiltradas.length > 0 ? (
              remessasFiltradas.map(renderRemessaCard)
            ) : hasActiveFilters ? (
              <Card className="border-dashed">
                <CardContent className="p-6 md:p-8 text-center">
                  <FilterIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-muted-foreground mb-2">
                    Nenhuma remessa encontrada
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Nenhuma remessa corresponde aos filtros aplicados.
                  </p>
                  <Button
                    size="sm"
                    onClick={clearFilters}
                    className="min-h-[44px] max-md:min-h-[44px] btn-secondary"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Limpar Filtros
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-6 md:p-8 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-muted-foreground mb-2">
                    Nenhuma remessa encontrada
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Não há remessas registradas para este produto neste armazém.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstoqueDetalhe;
