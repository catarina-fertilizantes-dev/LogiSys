import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, X, Filter as FilterIcon, ChevronDown, ChevronUp, AlertCircle, ExternalLink, Loader2, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { ModalFooter } from "@/components/ui/modal-footer";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesAlert } from "@/components/UnsavedChangesAlert";

type StockStatus = "normal" | "baixo";
type Unidade = "t" | "kg";

interface ProdutoEstoque {
  id: string;
  produto: string;
  quantidade: number;
  unidade: string;
  status: StockStatus;
  data: string;
  produto_id?: string;
  ativo?: boolean;
}

interface ArmazemEstoque {
  id: string;
  nome: string;
  cidade: string;
  estado?: string;
  produtos: ProdutoEstoque[];
  capacidade_total?: number;
  ativo?: boolean;
}

interface SupabaseEstoqueItem {
  id: string;
  quantidade: number;
  updated_at: string;
  produto: {
    id: string;
    nome: string;
    unidade: string;
    ativo?: boolean;
  } | null;
  armazem: {
    id: string;
    nome: string;
    cidade: string;
    estado?: string;
    capacidade_total?: number;
    ativo?: boolean;
  } | null;
}

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

const Estoque = () => {
  useScrollToTop();
  
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
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole, userRole, user } = useAuth();
  const navigate = useNavigate();

  const canCreate = hasRole("admin") || hasRole("logistica");

  // Estados de loading
  const [isCreating, setIsCreating] = useState(false);

  // Estados para documentos
  const [notaRemessaFile, setNotaRemessaFile] = useState<File | null>(null);
  const [xmlRemessaFile, setXmlRemessaFile] = useState<File | null>(null);
  const [numeroRemessa, setNumeroRemessa] = useState("");
  const [observacoesRemessa, setObservacoesRemessa] = useState("");

  console.log("🔍 [DEBUG] Estoque.tsx - Renderização iniciada");
  console.log("🔍 [DEBUG] Estoque.tsx - userRole:", userRole);
  console.log("🔍 [DEBUG] Estoque.tsx - user?.id:", user?.id);

  const { data: currentArmazem } = useQuery({
    queryKey: ["current-armazem", user?.id],
    queryFn: async () => {
      console.log("🔍 [DEBUG] Estoque.tsx - Buscando currentArmazem para:", user?.id);
      if (!user || userRole !== "armazem") return null;
      const { data, error } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (error) throw error;
      console.log("✅ [SUCCESS] Estoque.tsx - currentArmazem encontrado:", data);
      return data;
    },
    enabled: !!user && userRole === "armazem",
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  console.log("🔍 [DEBUG] Estoque.tsx - currentArmazem:", currentArmazem);

  const { data: estoqueData, isLoading, error } = useQuery({
    queryKey: ["estoque", currentArmazem?.id, userRole],
    queryFn: async () => {
      console.log("🔍 [DEBUG] Estoque.tsx - queryFn executada");
      console.log("🔍 [DEBUG] Estoque.tsx - Condições queryFn:", {
        userRole,
        currentArmazem,
        currentArmazemId: currentArmazem?.id
      });

      let query = supabase
        .from("estoque")
        .select(`
          id,
          quantidade,
          updated_at,
          produto:produtos(id, nome, unidade, ativo),
          armazem:armazens(id, nome, cidade, estado, capacidade_total, ativo)
        `)
        .order("updated_at", { ascending: false });

      if (userRole === "armazem" && currentArmazem?.id) {
        console.log("🔍 [DEBUG] Estoque.tsx - Aplicando filtro por armazém:", currentArmazem.id);
        query = query.eq("armazem_id", currentArmazem.id);
      }

      const { data, error } = await query;
      if (error) {
        toast({ variant: "destructive", title: "Erro ao buscar estoque", description: error.message });
        throw error;
      }
      console.log("✅ [SUCCESS] Estoque.tsx - Dados carregados:", data?.length, "registros");
      return data;
    },
    refetchInterval: 30000,
    enabled: !!user?.id && (userRole !== "armazem" || !!currentArmazem?.id),
    staleTime: 2 * 60 * 1000,
  });

  const { data: produtosCadastrados } = useQuery({
    queryKey: ["produtos-cadastrados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, unidade, ativo")
        .order("nome");
      if (error) {
        toast({ variant: "destructive", title: "Erro ao buscar produtos", description: error.message });
        return [];
      }
      return data || [];
    },
    refetchInterval: 30000,
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  const { data: armazensAtivos } = useQuery({
    queryKey: ["armazens-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado, capacidade_total, ativo")
        .eq("ativo", true)
        .order("cidade");
      if (error) {
        toast({ variant: "destructive", title: "Erro ao buscar armazéns", description: error.message });
        return [];
      }
      return data || [];
    },
    refetchInterval: 30000,
    staleTime: 5 * 60 * 1000,
    enabled: canCreate && !!user?.id,
  });

  const { data: armazensParaFiltro } = useQuery({
    queryKey: ["armazens-filtro", currentArmazem?.id],
    queryFn: async () => {
      if (userRole === "armazem" && currentArmazem) {
        return [currentArmazem];
      }
      
      const { data, error } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado, ativo")
        .eq("ativo", true)
        .order("cidade");
      if (error) {
        toast({ variant: "destructive", title: "Erro ao buscar armazéns para filtro", description: error.message });
        return [];
      }
      return data || [];
    },
    refetchInterval: 10000,
    staleTime: 3 * 60 * 1000,
    enabled: !!user?.id,
  });

  const estoquePorArmazem: ArmazemEstoque[] = useMemo(() => {
    if (!estoqueData) return [];
    const map: { [armazemId: string]: ArmazemEstoque } = {};
    for (const item of estoqueData as SupabaseEstoqueItem[]) {
      if (!item.armazem || !item.armazem.id || !item.armazem.ativo) continue;
      if (!item.produto || !item.produto.ativo) continue;
      const armazemId = item.armazem.id;
      if (!map[armazemId]) {
        map[armazemId] = {
          id: armazemId,
          nome: item.armazem.nome,
          cidade: item.armazem.cidade,
          estado: item.armazem.estado,
          capacidade_total: item.armazem.capacidade_total,
          ativo: item.armazem.ativo,
          produtos: [],
        };
      }
      map[armazemId].produtos.push({
        id: item.id,
        produto: item.produto?.nome || "N/A",
        quantidade: item.quantidade,
        unidade: item.produto?.unidade || "t",
        status: item.quantidade < 10 ? "baixo" : "normal",
        data: new Date(item.updated_at).toLocaleDateString("pt-BR"),
        produto_id: item.produto?.id,
        ativo: item.produto?.ativo,
      });
    }
    return Object.values(map).sort((a, b) => {
      if (a.nome === b.nome) return a.cidade.localeCompare(b.cidade);
      return a.nome.localeCompare(b.nome);
    });
  }, [estoqueData]);

  const produtosUnicos = useMemo(() => {
    const set = new Set<string>();
    estoquePorArmazem.forEach(armazem =>
      armazem.produtos.forEach(produto => set.add(produto.produto))
    );
    return Array.from(set).sort();
  }, [estoquePorArmazem]);
  
  const armazensUnicos = useMemo(() => {
    return estoquePorArmazem.map(a => ({
      id: a.id,
      nome: a.nome,
      cidade: a.cidade,
      estado: a.estado
    }));
  }, [estoquePorArmazem]);

  const [openArmazemId, setOpenArmazemId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProdutos, setSelectedProdutos] = useState<string[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<StockStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const clearFilters = () => {
    setSearch("");
    setSelectedProdutos([]);
    setSelectedWarehouses([]);
    setSelectedStatuses([]);
    setDateFrom("");
    setDateTo("");
  };

  const filteredArmazens = useMemo(() => {
    return estoquePorArmazem
      .filter((armazem) => {
        if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(armazem.id)) return false;
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          if (
            !(
              armazem.nome.toLowerCase().includes(term) ||
              armazem.cidade.toLowerCase().includes(term) ||
              armazem.produtos.some(prod => prod.produto.toLowerCase().includes(term))
            )
          ) {
            return false;
          }
        }
        if (selectedProdutos.length > 0) {
          return armazem.produtos.some((prod) => selectedProdutos.includes(prod.produto));
        }
        return true;
      })
      .map((armazem) => {
        let produtos = armazem.produtos;
        if (selectedStatuses.length > 0) {
          produtos = produtos.filter((p) => selectedStatuses.includes(p.status));
        }
        if (dateFrom) {
          const from = new Date(dateFrom);
          produtos = produtos.filter((p) => parseDate(p.data) >= from);
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          produtos = produtos.filter((p) => parseDate(p.data) <= to);
        }
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          produtos = produtos.filter(
            p => p.produto.toLowerCase().includes(term) ||
              armazem.nome.toLowerCase().includes(term) ||
              armazem.cidade.toLowerCase().includes(term)
          );
        }
        if (selectedProdutos.length > 0) {
          produtos = produtos.filter(prod => selectedProdutos.includes(prod.produto));
        }
        return { ...armazem, produtos };
      });
  }, [estoquePorArmazem, search, selectedProdutos, selectedWarehouses, selectedStatuses, dateFrom, dateTo]);

  const showingCount = filteredArmazens.reduce((acc, armazem) => acc + armazem.produtos.length, 0);
  const totalCount = estoquePorArmazem.reduce((acc, armazem) => acc + armazem.produtos.length, 0);

  const activeAdvancedCount =
    (selectedProdutos.length ? 1 : 0) +
    (selectedWarehouses.length && userRole !== "armazem" ? 1 : 0) +
    (selectedStatuses.length ? 1 : 0) +
    ((dateFrom || dateTo) ? 1 : 0);
  
  const hasActiveFilters = search.trim() || selectedProdutos.length > 0 || selectedWarehouses.length > 0 || selectedStatuses.length > 0 || dateFrom || dateTo;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({
    produtoId: "",
    armazem: "",
    quantidade: "",
    unidade: "t" as Unidade,
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modal = urlParams.get('modal');
    const produtoParam = urlParams.get('produto');
    const armazemParam = urlParams.get('armazem');
    
    if (modal === 'novo' && canCreate) {
      setDialogOpen(true);
      
      if (produtosCadastrados && armazensAtivos) {
        if (produtoParam || armazemParam) {
          const produtoValido = produtoParam && produtosCadastrados.some(p => p.id === produtoParam && p.ativo);
          const armazemValido = armazemParam && armazensAtivos.some(a => a.id === armazemParam);
          
          if (produtoValido || armazemValido) {
            setNovoProduto(prev => ({
              ...prev,
              produtoId: produtoValido ? produtoParam : "",
              armazem: armazemValido ? armazemParam : ""
            }));
          }
        }
        
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [canCreate, produtosCadastrados, armazensAtivos]);

  const resetFormNovoProduto = () => {
    setNovoProduto({ produtoId: "", armazem: "", quantidade: "", unidade: "t" });
    setNotaRemessaFile(null);
    setXmlRemessaFile(null);
    setNumeroRemessa("");
    setObservacoesRemessa("");
    resetUnsavedChanges(); // ✅ Limpar estado de mudanças
  };

  // ✅ Função para fechar modal com verificação
  const handleCloseModal = () => {
    handleClose(() => {
      setDialogOpen(false);
      resetFormNovoProduto(); // ✅ Limpar dados ao fechar
    });
  };

  const handleFileChange = (
    file: File | null, 
    allowedTypes: string[], 
    allowedExtensions: string[], 
    setterFunction: (file: File | null) => void,
    inputElement: HTMLInputElement
  ) => {
    if (!file) {
      setterFunction(null);
      markAsChanged(); // ✅ Marcar como alterado mesmo ao remover arquivo
      return;
    }

    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isValidExtension = allowedExtensions.includes(`.${fileExtension}`);
    
    const isValidMimeType = allowedTypes.includes(file.type);

    if (!isValidExtension || !isValidMimeType) {
      toast({ 
        variant: "destructive", 
        title: "Tipo de arquivo inválido", 
        description: `Selecione apenas arquivos ${allowedExtensions.join(' ou ')}.` 
      });
      inputElement.value = '';
      setterFunction(null);
      return;
    }

    setterFunction(file);
    markAsChanged(); // ✅ Marcar como alterado ao selecionar arquivo
  };

  const uploadDocumentos = async (produtoId: string, armazemId: string) => {
    const uploads = [];
    
    if (notaRemessaFile) {
      const fileName = `${produtoId}_${armazemId}_nota_remessa_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('estoque-documentos')
        .upload(fileName, notaRemessaFile);

      if (uploadError) {
        console.error("❌ [ERROR] Upload nota remessa:", uploadError);
        throw new Error(`Erro ao fazer upload da nota de remessa: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('estoque-documentos')
        .getPublicUrl(fileName);

      uploads.push({ campo: 'url_nota_remessa', url: urlData.publicUrl });
    }

    if (xmlRemessaFile) {
      const fileName = `${produtoId}_${armazemId}_xml_remessa_${Date.now()}.xml`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('estoque-documentos')
        .upload(fileName, xmlRemessaFile);

      if (uploadError) {
        console.error("❌ [ERROR] Upload XML remessa:", uploadError);
        throw new Error(`Erro ao fazer upload do XML: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('estoque-documentos')
        .getPublicUrl(fileName);

      uploads.push({ campo: 'url_xml_remessa', url: urlData.publicUrl });
    }

    return uploads;
  };

  const handleCreateProduto = async () => {
    const { produtoId, armazem, quantidade, unidade } = novoProduto;
    const qtdNum = Number(quantidade);

    if (!produtoId || !armazem.trim() || !quantidade) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }

    if (!notaRemessaFile) {
      toast({ variant: "destructive", title: "Documento obrigatório", description: "Anexe a nota de remessa em PDF." });
      return;
    }

    if (!xmlRemessaFile) {
      toast({ variant: "destructive", title: "Documento obrigatório", description: "Anexe o arquivo XML da remessa." });
      return;
    }

    if (
      Number.isNaN(qtdNum) ||
      qtdNum <= 0 ||
      quantidade.trim() === "" ||
      !/^\d+(\.\d+)?$/.test(quantidade.trim())
    ) {
      toast({ variant: "destructive", title: "Valor inválido", description: "Digite um valor numérico maior que zero." });
      return;
    }

    setIsCreating(true);

    try {
      const produtoSelecionado = produtosCadastrados?.find(p => p.id === produtoId && p.ativo);
      if (!produtoSelecionado) {
        toast({ variant: "destructive", title: "Produto não encontrado ou inativo", description: "Selecione um produto ativo." });
        return;
      }

      const { data: armazemData, error: errArmazem } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado, capacidade_total, ativo")
        .eq("id", armazem)
        .eq("ativo", true)
        .maybeSingle();

      if (errArmazem) {
        toast({ variant: "destructive", title: "Erro ao buscar armazém", description: errArmazem.message });
        return;
      }

      if (!armazemData?.id) {
        toast({ variant: "destructive", title: "Armazém não encontrado ou inativo", description: "Selecione um armazém ativo válido." });
        return;
      }

      console.log("🔍 [DEBUG] Fazendo upload dos documentos...");
      const uploads = await uploadDocumentos(produtoId, armazemData.id);

      const urlNotaRemessa = uploads.find(u => u.campo === 'url_nota_remessa')?.url || null;
      const urlXmlRemessa = uploads.find(u => u.campo === 'url_xml_remessa')?.url || null;

      const { data: userData } = await supabase.auth.getUser();

      const { data: novaRemessa, error: errRemessa } = await supabase
        .from("estoque_remessas")
        .insert({
          produto_id: produtoId,
          armazem_id: armazemData.id,
          quantidade_original: qtdNum,
          url_nota_remessa: urlNotaRemessa,
          url_xml_remessa: urlXmlRemessa,
          numero_remessa: numeroRemessa.trim() || null,
          observacoes: observacoesRemessa.trim() || null,
          created_by: userData.user?.id
        })
        .select('id')
        .single();

      if (errRemessa) {
        toast({ variant: "destructive", title: "Erro ao registrar remessa", description: errRemessa.message });
        return;
      }

      console.log("✅ [SUCCESS] Remessa criada:", novaRemessa.id);

      const { data: estoqueAtual, error: errBuscaEstoque } = await supabase
        .from("estoque")
        .select("id, quantidade")
        .eq("produto_id", produtoId)
        .eq("armazem_id", armazemData.id)
        .maybeSingle();

      if (errBuscaEstoque) {
        toast({ variant: "destructive", title: "Erro ao buscar estoque", description: errBuscaEstoque.message });
        return;
      }

      const estoqueAnterior = estoqueAtual?.quantidade || 0;
      const novaQuantidade = estoqueAnterior + qtdNum;

      if (estoqueAtual?.id) {
        const { error: errEstoque } = await supabase
          .from("estoque")
          .update({
            quantidade: novaQuantidade,
            updated_by: userData.user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", estoqueAtual.id);

        if (errEstoque) {
          toast({ variant: "destructive", title: "Erro ao atualizar estoque", description: errEstoque.message });
          return;
        }
      } else {
        const { error: errEstoque } = await supabase
          .from("estoque")
          .insert({
            produto_id: produtoId,
            armazem_id: armazemData.id,
            quantidade: novaQuantidade,
            updated_by: userData.user?.id,
            updated_at: new Date().toISOString(),
          });

        if (errEstoque) {
          let msg = errEstoque.message || "";
          if (msg.includes("stack depth limit")) {
            msg = "Erro interno no banco de dados. Produto ou armazém inexistente, ou existe trigger/FK inconsistente.";
          }
          toast({ variant: "destructive", title: "Erro ao criar estoque", description: msg });
          return;
        }
      }

      markAsSaved(); // ✅ Marcar como salvo ANTES de resetar

      toast({
        title: "Entrada registrada com sucesso!",
        description: `+${qtdNum}${unidade} de ${produtoSelecionado.nome} em ${armazemData.cidade}/${armazemData.estado}. Estoque atual: ${novaQuantidade}${unidade}. Documentos anexados.`
      });

      resetFormNovoProduto();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Erro inesperado",
        description: err instanceof Error ? err.message : String(err)
      });
      console.error("❌ [ERROR]", err);
    } finally {
      setIsCreating(false);
    }
  };

  const produtosAtivos = produtosCadastrados?.filter(p => p.ativo) || [];
  const armazensDisponiveis = armazensAtivos || [];
  
  const temProdutosDisponiveis = produtosAtivos.length > 0;
  const temArmazensDisponiveis = armazensDisponiveis.length > 0;

  const renderInterfaceSimplificada = () => {
    if (!currentArmazem) {
      return (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Carregando informações do armazém...
          </p>
        </div>
      );
    }
  
    const armazem = filteredArmazens[0];
    
    if (!armazem || armazem.produtos.length === 0) {
      return (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? "Nenhum produto encontrado com os filtros aplicados"
              : "Nenhum produto em estoque encontrado"}
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
      );
    }
  
    return (
      <div className="grid gap-3">
        {armazem.produtos.map((produto) => (
          <Card 
            key={produto.id} 
            className="transition-all hover:shadow-md cursor-pointer"
            onClick={() => navigate(`/estoque/${produto.produto_id}/${currentArmazem.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base md:text-lg leading-tight">{produto.produto}</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                    <span className="text-xl sm:text-2xl font-bold text-primary">
                      {produto.quantidade.toLocaleString('pt-BR')} {produto.unidade}
                    </span>
                    <Badge variant={produto.status === "baixo" ? "destructive" : "secondary"}>
                      {produto.status === "baixo" ? "Estoque Baixo" : "Normal"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Última atualização: {produto.data}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader title="Controle de Estoque" subtitle="Carregando..." icon={Package} actions={<></>} />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando estoque...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader title="Controle de Estoque" subtitle="Erro ao carregar dados" icon={Package} actions={<></>} />
        <div className="text-center">
          <p className="text-destructive">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
      
      {/* ✅ Componente de alerta */}
      <UnsavedChangesAlert 
        open={showAlert}
        onConfirm={confirmClose}
        onCancel={cancelClose}
      />

      <PageHeader
        title="Controle de Estoque"
        subtitle={
          userRole === "armazem" && currentArmazem
            ? `Estoque do ${currentArmazem.nome} - ${currentArmazem.cidade}/${currentArmazem.estado}`
            : "Gerencie o estoque de produtos por armazém"
        }
        icon={Package}
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
                  Entrada de Estoque
                </Button>
              </DialogTrigger>
              
              {/* Modal de Entrada de Estoque - Mobile Otimizado */}
              <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
                <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
                  <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Registrar Entrada de Estoque</DialogTitle>
                </DialogHeader>
                
                <div className="py-4 px-1 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="produto" className="text-sm font-medium">Produto *</Label>
                      {temProdutosDisponiveis ? (
                        <Select
                          value={novoProduto.produtoId}
                          onValueChange={id => {
                            setNovoProduto(s => ({ ...s, produtoId: id }));
                            markAsChanged(); // ✅ Marcar como alterado
                          }}
                          disabled={isCreating}
                        >
                          <SelectTrigger id="produto" className="min-h-[44px] max-md:min-h-[44px]">
                            <SelectValue placeholder="Selecione o produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {produtosAtivos.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome} ({p.unidade})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <EmptyStateCard
                          title="Nenhum produto cadastrado"
                          description="Para registrar estoque, você precisa cadastrar produtos primeiro."
                          actionText="Cadastrar Produto"
                          actionUrl="https://logi-sys-shiy.vercel.app/produtos?modal=novo"
                        />
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="armazem" className="text-sm font-medium">Armazém *</Label>
                      {temArmazensDisponiveis ? (
                        <Select 
                          value={novoProduto.armazem} 
                          onValueChange={(v) => {
                            setNovoProduto((s) => ({ ...s, armazem: v }));
                            markAsChanged(); // ✅ Marcar como alterado
                          }}
                          disabled={isCreating}
                        >
                          <SelectTrigger id="armazem" className="min-h-[44px] max-md:min-h-[44px]">
                            <SelectValue placeholder="Selecione o armazém" />
                          </SelectTrigger>
                          <SelectContent>
                            {armazensDisponiveis.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                <span className="break-words">{a.nome} — {a.cidade}{a.estado ? `/${a.estado}` : ""}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <EmptyStateCard
                          title="Nenhum armazém cadastrado"
                          description="Para registrar estoque, você precisa cadastrar armazéns primeiro."
                          actionText="Cadastrar Armazém"
                          actionUrl="https://logi-sys-shiy.vercel.app/armazens?modal=novo"
                        />
                      )}
                    </div>
                    
                    {temProdutosDisponiveis && temArmazensDisponiveis && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="quantidade" className="text-sm font-medium">Quantidade a adicionar *</Label>
                            <Input
                              id="quantidade"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Ex: 20500.50"
                              value={novoProduto.quantidade}
                              onChange={(e) => {
                                setNovoProduto((s) => ({ ...s, quantidade: e.target.value }));
                                markAsChanged(); // ✅ Marcar como alterado
                              }}
                              disabled={isCreating}
                              className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="unidade" className="text-sm font-medium">Unidade</Label>
                            <Select 
                              value={novoProduto.unidade} 
                              onValueChange={(v) => {
                                setNovoProduto((s) => ({ ...s, unidade: v as Unidade }));
                                markAsChanged(); // ✅ Marcar como alterado
                              }}
                              disabled={isCreating}
                            >
                              <SelectTrigger id="unidade" className="min-h-[44px] max-md:min-h-[44px]">
                                <SelectValue placeholder="Selecione a unidade" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="t">Toneladas (t)</SelectItem>
                                <SelectItem value="kg">Quilos (kg)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="numero-remessa" className="text-sm font-medium">Número da Remessa</Label>
                            <Input
                              id="numero-remessa"
                              type="text"
                              placeholder="Ex: REM-001"
                              value={numeroRemessa}
                              onChange={(e) => {
                                setNumeroRemessa(e.target.value);
                                markAsChanged(); // ✅ Marcar como alterado
                              }}
                              disabled={isCreating}
                              className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                            />
                          </div>
                          <div className="lg:col-span-2 space-y-2">
                            <Label htmlFor="observacoes" className="text-sm font-medium">Observações</Label>
                            <Input
                              id="observacoes"
                              type="text"
                              placeholder="Observações sobre esta remessa..."
                              value={observacoesRemessa}
                              onChange={(e) => {
                                setObservacoesRemessa(e.target.value);
                                markAsChanged(); // ✅ Marcar como alterado
                              }}
                              disabled={isCreating}
                              className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                            />
                          </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold text-base">Documentos Obrigatórios</h3>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor="nota-remessa" className="flex items-center gap-2 text-sm font-medium">
                                <FileText className="h-4 w-4" />
                                Nota de Remessa (PDF) *
                              </Label>
                              <div className="flex flex-col gap-2">
                                <Input
                                  id="nota-remessa"
                                  type="file"
                                  accept=".pdf"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    handleFileChange(
                                      file,
                                      ['application/pdf'],
                                      ['.pdf'],
                                      setNotaRemessaFile,
                                      e.target
                                    );
                                  }}
                                  className="min-h-[44px] max-md:min-h-[44px]"
                                  disabled={isCreating}
                                />
                                {notaRemessaFile && (
                                  <Badge variant="secondary" className="text-xs break-all self-start">
                                    ✓ {notaRemessaFile.name}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="xml-remessa" className="flex items-center gap-2 text-sm font-medium">
                                <FileText className="h-4 w-4" />
                                Arquivo XML da Remessa *
                              </Label>
                              <div className="flex flex-col gap-2">
                                <Input
                                  id="xml-remessa"
                                  type="file"
                                  accept=".xml"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    handleFileChange(
                                      file,
                                      ['application/xml', 'text/xml'],
                                      ['.xml'],
                                      setXmlRemessaFile,
                                      e.target
                                    );
                                  }}
                                  className="min-h-[44px] max-md:min-h-[44px]"
                                  disabled={isCreating}
                                />
                                {xmlRemessaFile && (
                                  <Badge variant="secondary" className="text-xs break-all self-start">
                                    ✓ {xmlRemessaFile.name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      * Campos obrigatórios
                    </p>
                  </div>

                  {/* Botões no final do conteúdo */}
                  <ModalFooter 
                    variant="double"
                    onClose={() => handleCloseModal()}
                    onConfirm={handleCreateProduto}
                    confirmText="Salvar"
                    isLoading={isCreating}
                    disabled={
                      !temProdutosDisponiveis || 
                      !temArmazensDisponiveis || 
                      !notaRemessaFile || 
                      !xmlRemessaFile || 
                      isCreating
                    }
                  />
                </div>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {userRole === "armazem" ? (
        <>
          {/* Barra de filtros simplificada para armazém - Mobile otimizada */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Input
                className="h-9 flex-1 min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                placeholder="Buscar produto..."
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

          {/* Filtros simplificados para armazém - Mobile otimizado */}
          {filtersOpen && (
            <div className="rounded-md border p-3 space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Produtos</Label>
                <div className="flex flex-wrap gap-2">
                  {produtosUnicos.map((p) => (
                    <Badge
                      key={p}
                      onClick={() => setSelectedProdutos((prev) =>
                        prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                      )}
                      className={`cursor-pointer text-xs px-2 py-1 min-h-[32px] ${selectedProdutos.includes(p) ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block">Status de estoque</Label>
                <div className="flex flex-wrap gap-2">
                  {["normal", "baixo"].map((st) => {
                    const active = selectedStatuses.includes(st as StockStatus);
                    return (
                      <Badge
                        key={st}
                        onClick={() => setSelectedStatuses((prev) => (
                          prev.includes(st as StockStatus)
                            ? prev.filter(s => s !== st)
                            : [...prev, st as StockStatus]
                        ))}
                        className={`cursor-pointer text-xs px-2 py-1 min-h-[32px] ${active ? "bg-gradient-primary text-white" : "bg-muted text-muted-foreground"}`}
                      >
                        {st === "normal" ? "Normal" : "Baixo"}
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

          {/* Interface simplificada */}
          {renderInterfaceSimplificada()}
        </>
      ) : (
        <>
          {/* Barra de filtros completa para admin/logística - Mobile otimizada */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Input
                className="h-9 flex-1 min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                placeholder="Buscar por armazém ou produto..."
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

          {/* Filtros completos - Mobile otimizado */}
          {filtersOpen && (
            <div className="rounded-md border p-3 space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Produtos</Label>
                <div className="flex flex-wrap gap-2">
                  {produtosUnicos.map((p) => (
                    <Badge
                      key={p}
                      onClick={() => setSelectedProdutos((prev) =>
                        prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                      )}
                      className={`cursor-pointer text-xs px-2 py-1 min-h-[32px] ${selectedProdutos.includes(p) ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block">Armazéns</Label>
                <div className="flex flex-wrap gap-2">
                  {armazensUnicos.map((a) => (
                    <Badge
                      key={a.id}
                      onClick={() => setSelectedWarehouses((prev) =>
                        prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                      )}
                      className={`cursor-pointer text-xs px-2 py-1 min-h-[32px] break-words ${selectedWarehouses.includes(a.id) ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      {a.nome} — {a.cidade}{a.estado ? `/${a.estado}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block">Status de estoque</Label>
                <div className="flex flex-wrap gap-2">
                  {["normal", "baixo"].map((st) => {
                    const active = selectedStatuses.includes(st as StockStatus);
                    return (
                      <Badge
                        key={st}
                        onClick={() => setSelectedStatuses((prev) => (
                          prev.includes(st as StockStatus)
                            ? prev.filter(s => s !== st)
                            : [...prev, st as StockStatus]
                        ))}
                        className={`cursor-pointer text-xs px-2 py-1 min-h-[32px] ${active ? "bg-gradient-primary text-white" : "bg-muted text-muted-foreground"}`}
                      >
                        {st === "normal" ? "Normal" : "Baixo"}
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

          {/* Interface completa com cards expansíveis - Mobile otimizada */}
          <div className="flex flex-col gap-4">
            {filteredArmazens.map((armazem) => (
              <div key={armazem.id}>
                <Card
                  className={`w-full transition-all hover:shadow-md cursor-pointer flex flex-col ${openArmazemId === armazem.id ? "border-primary" : ""}`}
                >
                  <CardContent
                    className="px-4 md:px-5 py-3 flex flex-row items-center"
                    onClick={() =>
                      setOpenArmazemId(openArmazemId === armazem.id ? null : armazem.id)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary mr-3 md:mr-4 shrink-0">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base md:text-lg break-words">{armazem.nome}</h3>
                      <p className="text-xs text-muted-foreground break-words">
                        {armazem.cidade}{armazem.estado ? `/${armazem.estado}` : ""}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {armazem.produtos.length} produto{armazem.produtos.length !== 1 && 's'}
                      </span>
                      {armazem.capacidade_total != null && (
                        <div className="text-xs text-muted-foreground">Capacidade: {armazem.capacidade_total}t</div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" tabIndex={-1} className="pointer-events-none ml-2 md:ml-4 min-h-[44px] max-md:min-h-[44px]">
                      {openArmazemId === armazem.id ? <ChevronUp /> : <ChevronDown />}
                    </Button>
                  </CardContent>
                  {openArmazemId === armazem.id && (
                    <div className="border-t py-3 px-4 md:px-5 bg-muted/50 flex flex-col gap-3">
                      {armazem.produtos.length > 0 ? (
                        armazem.produtos.map((produto) => (
                          <Card 
                            key={produto.id} 
                            className="w-full flex flex-col sm:flex-row items-start sm:items-center bg-muted/30 p-3 cursor-pointer hover:bg-muted/50 transition-all" 
                            onClick={() => navigate(`/estoque/${produto.produto_id}/${armazem.id}`)}
                          >
                            <CardContent className="w-full p-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                  <span className="font-medium break-words">{produto.produto}</span>
                                  <span className="font-mono text-sm text-primary font-bold">{produto.quantidade} {produto.unidade}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 text-xs text-muted-foreground sm:items-center mt-1">
                                  <span>{produto.data}</span>
                                  <Badge variant={produto.status === "baixo" ? "destructive" : "secondary"} className="self-start sm:self-auto">
                                    {produto.status === "baixo" ? "Baixo" : "Normal"}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center text-xs text-muted-foreground py-6">
                          Nenhum produto ativo cadastrado neste armazém
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            ))}
            {filteredArmazens.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {hasActiveFilters
                    ? "Nenhum armazém encontrado com os filtros aplicados"
                    : "Nenhum estoque cadastrado ainda"}
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
        </>
      )}
    </div>
  );
};

export default Estoque;
