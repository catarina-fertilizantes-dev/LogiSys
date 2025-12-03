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
import { Tag, Plus, Filter as FilterIcon } from "lucide-react";
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

// -- Página Produtos igual Clientes

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

  const [filterAtivo, setFilterAtivo] = useState<"all" | "ativo" | "inativo">("all");
  const [searchTerm, setSearchTerm] = useState("");

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
        setError(error.message || "Erro ao carregar produtos");
        toast({
          variant: "destructive",
          title: "Erro ao carregar produtos",
          description: "Não foi possível carregar a lista de produtos.",
        });
      } else {
        setProdutos(data as Produto[]);
      }
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
    fetchProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cadastro novo produto
  const handleCreateProduto = async () => {
    const { nome, unidade } = novoProduto;
    if (!nome.trim() || !unidade) {
      toast({
        variant: "destructive",
        title: "Preencha os campos obrigatórios",
      });
      return;
    }
    try {
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
    }
  };

  // Ativar/desativar produto (se quiser permitir isso)
  const handleToggleAtivo = async (id: string, ativoAtual: boolean) => {
    try {
      const { error } = await supabase
        .from("produtos")
        .update({ ativo: !ativoAtual })
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
    }
  };

  // Filtro local igual Clientes
  const filteredProdutos = useMemo(() => {
    let lista = produtos;
    if (filterAtivo === "ativo") lista = lista.filter(p => p.ativo);
    if (filterAtivo === "inativo") lista = lista.filter(p => !p.ativo);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      lista = lista.filter(p =>
        p.nome?.toLowerCase().includes(term) ||
        p.unidade?.toLowerCase().includes(term)
      );
    }
    return lista;
  }, [produtos, filterAtivo, searchTerm]);

  const canCreate = hasRole("logistica") || hasRole("admin");

  // Loading
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

  // Erro
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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                    />
                  </div>
                  <div>
                    <Label htmlFor="unidade">Unidade *</Label>
                    <Select
                      value={novoProduto.unidade}
                      onValueChange={value => setNovoProduto({ ...novoProduto, unidade: value as Unidade })}
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
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button className="bg-gradient-primary" onClick={handleCreateProduto}>
                    Criar Produto
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
            <Select value={filterAtivo} onValueChange={v => setFilterAtivo(v as "all" | "ativo" | "inativo")}>
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
        </div>
      </div>

      {/* Modal detalhes produto */}
      <Dialog open={!!detalhesProduto} onOpenChange={open => !open && setDetalhesProduto(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detalhesProduto?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p><b>Unidade:</b> {unidadeLabels[detalhesProduto?.unidade || ""] || detalhesProduto?.unidade}</p>
            <p><b>Status:</b> {detalhesProduto?.ativo ? "Ativo" : "Inativo"}</p>
            <p><b>Criado em:</b> {detalhesProduto?.created_at ? new Date(detalhesProduto.created_at).toLocaleString() : "—"}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setDetalhesProduto(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grid de produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProdutos.map(produto => (
          <Card
            key={produto.id}
            className="cursor-pointer transition-all"
            onClick={() => setDetalhesProduto(produto)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{produto.nome}</h3>
                  <p className="text-sm text-muted-foreground">Unidade: {unidadeLabels[produto.unidade] || produto.unidade}</p>
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
                  <Switch
                    id={`switch-${produto.id}`}
                    checked={produto.ativo}
                    onCheckedChange={() => handleToggleAtivo(produto.id, produto.ativo)}
                    onClick={e => e.stopPropagation()}
                  />
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
            {searchTerm || filterAtivo !== "all"
              ? "Nenhum produto encontrado com os filtros aplicados"
              : "Nenhum produto cadastrado ainda"}
          </p>
        </div>
      )}
    </div>
  );
};

export default Produtos;
