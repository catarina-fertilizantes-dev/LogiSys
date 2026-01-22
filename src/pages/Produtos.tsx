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
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag, Plus, Filter as FilterIcon, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type Produto = Database['public']['Tables']['produtos']['Row'];
type Unidade = "t" | "kg" | "";

const unidadeLabels: Record<string, string> = {
  t: "Toneladas (t)",
  kg: "Quilos (kg)",
};

const Produtos = () => {
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

  // 🚀 NOVOS ESTADOS DE LOADING
  const [isCreating, setIsCreating] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState<Record<string, boolean>>({});

  const resetForm = () => {
    setNovoProduto({ nome: "", unidade: "" });
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

  useEffect(() => {
    // Detectar se deve abrir o modal automaticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'novo' && canCreate) {
      setDialogOpen(true);
      // Limpar o parâmetro da URL sem recarregar a página
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  
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

    // 🚀 ATIVAR LOADING STATE
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

      // Aqui pode haver uma Function personalizada como no cadastro de clientes,
      // mas se for direto na tabela, use o insert padrão abaixo:
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
      // 🚀 DESATIVAR LOADING STATE
      setIsCreating(false);
    }
  };

  // 🚀 FUNÇÃO DE TOGGLE STATUS COM LOADING
  const handleToggleAtivo = async (id: string, ativoAtual: boolean) => {
    // Ativar loading para este produto específico
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
      // Desativar loading para este produto
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

  const canCreate = hasRole("logistica") || hasRole("admin");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar produtos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHeader
        title="Produtos"
        subtitle="Gerencie os produtos do sistema"
        icon={Tag}
        actions={
          canCreate && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              // 🚀 BLOQUEAR FECHAMENTO DURANTE CRIAÇÃO
              if (!open && isCreating) return;
              setDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Produto</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do produto.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={novoProduto.nome}
                      onChange={e => setNovoProduto({ ...novoProduto, nome: e.target.value })}
                      placeholder="Nome do produto"
                      disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
                    />
                  </div>
                  <div>
                    <Label htmlFor="unidade">Unidade *</Label>
                    <Select
                      value={novoProduto.unidade}
                      onValueChange={value => setNovoProduto({ ...novoProduto, unidade: value as Unidade })}
                      disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
                    >
                      <SelectTrigger id="unidade">
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="t">{unidadeLabels.t}</SelectItem>
                        <SelectItem value="kg">{unidadeLabels.kg}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                    onClick={handleCreateProduto}
                    disabled={isCreating} // 🚀 DESABILITAR DURANTE LOADING
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar Produto
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {/* Filtros / Busca */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="flex gap-2 items-center">
            <FilterIcon className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as "all" | "ativo" | "inativo")}>
              <SelectTrigger className="w-[180px]">
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
            className="max-w-md"
          />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setSearchTerm("");
              setFilterStatus("all");
            }}
            className="gap-1"
          >
            <X className="h-4 w-4" /> 
            Limpar Filtros
          </Button>
        </div>
      </div>

      {/* Modal detalhes produto */}
      <Dialog open={!!detalhesProduto} onOpenChange={open => !open && setDetalhesProduto(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Produto</DialogTitle>
            <DialogDescription>
              {detalhesProduto?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {detalhesProduto && (
              <>
                {/* Informações Básicas */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Unidade:</Label>
                    <p className="font-semibold">{unidadeLabels[detalhesProduto.unidade || ""] || detalhesProduto.unidade}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status:</Label>
                    <div className="mt-1">
                      <Badge variant={detalhesProduto.ativo ? "default" : "secondary"}>
                        {detalhesProduto.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Criado em:</Label>
                    <p className="font-semibold">{detalhesProduto.created_at ? new Date(detalhesProduto.created_at).toLocaleString() : "—"}</p>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setDetalhesProduto(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lista de produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProdutos.map((produto) => (
          <Card
            key={produto.id}
            className="cursor-pointer transition-all"
            onClick={() => setDetalhesProduto(produto)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{produto.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    Unidade: {unidadeLabels[produto.unidade] || produto.unidade}
                  </p>
                </div>
                <Badge variant={produto.ativo ? "default" : "secondary"}>
                  {produto.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Criado em:</span>{" "}
                  {produto.created_at ? new Date(produto.created_at).toLocaleString() : "—"}
                </p>
              </div>
              {canCreate && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <Label htmlFor={`switch-${produto.id}`} className="text-sm">
                    {produto.ativo ? "Ativo" : "Inativo"}
                  </Label>
                  {/* 🚀 SWITCH COM LOADING STATE */}
                  <div className="relative">
                    <Switch
                      id={`switch-${produto.id}`}
                      checked={produto.ativo}
                      onCheckedChange={() => handleToggleAtivo(produto.id, produto.ativo)}
                      onClick={e => e.stopPropagation()}
                      disabled={isTogglingStatus[produto.id]} // 🚀 DESABILITAR DURANTE LOADING
                    />
                    {/* 🚀 SPINNER SOBREPOSTO DURANTE LOADING */}
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
      {filteredProdutos.length === 0 && (
        <div className="text-center py-12">
          <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {searchTerm || filterStatus !== "all"
              ? "Nenhum produto encontrado com os filtros aplicados"
              : "Nenhum produto cadastrado ainda"}
          </p>
        </div>
      )}
    </div>
  );
};

export default Produtos;
