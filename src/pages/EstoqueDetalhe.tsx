import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, FileText, Download, Package, Calendar, Hash, User, MapPin } from "lucide-react";
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

const EstoqueDetalhe = () => {
  const { produtoId, armazemId } = useParams<{ produtoId: string; armazemId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, userRole } = useAuth();

  const [userId, setUserId] = useState<string | null>(null);
  const [currentArmazem, setCurrentArmazem] = useState<string | null>(null);

  // Função para voltar à página pai
  const handleGoBack = () => {
    navigate("/estoque");
  };

  useEffect(() => {
    if (user?.id) {
      console.log("🔍 [DEBUG] EstoqueDetalhe - User ID:", user.id);
      setUserId(user.id);
    }
  }, [user]);

  // Buscar armazém do usuário logado (para controle de acesso)
  useEffect(() => {
    const fetchCurrentArmazem = async () => {
      if (!userId || userRole !== "armazem") return;
      
      console.log("🔍 [DEBUG] EstoqueDetalhe - Buscando armazém do usuário:", userId);
      const { data } = await supabase
        .from("armazens")
        .select("id")
        .eq("user_id", userId)
        .eq("ativo", true)
        .maybeSingle();
      
      if (data) {
        console.log("🔍 [DEBUG] EstoqueDetalhe - Armazém encontrado:", data.id);
        setCurrentArmazem(data.id);
      }
    };
    
    fetchCurrentArmazem();
  }, [userId, userRole]);

  // Query principal para buscar detalhes do estoque
  const { data: estoqueDetalhes, isLoading, error } = useQuery({
    queryKey: ["estoque-detalhe", produtoId, armazemId, userId],
    queryFn: async () => {
      console.log("🔍 [DEBUG] EstoqueDetalhe - Buscando dados:", { produtoId, armazemId });
      
      // Verificar permissões
      if (userRole === "armazem" && currentArmazem && currentArmazem !== armazemId) {
        throw new Error("Sem permissão para visualizar este armazém");
      }

      // Buscar dados do estoque atual
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

      // Buscar remessas relacionadas
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
    enabled: !!produtoId && !!armazemId && !!userId && 
             (userRole !== "armazem" || !!currentArmazem),
  });

  // Verificar permissões
  useEffect(() => {
    if (!isLoading && estoqueDetalhes && userId) {
      // 🎯 AGUARDAR currentArmazem SER CARREGADO PARA USUÁRIO ARMAZÉM
      if (userRole === "armazem" && !currentArmazem) {
        return; // Aguarda currentArmazem ser carregado
      }
      
      const hasPermission = 
        userRole === "admin" ||
        userRole === "logistica" ||
        (userRole === "armazem" && currentArmazem && currentArmazem.id === armazemId);
      
      console.log("🔍 [DEBUG] EstoqueDetalhe - Verificação de permissão:", {
        hasPermission,
        userRole,
        currentArmazem: currentArmazem?.id,
        armazemId
      });
      
      if (!hasPermission) {
        console.log("❌ [ERROR] EstoqueDetalhe - Sem permissão, redirecionando");
        navigate("/estoque");
      }
    }
  }, [isLoading, estoqueDetalhes, userId, userRole, currentArmazem, armazemId, navigate]);

  // 🆕 FUNÇÃO PARA TESTAR ACESSO AO ARQUIVO
  const testFileAccess = async (url: string, tipo: string) => {
    console.log(`🔍 [DEBUG] EstoqueDetalhe - Testando acesso ao ${tipo}:`, url);
    
    try {
      // Extrair nome do arquivo da URL
      const fileName = url.split('/').pop();
      console.log(`🔍 [DEBUG] EstoqueDetalhe - Nome do arquivo extraído:`, fileName);
      
      // Tentar gerar URL assinada
      const { data: signedData, error: signedError } = await supabase.storage
        .from('estoque-documentos')
        .createSignedUrl(fileName!, 3600);
      
      if (signedError) {
        console.error(`❌ [ERROR] EstoqueDetalhe - Erro ao gerar URL assinada para ${tipo}:`, signedError);
        
        // Tentar acesso direto
        console.log(`🔍 [DEBUG] EstoqueDetalhe - Tentando acesso direto ao ${tipo}`);
        window.open(url, '_blank');
      } else {
        console.log(`✅ [SUCCESS] EstoqueDetalhe - URL assinada gerada para ${tipo}:`, signedData.signedUrl);
        window.open(signedData.signedUrl, '_blank');
      }
    } catch (error) {
      console.error(`❌ [ERROR] EstoqueDetalhe - Erro inesperado ao acessar ${tipo}:`, error);
      toast({ 
        variant: "destructive", 
        title: `Erro ao acessar ${tipo}`,
        description: `Não foi possível abrir o ${tipo}. Verifique suas permissões.`
      });
    }
  };

  // Renderizar card de remessa
  const renderRemessaCard = (remessa: RemessaItem) => (
    <Card key={remessa.id} className="transition-all hover:shadow-md">
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Header da remessa */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  {remessa.numero_remessa || `Remessa ${remessa.id.slice(-8)}`}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Quantidade: <span className="font-semibold">{remessa.quantidade_original.toLocaleString('pt-BR')} {estoqueDetalhes?.produto.unidade}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Registrada em: {formatarDataHora(remessa.created_at)}
                </p>
              </div>
            </div>
            
            <Badge variant="secondary" className="text-xs">
              Remessa
            </Badge>
          </div>

          {/* Observações (se houver) */}
          {remessa.observacoes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Observações:</p>
              <p className="text-sm bg-muted p-2 rounded-md">{remessa.observacoes}</p>
            </div>
          )}

          {/* 🆕 DOCUMENTOS COM LOGS DETALHADOS */}
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Documentos:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Nota de Remessa */}
              {remessa.url_nota_remessa ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start h-auto p-3"
                  onClick={() => testFileAccess(remessa.url_nota_remessa!, 'PDF')}
                >
                  <FileText className="h-4 w-4 mr-2 text-red-600" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Nota de Remessa</div>
                    <div className="text-xs text-muted-foreground">PDF</div>
                  </div>
                  <Download className="h-3 w-3 ml-auto" />
                </Button>
              ) : (
                <div className="p-3 border border-dashed rounded-md text-center">
                  <FileText className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <div className="text-xs text-muted-foreground">Nota não disponível</div>
                </div>
              )}

              {/* XML da Remessa */}
              {remessa.url_xml_remessa ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start h-auto p-3"
                  onClick={() => testFileAccess(remessa.url_xml_remessa!, 'XML')}
                >
                  <FileText className="h-4 w-4 mr-2 text-blue-600" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Arquivo XML</div>
                    <div className="text-xs text-muted-foreground">XML</div>
                  </div>
                  <Download className="h-3 w-3 ml-auto" />
                </Button>
              ) : (
                <div className="p-3 border border-dashed rounded-md text-center">
                  <FileText className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <div className="text-xs text-muted-foreground">XML não disponível</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader 
          title="Detalhes do Estoque"
          backButton={
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          }
        />
        <div className="flex justify-center items-center h-40">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }

  if (error || !estoqueDetalhes) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader 
          title="Detalhes do Estoque"
          backButton={
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          }
        />
        <Card className="border-destructive">
          <CardContent className="p-6">
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
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHeader 
        title="Detalhes do Estoque"
        subtitle={`${estoqueDetalhes.produto.nome} - ${estoqueDetalhes.armazem.nome}`}
        backButton={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        }
      />
      
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Card de informações gerais */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Informações do Estoque</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informações do Produto */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Produto</h3>
                </div>
                <div className="ml-7 space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Nome:</span>
                    <p className="font-semibold">{estoqueDetalhes.produto.nome}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Quantidade Total:</span>
                    <p className="font-semibold text-lg text-primary">
                      {estoqueDetalhes.quantidade_total.toLocaleString('pt-BR')} {estoqueDetalhes.produto.unidade}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações do Armazém */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Armazém</h3>
                </div>
                <div className="ml-7 space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Nome:</span>
                    <p className="font-semibold">{estoqueDetalhes.armazem.nome}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Localização:</span>
                    <p className="font-semibold">{estoqueDetalhes.armazem.cidade}/{estoqueDetalhes.armazem.estado}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de remessas */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Histórico de Remessas ({estoqueDetalhes.remessas.length})
            </h2>
          </div>
          
          <div className="space-y-4">
            {estoqueDetalhes.remessas.length > 0 ? (
              estoqueDetalhes.remessas.map(renderRemessaCard)
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
