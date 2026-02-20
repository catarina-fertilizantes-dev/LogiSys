import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag, Plus, Filter as FilterIcon, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { ModalFooter } from "@/components/ui/modal-footer";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesAlert } from "@/components/UnsavedChangesAlert";

type Produto = Database['public']['Tables']['produtos']['Row'];
type Unidade = "t" | "kg" | "";

const unidadeLabels: Record<string, string> = {
  t: "Toneladas (t)",
  kg: "Quilos (kg)",
};

const Produtos = () => {
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
  const { hasRole } = useAuth();

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cadastro produto
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({
    nome: "",
    unidade: "" as Unidade,
  });

  const [detalhesProduto, setDetalhesProduto] = useState<Produto | null>(null);

  const [filterStatus, setFilterStatus] = useState<"all" | "ativo" | "inativo">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState<Record<string, boolean>>({});

  const resetForm = () => {
    setNovoProduto({ nome: "", unidade: "" });
    resetUnsavedChanges(); // ✅ Limpar estado de mudanças
  };

  // ✅ Função para fechar modal com verificação
  const handleCloseModal = () => {
    handleClose(() => {
      setDialogOpen(false);
      resetForm(); // ✅ Limpar dados ao fechar
    });
  };

  // Fetch produtos
  const fetchProdutos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .order("nome", { ascending: true });
      if (error) {
        setError(error.message);
        toast({
          variant: "destructive",
          title: "Erro ao carregar produtos",
          description: "Não foi possível carregar a lista de produtos.",
        });
        setLoading(false);
        return;
      }
      setProdutos(data as Produto[]);
      setLoading(false);
    } catch (err) {
      setError("Erro desconhecido");
      toast({
        variant: "destructive",
        title: "Erro ao carregar produtos",
        description: "Erro inesperado ao carregar produtos.",
      });
      setLoading(false);
    }
  };

  const canCreate = hasRole("logistica") || hasRole("admin");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [canCreate]);
  
  useEffect(() => {
    fetchProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateProduto = async () => {
    const { nome, unidade } = novoProduto;
    if (!nome.trim() || !unidade) {
      toast({
        variant: "destructive",
        title: "Preencha os campos obrigatórios",
      });
      return;
    }

    setIsCreating(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        toast({
          variant: "destructive",
          title: "Erro de configuração",
          description: "Variáveis de ambiente do Supabase não configuradas.",
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: "destructive",
          title: "Não autenticado",
          description: "Sessão expirada. Faça login novamente.",
        });
        return;
      }

      const { error } = await supabase
        .from("produtos")
        .insert([{ nome: nome.trim(), unidade, ativo: true }]);
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao criar produto",
          description: error.message,
        });
        return;
      }

      markAsSaved(); // ✅ Marcar como salvo ANTES de resetar

      toast({
        title: "Produto criado com sucesso!",
        description: `${nome} foi adicionado ao sistema.`,
      });
      resetForm();
      setDialogOpen(false);
      fetchProdutos();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao criar produto",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleAtivo = async (id: string, ativoAtual: boolean) => {
    setIsTogglingStatus(prev => ({ ...prev, [id]: true }));

    try {
      const { error } = await supabase
        .from("produtos")
        .update({ ativo: !ativoAtual, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({
        title: `Produto ${!ativoAtual ? "ativado" : "desativado"} com sucesso!`,
      });
      fetchProdutos();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar status",
      });
    } finally {
      setIsTogglingStatus(prev => ({ ...prev, [id]: false }));
    }
  };

  const filteredProdutos = useMemo(() => {
    if (!produtos) return [];
    return produtos.filter((produto) => {
      if (filterStatus === "ativo" && !produto.ativo) return false;
      if (filterStatus === "inativo" && produto.ativo) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          produto.nome?.toLowerCase().includes(term) ||
          produto.unidade?.toLowerCase().includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }, [produtos, filterStatus, searchTerm]);
  
  const hasActiveFilters = searchTerm.trim() || filterStatus !== "all";

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader title="Produtos" subtitle="Carregando..." icon={Tag} actions={<></>} />
        <div className="flex justify-center items-center h-40">
          <div className="text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader title="Produtos" subtitle="Erro ao carregar dados" icon={Tag} actions={<></>} />
        <div className="flex justify-center items-center h-40">
          <div className="text-center">
            <p className="text-destructive">Erro ao carregar produtos</p>
          </div>
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
        title="Produtos"
        subtitle="Gerencie os produtos do sistema"
        icon={Tag}
        actions={
          canCreate && (
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
                  Novo Produto
                </Button>
              </DialogTrigger>
              
              {/* Modal de Criação com Botões Não-Fixos */}
              <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-md max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
                <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
                  <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Cadastrar Novo Produto</DialogTitle>
                </DialogHeader>
                
                <div className="py-4 px-1 space-y-6">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Preencha os dados do produto.
                    </p>
                    <div>
                      <Label htmlFor="nome" className="text-sm font-medium">Nome *</Label>
                      <Input
                        id="nome"
                        value={novoProduto.nome}
                        onChange={e => {
                          setNovoProduto({ ...novoProduto, nome: e.target.value });
                          markAsChanged(); // ✅ Marcar como alterado
                        }}
                        placeholder="Nome do produto"
                        disabled={isCreating}
                        className="min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unidade" className="text-sm font-medium">Unidade *</Label>
                      <Select
                        value={novoProduto.unidade}
                        onValueChange={value => {
                          setNovoProduto({ ...novoProduto, unidade: value as Unidade });
                          markAsChanged(); // ✅ Marcar como alterado
                        }}
                        disabled={isCreating}
                      >
                        <SelectTrigger id="unidade" className="min-h-[44px] max-md:min-h-[44px]">
                          <SelectValue placeholder="Selecione a unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="t">{unidadeLabels.t}</SelectItem>
                          <SelectItem value="kg">{unidadeLabels.kg}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Botões no final do conteúdo */}
                  <ModalFooter 
                    variant="double"
                    onClose={() => handleCloseModal()}
                    onConfirm={handleCreateProduto}
                    confirmText="Criar Produto"
                    confirmIcon={<Plus className="h-4 w-4" />}
                    isLoading={isCreating}
                  />
                </div>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {/* Filtros e busca - Otimizado para mobile */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="flex gap-2 items-center">
            <FilterIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as "all" | "ativo" | "inativo")}>
              <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] max-md:min-h-[44px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Buscar por nome ou unidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full md:max-w-md min-h-[44px] max-md:min-h-[44px] text-base max-md:text-base"
          />
        </div>
        {hasActiveFilters && (
          <Button 
            size="sm" 
            onClick={handleClearFilters}
            className="gap-1 self-start min-h-[44px] max-md:min-h-[44px] btn-secondary"
          >
            <X className="h-4 w-4" /> 
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Modal de detalhes com botões não-fixos */}
      <Dialog open={!!detalhesProduto} onOpenChange={open => !open && setDetalhesProduto(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-2xl max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto my-4 md:my-8">
          <DialogHeader className="pt-2 pb-3 border-b border-border pr-8">
            <DialogTitle className="text-lg md:text-xl pr-2 mt-1">Detalhes do Produto</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 px-1 space-y-6">
            <div className="space-y-4">
              {detalhesProduto && (
                <>
                  <p className="text-sm text-muted-foreground break-words">
                    {detalhesProduto?.nome}
                  </p>
                  {/* Informações Básicas - Layout responsivo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Unidade:</Label>
                      <p className="font-semibold text-sm md:text-base">{unidadeLabels[detalhesProduto.unidade || ""] || detalhesProduto.unidade}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status:</Label>
                      <div className="mt-1">
                        <Badge variant={detalhesProduto.ativo ? "default" : "secondary"}>
                          {detalhesProduto.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Criado em:</Label>
                      <p className="font-semibold text-sm md:text-base">{detalhesProduto.created_at ? new Date(detalhesProduto.created_at).toLocaleString('pt-BR') : "—"}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Botão no final do conteúdo */}
            <ModalFooter 
              variant="single"
              onClose={() => setDetalhesProduto(null)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista de produtos - Cards responsivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProdutos.map((produto) => (
          <Card
            key={produto.id}
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => setDetalhesProduto(produto)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base md:text-lg leading-tight break-words">{produto.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    Unidade: {unidadeLabels[produto.unidade] || produto.unidade}
                  </p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Criado em:</span>{" "}
                  {produto.created_at ? new Date(produto.created_at).toLocaleDateString('pt-BR') : "—"}
                </p>
              </div>
              {canCreate && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <Badge variant={produto.ativo ? "default" : "secondary"}>
                    {produto.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <div className="relative min-h-[44px] max-md:min-h-[44px] flex items-center">
                    <Switch
                      id={`switch-${produto.id}`}
                      checked={produto.ativo}
                      onCheckedChange={() => handleToggleAtivo(produto.id, produto.ativo)}
                      onClick={e => e.stopPropagation()}
                      disabled={isTogglingStatus[produto.id]}
                      className="data-[state=checked]:bg-primary"
                    />
                    {isTogglingStatus[produto.id] && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Estado vazio */}
      {filteredProdutos.length === 0 && (
        <div className="text-center py-12">
          <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? "Nenhum produto encontrado com os filtros aplicados"
              : "Nenhum produto cadastrado ainda"}
          </p>
          {hasActiveFilters && (
            <Button 
              size="sm" 
              onClick={handleClearFilters}
              className="mt-2 min-h-[44px] max-md:min-h-[44px] btn-secondary"
            >
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Produtos;
