import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // 🆕 NAVEGAÇÃO ADICIONADA
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, X, Filter as FilterIcon, ChevronDown, ChevronUp, AlertCircle, ExternalLink, Loader2, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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

const Estoque = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole, userRole, user } = useAuth();
  const navigate = useNavigate(); // 🆕 HOOK DE NAVEGAÇÃO

  // 🎯 CONTROLE DE PERMISSÕES BASEADO NO ROLE
  const canCreate = hasRole("admin") || hasRole("logistica");

  // Estados de loading
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});

  // Estados para documentos
  const [notaRemessaFile, setNotaRemessaFile] = useState<File | null>(null);
  const [xmlRemessaFile, setXmlRemessaFile] = useState<File | null>(null);
  const [numeroRemessa, setNumeroRemessa] = useState("");
  const [observacoesRemessa, setObservacoesRemessa] = useState("");

  // 🔍 DEBUG LOGS - Estoque.tsx
  console.log("🔍 [DEBUG] Estoque.tsx - Renderização iniciada");
  console.log("🔍 [DEBUG] Estoque.tsx - userRole:", userRole);
  console.log("🔍 [DEBUG] Estoque.tsx - user?.id:", user?.id);

  // 🆕 BUSCAR ARMAZÉM DO USUÁRIO LOGADO (OTIMIZADO)
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
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 10 * 60 * 1000, // 10 minutos
  });

  console.log("🔍 [DEBUG] Estoque.tsx - currentArmazem:", currentArmazem);

  // 🔄 QUERY PRINCIPAL MODIFICADA PARA FILTRAR POR PERFIL (OTIMIZADA)
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

      // 🎯 FILTRAR POR ARMAZÉM PARA USUÁRIO ARMAZÉM
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
    staleTime: 2 * 60 * 1000, // 2 minutos
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
    staleTime: 5 * 60 * 1000, // 5 minutos
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
    staleTime: 5 * 60 * 1000, // 5 minutos
    enabled: canCreate && !!user?.id,
  });

  // 🆕 QUERY PARA FILTROS ADAPTADA POR PERFIL (OTIMIZADA)
  const { data: armazensParaFiltro } = useQuery({
    queryKey: ["armazens-filtro", currentArmazem?.id],
    queryFn: async () => {
      // Para usuário armazém, retorna apenas seu armazém
      if (userRole === "armazem" && currentArmazem) {
        return [currentArmazem];
      }
      
      // Para admin/logística, retorna todos
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
    staleTime: 3 * 60 * 1000, // 3 minutos
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");

  const [selectedStatuses, setSelectedStatuses] = useState<StockStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  const handleUpdateQuantity = async (produtoId: string, newQtyStr: string) => {
    const newQty = Number(newQtyStr);
    if (Number.isNaN(newQty) || newQty < 0 || newQtyStr.trim() === "" || !/^\d+(\.\d+)?$/.test(newQtyStr.trim())) {
      toast({ variant: "destructive", title: "Valor inválido", description: "Digite um valor numérico maior ou igual a zero." });
      return;
    }

    setIsUpdating(prev => ({ ...prev, [produtoId]: true }));

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("estoque")
        .update({
          quantidade: newQty,
          updated_at: new Date().toISOString(),
          updated_by: userData.user?.id,
        })
        .eq("id", produtoId);

      if (error) {
        toast({ variant: "destructive", title: "Erro ao atualizar estoque", description: error.message });
        return;
      }

      toast({ title: "Quantidade atualizada com sucesso!" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Erro inesperado ao atualizar",
        description: err instanceof Error ? err.message : String(err)
      });
      console.error("❌ [ERROR]", err);
    } finally {
      setIsUpdating(prev => ({ ...prev, [produtoId]: false }));
    }
  };

  const showingCount = filteredArmazens.reduce((acc, armazem) => acc + armazem.produtos.length, 0);
  const totalCount = estoquePorArmazem.reduce((acc, armazem) => acc + armazem.produtos.length, 0);

  const activeAdvancedCount =
    (selectedProdutos.length ? 1 : 0) +
    (selectedWarehouses.length && userRole !== "armazem" ? 1 : 0) + // Não conta filtro de armazém para usuário armazém
    (selectedStatuses.length ? 1 : 0) +
    ((dateFrom || dateTo) ? 1 : 0);

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
  };

  // Função melhorada para validação de arquivo
  const handleFileChange = (
    file: File | null, 
    allowedTypes: string[], 
    allowedExtensions: string[], 
    setterFunction: (file: File | null) => void,
    inputElement: HTMLInputElement
  ) => {
    if (!file) {
      setterFunction(null);
      return;
    }

    // Verificar extensão do arquivo
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isValidExtension = allowedExtensions.includes(`.${fileExtension}`);
    
    // Verificar tipo MIME
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
  };

  // Função para upload de documentos
  const uploadDocumentos = async (produtoId: string, armazemId: string) => {
    const uploads = [];
    
    // Upload da nota de remessa (PDF)
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

    // Upload do XML
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

  // Função de criação modificada para trabalhar com remessas
  const handleCreateProduto = async () => {
    const { produtoId, armazem, quantidade, unidade } = novoProduto;
    const qtdNum = Number(quantidade);

    if (!produtoId || !armazem.trim() || !quantidade) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }

    // Validação de documentos obrigatórios
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

      // Fazer upload dos documentos primeiro
      console.log("🔍 [DEBUG] Fazendo upload dos documentos...");
      const uploads = await uploadDocumentos(produtoId, armazemData.id);

      // Preparar URLs dos documentos
      const urlNotaRemessa = uploads.find(u => u.campo === 'url_nota_remessa')?.url || null;
      const urlXmlRemessa = uploads.find(u => u.campo === 'url_xml_remessa')?.url || null;

      const { data: userData } = await supabase.auth.getUser();

      // Criar registro na tabela estoque_remessas
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

      // Atualizar/criar estoque total
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
        // Atualizar estoque existente
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
        // Criar novo registro de estoque
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

  // Verificar se há produtos e armazéns ativos disponíveis
  const produtosAtivos = produtosCadastrados?.filter(p => p.ativo) || [];
  const armazensDisponiveis = armazensAtivos || [];
  
  const temProdutosDisponiveis = produtosAtivos.length > 0;
  const temArmazensDisponiveis = armazensDisponiveis.length > 0;

  // 🆕 RENDERIZAÇÃO CONDICIONAL PARA INTERFACE SIMPLIFICADA (ARMAZÉM) - COM NAVEGAÇÃO
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
  
    const armazem = filteredArmazens[0]; // Só há um armazém para usuário armazém
    
    if (!armazem || armazem.produtos.length === 0) {
      return (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Nenhum produto em estoque encontrado
          </p>
        </div>
      );
    }
  
    // 🎯 APENAS LISTA DE PRODUTOS (SEM CARD DO ARMAZÉM) - COM NAVEGAÇÃO
    return (
      <div className="grid gap-3">
        {armazem.produtos.map((produto) => (
          <Card 
            key={produto.id} 
            className="transition-all hover:shadow-md cursor-pointer"
            onClick={() => navigate(`/estoque/${produto.produto_id}/${currentArmazem.id}`)} // 🆕 NAVEGAÇÃO ADICIONADA
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{produto.produto}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-2xl font-bold text-primary">
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
      <div className="min-h-screen bg-background p-6 space-y-6">
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
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader title="Controle de Estoque" subtitle="Erro ao carregar dados" icon={Package} actions={<></>} />
        <div className="text-center">
          <p className="text-destructive">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
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
              if (!open && isCreating) return;
              setDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  Entrada de Estoque
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Registrar Entrada de Estoque</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="produto">Produto *</Label>
                    {temProdutosDisponiveis ? (
                      <Select
                        value={novoProduto.produtoId}
                        onValueChange={id => setNovoProduto(s => ({ ...s, produtoId: id }))}
                        disabled={isCreating}
                      >
                        <SelectTrigger id="produto">
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
                    <Label htmlFor="armazem">Armazém *</Label>
                    {temArmazensDisponiveis ? (
                      <Select 
                        value={novoProduto.armazem} 
                        onValueChange={(v) => setNovoProduto((s) => ({ ...s, armazem: v }))}
                        disabled={isCreating}
                      >
                        <SelectTrigger id="armazem">
                          <SelectValue placeholder="Selecione o armazém" />
                        </SelectTrigger>
                        <SelectContent>
                          {armazensDisponiveis.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.nome} — {a.cidade}{a.estado ? `/${a.estado}` : ""}
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
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="quantidade">Quantidade a adicionar *</Label>
                          <Input
                            id="quantidade"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ex: 20500.50"
                            value={novoProduto.quantidade}
                            onChange={(e) => setNovoProduto((s) => ({ ...s, quantidade: e.target.value }))}
                            style={{ width: "120px", maxWidth: "100%" }}
                            disabled={isCreating}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="unidade">Unidade</Label>
                          <Select 
                            value={novoProduto.unidade} 
                            onValueChange={(v) => setNovoProduto((s) => ({ ...s, unidade: v as Unidade }))}
                            disabled={isCreating}
                          >
                            <SelectTrigger id="unidade"><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="t">Toneladas (t)</SelectItem>
                              <SelectItem value="kg">Quilos (kg)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Campos adicionais da remessa - layout responsivo */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="numero-remessa">Número da Remessa</Label>
                          <Input
                            id="numero-remessa"
                            type="text"
                            placeholder="Ex: REM-001"
                            value={numeroRemessa}
                            onChange={(e) => setNumeroRemessa(e.target.value)}
                            disabled={isCreating}
                            className="w-full"
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="observacoes">Observações</Label>
                          <Input
                            id="observacoes"
                            type="text"
                            placeholder="Observações sobre esta remessa..."
                            value={observacoesRemessa}
                            onChange={(e) => setObservacoesRemessa(e.target.value)}
                            disabled={isCreating}
                          />
                        </div>
                      </div>

                      {/* Seção de documentos obrigatórios */}
                      <div className="border-t pt-4 space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-base">Documentos Obrigatórios</h3>
                        </div>

                        <div className="space-y-3">
                          {/* Upload da Nota de Remessa */}
                          <div className="space-y-2">
                            <Label htmlFor="nota-remessa" className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Nota de Remessa (PDF) *
                            </Label>
                            <div className="flex items-center gap-2">
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
                                className="flex-1"
                                disabled={isCreating}
                              />
                              {notaRemessaFile && (
                                <Badge variant="secondary" className="text-xs">
                                  ✓ {notaRemessaFile.name}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Upload do XML */}
                          <div className="space-y-2">
                            <Label htmlFor="xml-remessa" className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Arquivo XML da Remessa *
                            </Label>
                            <div className="flex items-center gap-2">
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
                                className="flex-1"
                                disabled={isCreating}
                              />
                              {xmlRemessaFile && (
                                <Badge variant="secondary" className="text-xs">
                                  ✓ {xmlRemessaFile.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Legenda simples para campos obrigatórios */}
                  <p className="text-xs text-muted-foreground">
                    * Campos obrigatórios
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
                    onClick={handleCreateProduto}
                    disabled={
                      !temProdutosDisponiveis || 
                      !temArmazensDisponiveis || 
                      !notaRemessaFile || 
                      !xmlRemessaFile || 
                      isCreating
                    }
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* 🎯 INTERFACE CONDICIONAL: SIMPLIFICADA PARA ARMAZÉM, COMPLETA PARA ADMIN/LOGÍSTICA */}
      {userRole === "armazem" ? (
        <>
          {/* Busca simples para armazém */}
          <div className="flex items-center gap-3">
            <Input
              className="h-9 flex-1"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Mostrando <span className="font-medium">{showingCount}</span> de <span className="font-medium">{totalCount}</span>
            </span>
          </div>

          {/* Filtros simplificados para armazém */}
          {filtersOpen && (
            <div className="rounded-md border p-3 space-y-2 relative">
              <div>
                <Label className="text-sm mb-1">Produtos</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {produtosUnicos.map((p) => (
                    <Badge
                      key={p}
                      onClick={() => setSelectedProdutos((prev) =>
                        prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                      )}
                      className={`cursor-pointer text-xs px-2 py-1 ${selectedProdutos.includes(p) ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-sm mb-1">Status de estoque</Label>
                <div className="flex flex-wrap gap-2 mt-1">
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
                        className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-muted-foreground"}`}
                      >
                        {st === "normal" ? "Normal" : "Baixo"}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex gap-4 items-center">
                <Label>Período</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[160px]" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[160px]" />
              </div>
              <div className="flex justify-end mt-4 absolute right-4 bottom-4">
                <Button variant="ghost" size="sm" onClick={() => {
                  setSearch("");
                  setSelectedProdutos([]);
                  setSelectedStatuses([]);
                  setDateFrom("");
                  setDateTo("");
                }}>
                  <X className="h-4 w-4" /> Limpar Filtros
                </Button>
              </div>
            </div>
          )}

          {/* Interface simplificada */}
          {renderInterfaceSimplificada()}
        </>
      ) : (
        <>
          {/* Interface completa para admin/logística */}
          <div className="flex items-center gap-3">
            <Input
              className="h-9 flex-1"
              placeholder="Buscar por armazém ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Mostrando <span className="font-medium">{showingCount}</span> de <span className="font-medium">{totalCount}</span>
            </span>
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => setFiltersOpen((v) => !v)}>
              <FilterIcon className="h-4 w-4 mr-1" />
              Filtros {activeAdvancedCount ? `(${activeAdvancedCount})` : ""}
              {filtersOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
          </div>

          {filtersOpen && (
            <div className="rounded-md border p-3 space-y-2 relative">
              <div>
                <Label className="text-sm mb-1">Produtos</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {produtosUnicos.map((p) => (
                    <Badge
                      key={p}
                      onClick={() => setSelectedProdutos((prev) =>
                        prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                      )}
                      className={`cursor-pointer text-xs px-2 py-1 ${selectedProdutos.includes(p) ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-sm mb-1">Armazéns</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {armazensUnicos.map((a) => (
                    <Badge
                      key={a.id}
                      onClick={() => setSelectedWarehouses((prev) =>
                        prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                      )}
                      className={`cursor-pointer text-xs px-2 py-1 ${selectedWarehouses.includes(a.id) ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      {a.nome} — {a.cidade}{a.estado ? `/${a.estado}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-sm mb-1">Status de estoque</Label>
                <div className="flex flex-wrap gap-2 mt-1">
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
                        className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-muted-foreground"}`}
                      >
                        {st === "normal" ? "Normal" : "Baixo"}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex gap-4 items-center">
                <Label>Período</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[160px]" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[160px]" />
              </div>
              <div className="flex justify-end mt-4 absolute right-4 bottom-4">
                <Button variant="ghost" size="sm" onClick={() => {
                  setSearch("");
                  setSelectedProdutos([]);
                  setSelectedWarehouses([]);
                  setSelectedStatuses([]);
                  setDateFrom("");
                  setDateTo("");
                }}>
                  <X className="h-4 w-4" /> Limpar Filtros
                </Button>
              </div>
            </div>
          )}

          {/* Interface completa com cards expansíveis - COM NAVEGAÇÃO */}
          <div className="flex flex-col gap-4">
            {filteredArmazens.map((armazem) => (
              <div key={armazem.id}>
                <Card
                  className={`w-full transition-all hover:shadow-md cursor-pointer flex flex-col ${openArmazemId === armazem.id ? "border-primary" : ""}`}
                >
                  <CardContent
                    className="px-5 py-3 flex flex-row items-center"
                    onClick={() =>
                      setOpenArmazemId(openArmazemId === armazem.id ? null : armazem.id)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary mr-4 shrink-0">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{armazem.nome}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {armazem.cidade}{armazem.estado ? `/${armazem.estado}` : ""}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {armazem.produtos.length} produto{armazem.produtos.length !== 1 && 's'} atualmente
                      </span>
                      {armazem.capacidade_total != null && (
                        <div className="text-xs text-muted-foreground">Capacidade: {armazem.capacidade_total}t</div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" tabIndex={-1} className="pointer-events-none ml-4">
                      {openArmazemId === armazem.id ? <ChevronUp /> : <ChevronDown />}
                    </Button>
                  </CardContent>
                  {openArmazemId === armazem.id && (
                    <div className="border-t py-3 px-5 bg-muted/50 flex flex-col gap-3">
                      {armazem.produtos.length > 0 ? (
                        armazem.produtos.map((produto) => (
                          <Card 
                            key={produto.id} 
                            className="w-full flex flex-row items-center bg-muted/30 px-3 py-2 cursor-pointer hover:bg-muted/50" 
                            style={{ minHeight: 56 }}
                            onClick={() => navigate(`/estoque/${produto.produto_id}/${armazem.id}`)} // 🆕 NAVEGAÇÃO ADICIONADA
                          >
                            <CardContent className="w-full py-2 flex flex-row items-center justify-between gap-4">
                              <div>
                                <span className="font-medium">{produto.produto}</span>
                                <span className="ml-2 font-mono text-xs">{produto.quantidade} {produto.unidade}</span>
                                <div className="flex gap-2 text-xs text-muted-foreground items-center">
                                  <span>{produto.data}</span>
                                  <Badge variant={produto.status === "baixo" ? "destructive" : "secondary"}>
                                    {produto.status === "baixo" ? "Baixo" : "Normal"}
                                  </Badge>
                                </div>
                              </div>
                              {editingId === produto.id ? (
                                <div className="flex gap-1 ml-auto">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    size="sm"
                                    value={editQuantity}
                                    onChange={(e) => setEditQuantity(e.target.value)}
                                    style={{ width: "110px", minWidth: "100px" }}
                                    className="h-8"
                                    onClick={e => e.stopPropagation()}
                                    disabled={isUpdating[produto.id]}
                                  />
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleUpdateQuantity(produto.id, editQuantity);
                                    }}
                                    disabled={isUpdating[produto.id]}
                                  >
                                    {isUpdating[produto.id] ? (
                                      <>
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        Salvando...
                                      </>
                                    ) : (
                                      "Salvar"
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setEditingId(null);
                                    }}
                                    disabled={isUpdating[produto.id]}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingId(produto.id);
                                    setEditQuantity(produto.quantidade.toString());
                                  }}
                                  disabled={!canCreate} // Só admin/logística pode editar
                                  className="ml-auto"
                                >
                                  Atualizar quantidade
                                </Button>
                              )}
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
              <div className="text-sm text-muted-foreground py-8 text-center">
                Nenhum armazém encontrado com os filtros atuais.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Estoque;
