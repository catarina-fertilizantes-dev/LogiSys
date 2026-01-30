import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { DocumentViewer } from "@/components/DocumentViewer";
import PhotoCaptureMethod from "@/components/PhotoCaptureMethod";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { 
  Loader2, 
  CheckCircle, 
  ArrowRight, 
  User, 
  Truck, 
  Calendar, 
  Hash, 
  Clock, 
  ArrowLeft,
  Camera,
  Upload,
  X
} from "lucide-react";

const ETAPAS = [
  { 
    id: 1, 
    nome: "Chegada", 
    titulo: "Chegada do Caminhão", 
    campo_data: "data_chegada", 
    campo_obs: "observacao_chegada", 
    campo_url: "url_foto_chegada",
    cor: "bg-orange-500 text-white"
  },
  { 
    id: 2, 
    nome: "Início Carregamento", 
    titulo: "Início do Carregamento", 
    campo_data: "data_inicio", 
    campo_obs: "observacao_inicio", 
    campo_url: "url_foto_inicio",
    cor: "bg-blue-500 text-white"
  },
  { 
    id: 3, 
    nome: "Carregando", 
    titulo: "Carregando", 
    campo_data: "data_carregando", 
    campo_obs: "observacao_carregando", 
    campo_url: "url_foto_carregando",
    cor: "bg-purple-500 text-white"
  },
  { 
    id: 4, 
    nome: "Carreg. Finalizado", 
    titulo: "Carregamento Finalizado", 
    campo_data: "data_finalizacao", 
    campo_obs: "observacao_finalizacao", 
    campo_url: "url_foto_finalizacao",
    cor: "bg-indigo-500 text-white"
  },
  { 
    id: 5, 
    nome: "Documentação", 
    titulo: "Anexar Documentação", 
    campo_data: "data_documentacao", 
    campo_obs: "observacao_documentacao", 
    campo_url: "url_nota_fiscal",
    cor: "bg-yellow-600 text-white"
  },
  { 
    id: 6, 
    nome: "Finalizado", 
    titulo: "Finalizado", 
    campo_data: null, 
    campo_obs: null, 
    campo_url: null,
    cor: "bg-green-600 text-white"
  },
];

const formatarDataHora = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
};

const formatarTempo = (minutos: number) => {
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return `${horas}h${mins > 0 ? ` ${mins}min` : ''}`;
};

const ARROW_HEIGHT = 26;

const CarregamentoDetalhe = () => {
  useScrollToTop();

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole, user } = useAuth();
  const { clienteId, armazemId, representanteId } = usePermissions();

  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageFileXml, setStageFileXml] = useState<File | null>(null);
  const [stageObs, setStageObs] = useState("");
  const [selectedEtapa, setSelectedEtapa] = useState<number | null>(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [currentPhotoEtapa, setCurrentPhotoEtapa] = useState<number | null>(null);

  const { uploadPhoto, isUploading: isUploadingPhoto } = usePhotoUpload({
    bucket: 'carregamento-fotos',
    folder: id || 'unknown'
  });

  const handleGoBack = () => {
    navigate("/carregamentos");
  };

  const handleStartPhotoCapture = (etapa: number) => {
    console.log("🔍 [DEBUG] CarregamentoDetalhe - Iniciando captura de foto para etapa:", etapa);
    setCurrentPhotoEtapa(etapa);
    setShowPhotoCapture(true);
  };

  const handlePhotoCapture = async (file: File) => {
    if (!currentPhotoEtapa || !id) return;
    
    console.log("🔍 [DEBUG] CarregamentoDetalhe - Processando foto capturada:", file.name);
    
    try {
      const result = await uploadPhoto(file, `etapa-${currentPhotoEtapa}-${Date.now()}.jpg`);
      
      if (result) {
        await updateCarregamentoFoto(currentPhotoEtapa, result.url);
        setStageFile(file);
        setShowPhotoCapture(false);
        setCurrentPhotoEtapa(null);
        queryClient.invalidateQueries({ queryKey: ["carregamento-detalhe", id] });
        
        toast({
          title: "Foto capturada com sucesso!",
          description: "A foto foi anexada à etapa atual."
        });
      }
    } catch (error) {
      console.error('Erro ao processar foto:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao processar foto',
        description: 'Tente novamente ou use o upload de arquivo.'
      });
    }
  };

  const handleCancelPhotoCapture = () => {
    setShowPhotoCapture(false);
    setCurrentPhotoEtapa(null);
  };

  const updateCarregamentoFoto = async (etapa: number, fotoUrl: string) => {
    const campoFoto = {
      1: 'url_foto_chegada',
      2: 'url_foto_inicio', 
      3: 'url_foto_carregando',
      4: 'url_foto_finalizacao'
    }[etapa];

    if (!campoFoto || !id) return;

    console.log("🔍 [DEBUG] CarregamentoDetalhe - Atualizando campo:", campoFoto, "com URL:", fotoUrl);

    const { error } = await supabase
      .from('carregamentos')
      .update({ [campoFoto]: fotoUrl })
      .eq('id', id);

    if (error) {
      console.error("❌ [ERROR] CarregamentoDetalhe - Erro ao salvar foto:", error);
      throw new Error(`Erro ao salvar foto: ${error.message}`);
    }

    console.log("✅ [SUCCESS] CarregamentoDetalhe - Foto salva no banco de dados");
  };

  // 🆕 QUERY UNIFICADA - MESMA LÓGICA DA LISTA
  const { data: carregamento, isLoading, error } = useQuery({
    queryKey: ["carregamento-detalhe", id, clienteId, armazemId, representanteId, userRole],
    queryFn: async () => {
      console.log("🔍 [DEBUG] CarregamentoDetalhe - Fetching carregamento:", id);
      
      // 🆕 REPRESENTANTE: Usar mesma function da lista
      if (userRole === "representante" && representanteId) {
        console.log('🔍 [DEBUG] CarregamentoDetalhe - Usando function para representante:', representanteId);
        
        const { data, error } = await supabase.rpc('get_carregamento_detalhe_by_representante', {
          p_representante_id: representanteId,
          p_carregamento_id: id
        });
        
        console.log('🔍 [DEBUG] CarregamentoDetalhe Function result:', {
          error: error?.message,
          data: data?.[0]
        });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const item = data[0];
          return {
            id: item.id,
            etapa_atual: item.etapa_atual,
            numero_nf: item.numero_nf,
            data_chegada: item.data_chegada,
            created_at: item.created_at,
            cliente_id: item.cliente_id,
            armazem_id: item.armazem_id,
            observacao_chegada: item.observacao_chegada,
            observacao_inicio: item.observacao_inicio,
            observacao_carregando: item.observacao_carregando,
            observacao_finalizacao: item.observacao_finalizacao,
            observacao_documentacao: item.observacao_documentacao,
            data_inicio: item.data_inicio,
            data_carregando: item.data_carregando,
            data_finalizacao: item.data_finalizacao,
            data_documentacao: item.data_documentacao,
            url_nota_fiscal: item.url_nota_fiscal,
            url_xml: item.url_xml,
            url_foto_chegada: item.url_foto_chegada,
            url_foto_inicio: item.url_foto_inicio,
            url_foto_carregando: item.url_foto_carregando,
            url_foto_finalizacao: item.url_foto_finalizacao,
            agendamento: {
              id: item.agendamento_id,
              data_retirada: item.agendamento_data_retirada,
              quantidade: item.agendamento_quantidade,
              placa_caminhao: item.agendamento_placa_caminhao,
              motorista_nome: item.agendamento_motorista_nome,
              motorista_documento: item.agendamento_motorista_documento,
              cliente: {
                nome: item.cliente_nome
              },
              liberacao: {
                pedido_interno: item.liberacao_pedido_interno,
                produto: {
                  nome: item.produto_nome
                }
              }
            }
          };
        }
        
        return null;
      }

      // 🔄 OUTROS ROLES: Query tradicional com filtros automáticos
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
          observacao_chegada,
          observacao_inicio,
          observacao_carregando,
          observacao_finalizacao,
          observacao_documentacao,
          data_inicio,
          data_carregando,
          data_finalizacao,
          data_documentacao,
          url_nota_fiscal,
          url_xml,
          url_foto_chegada,
          url_foto_inicio,
          url_foto_carregando,
          url_foto_finalizacao,
          agendamento:agendamentos!carregamentos_agendamento_id_fkey (
            id,
            data_retirada,
            quantidade,
            cliente:clientes!agendamentos_cliente_id_fkey (
              nome
            ),
            placa_caminhao,
            motorista_nome,
            motorista_documento,
            liberacao:liberacoes!agendamentos_liberacao_id_fkey (
              pedido_interno,
              produto:produtos!liberacoes_produto_id_fkey (
                nome
              )
            )
          )
        `)
        .eq("id", id);

      // 🆕 APLICAR MESMOS FILTROS DA LISTA
      if (userRole === "cliente" && clienteId) {
        console.log('🔍 [DEBUG] CarregamentoDetalhe - Aplicando filtro cliente:', clienteId);
        query = query.eq("cliente_id", clienteId);
      } else if (userRole === "armazem" && armazemId) {
        console.log('🔍 [DEBUG] CarregamentoDetalhe - Aplicando filtro armazem:', armazemId);
        query = query.eq("armazem_id", armazemId);
      }

      console.log('🔍 [DEBUG] CarregamentoDetalhe - Executando query tradicional...');
      const { data, error } = await query.single();
      
      console.log('🔍 [DEBUG] CarregamentoDetalhe Query tradicional result:', {
        error: error?.message,
        data
      });
      
      if (error) throw error;
      return data;
    },
    enabled: (() => {
      // 🆕 MESMA LÓGICA DA LISTA
      if (!user || !userRole || !id) {
        console.log('🔍 [DEBUG] CarregamentoDetalhe - Query desabilitada: dados básicos faltando', {
          user: !!user,
          userRole,
          id
        });
        return false;
      }
      
      if (userRole === "admin" || userRole === "logistica") {
        console.log('🔍 [DEBUG] CarregamentoDetalhe - Query habilitada: admin/logistica');
        return true;
      }
      
      const clienteOk = userRole !== "cliente" || (clienteId !== undefined);
      const armazemOk = userRole !== "armazem" || (armazemId !== undefined);
      const representanteOk = userRole !== "representante" || (representanteId !== undefined);
      
      const allOk = clienteOk && armazemOk && representanteOk;
      
      console.log('🔍 [DEBUG] CarregamentoDetalhe Enabled conditions:', {
        userRole,
        clienteId,
        armazemId,
        representanteId,
        clienteOk,
        armazemOk,
        representanteOk,
        allOk
      });
      
      return allOk;
    })(),
  });

  // 🚀 MUTATION MANTIDA
  const proximaEtapaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEtapa || !carregamento) {
        console.error("❌ [ERROR] CarregamentoDetalhe - Dados inválidos para próxima etapa");
        throw new Error("Dados inválidos");
      }
      
      const etapaAtual = carregamento.etapa_atual;
      const proximaEtapa = etapaAtual + 1;
      const agora = new Date().toISOString();
      
      console.log("🔍 [DEBUG] CarregamentoDetalhe - Avançando da etapa", etapaAtual, "para", proximaEtapa);
      
      const updateData: any = {
        etapa_atual: proximaEtapa,
        updated_by: user?.id,
      };

      const etapaConfig = ETAPAS.find(e => e.id === etapaAtual);
      if (etapaConfig?.campo_data) {
        updateData[etapaConfig.campo_data] = agora;
        console.log("🔍 [DEBUG] CarregamentoDetalhe - Definindo", etapaConfig.campo_data, "=", agora);
      }
      if (etapaConfig?.campo_obs && stageObs.trim()) {
        updateData[etapaConfig.campo_obs] = stageObs.trim();
        console.log("🔍 [DEBUG] CarregamentoDetalhe - Definindo", etapaConfig.campo_obs, "=", stageObs.trim());
      }

      if (stageFile) {
        console.log("🔍 [DEBUG] CarregamentoDetalhe - Fazendo upload do arquivo:", stageFile.name);
        
        const fileExt = stageFile.name.split('.').pop();
        let bucket = '';
        let fileName = '';
        
        if (etapaAtual === 5) {
          bucket = 'carregamento-documentos';
          fileName = `${carregamento.id}_nota_fiscal_${Date.now()}.${fileExt}`;
          console.log("🔍 [DEBUG] CarregamentoDetalhe - Upload para bucket documentos:", fileName);
        } else {
          bucket = 'carregamento-fotos';
          fileName = `${carregamento.id}_etapa_${etapaAtual}_${Date.now()}.${fileExt}`;
          console.log("🔍 [DEBUG] CarregamentoDetalhe - Upload para bucket fotos:", fileName);
        }
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, stageFile);

        if (uploadError) {
          console.error("❌ [ERROR] CarregamentoDetalhe - Erro no upload:", uploadError);
          throw uploadError;
        }

        console.log("✅ [SUCCESS] CarregamentoDetalhe - Upload realizado:", uploadData);

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        console.log("🔍 [DEBUG] CarregamentoDetalhe - URL pública gerada:", urlData.publicUrl);

        if (etapaConfig?.campo_url) {
          updateData[etapaConfig.campo_url] = urlData.publicUrl;
          console.log("🔍 [DEBUG] CarregamentoDetalhe - Definindo", etapaConfig.campo_url, "=", urlData.publicUrl);
        }
      }

      if (stageFileXml && etapaAtual === 5) {
        console.log("🔍 [DEBUG] CarregamentoDetalhe - Fazendo upload do XML:", stageFileXml.name);
        
        const fileName = `${carregamento.id}_xml_${Date.now()}.xml`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('carregamento-documentos')
          .upload(fileName, stageFileXml);

        if (uploadError) {
          console.error("❌ [ERROR] CarregamentoDetalhe - Erro no upload XML:", uploadError);
          throw uploadError;
        }

        console.log("✅ [SUCCESS] CarregamentoDetalhe - Upload XML realizado:", uploadData);

        const { data: urlData } = supabase.storage
          .from('carregamento-documentos')
          .getPublicUrl(fileName);
        updateData.url_xml = urlData.publicUrl;
        console.log("🔍 [DEBUG] CarregamentoDetalhe - URL XML definida:", urlData.publicUrl);
      }

      console.log("🔍 [DEBUG] CarregamentoDetalhe - Dados para atualização:", updateData);

      const { error: updateError } = await supabase
        .from('carregamentos')
        .update(updateData)
        .eq('id', carregamento.id);

      if (updateError) {
        console.error("❌ [ERROR] CarregamentoDetalhe - Erro na atualização:", updateError);
        throw updateError;
      }

      console.log("✅ [SUCCESS] CarregamentoDetalhe - Carregamento atualizado com sucesso");
      return { proximaEtapa };
    },
    onSuccess: ({ proximaEtapa }) => {
      console.log("✅ [SUCCESS] CarregamentoDetalhe - Etapa avançada para:", proximaEtapa);
      
      toast({
        title: "Etapa avançada com sucesso!",
        description: `Carregamento avançou para: ${ETAPAS.find(e => e.id === proximaEtapa)?.nome}`,
      });
      
      setStageFile(null);
      setStageFileXml(null);
      setStageObs("");
      queryClient.invalidateQueries({ queryKey: ["carregamento-detalhe", id] });
      setSelectedEtapa(proximaEtapa);
    },
    onError: (error) => {
      console.error("❌ [ERROR] CarregamentoDetalhe - Erro ao avançar etapa:", error);
      
      toast({
        title: "Erro ao avançar etapa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (carregamento?.etapa_atual != null) {
      console.log("🔍 [DEBUG] CarregamentoDetalhe - Selecionando etapa atual:", carregamento.etapa_atual);
      setSelectedEtapa(carregamento.etapa_atual);
    }
  }, [carregamento]);

  // 🗑️ REMOVIDA TODA VALIDAÇÃO useEffect - DESNECESSÁRIA!
  // Se a query trouxe dados, o usuário tem permissão

  const calcularEstatisticas = () => {
    if (!carregamento) return null;

    const agora = new Date();
    const inicio = carregamento.data_chegada ? new Date(carregamento.data_chegada) : null;
    const fim = carregamento.etapa_atual === 6 && carregamento.data_documentacao 
      ? new Date(carregamento.data_documentacao) : null;

    const tempoTotalDecorrido = inicio 
      ? Math.round((agora.getTime() - inicio.getTime()) / 1000 / 60)
      : 0;

    const tempoTotalProcesso = inicio && fim
      ? Math.round((fim.getTime() - inicio.getTime()) / 1000 / 60)
      : null;

    const temposPorEtapa = [];
    const datas = [
      carregamento.data_chegada,
      carregamento.data_inicio,
      carregamento.data_carregando,
      carregamento.data_finalizacao,
      carregamento.data_documentacao
    ];

    for (let i = 0; i < datas.length - 1; i++) {
      if (datas[i] && datas[i + 1]) {
        const tempo = Math.round((new Date(datas[i + 1]!).getTime() - new Date(datas[i]!).getTime()) / 1000 / 60);
        temposPorEtapa.push(tempo);
      }
    }

    const tempoMedioPorEtapa = temposPorEtapa.length > 0
      ? Math.round(temposPorEtapa.reduce((a, b) => a + b, 0) / temposPorEtapa.length)
      : 0;

    return {
      tempoTotalDecorrido,
      tempoTotalProcesso,
      tempoMedioPorEtapa,
      temposPorEtapa
    };
  };

  const stats = calcularEstatisticas();

  const getEtapaInfo = (etapa: number) => {
    const found = ETAPAS.find(e => e.id === etapa);
    return found || { 
      id: etapa, 
      nome: `Etapa ${etapa}`, 
      titulo: `Etapa ${etapa}`,
      cor: "bg-gray-500 text-white",
      campo_data: null,
      campo_obs: null,
      campo_url: null
    };
  };

  const renderEtapasFluxo = () => (
    <div
      className="w-full flex flex-col"
      style={{ marginTop: `${ARROW_HEIGHT + 8}px`, marginBottom: "28px" }}
    >
      <div className="relative">
        <div className="flex items-end justify-between w-full max-w-4xl mx-auto relative">
          {ETAPAS.map((etapa, idx) => {
            const etapaIndex = etapa.id;
            const etapaAtual = carregamento?.etapa_atual ?? 1;
            const isFinalizada = etapaIndex < etapaAtual;
            const isAtual = etapaIndex === etapaAtual;
            const isSelected = selectedEtapa === etapaIndex;
            const podeClicar = !proximaEtapaMutation.isPending && !isUploadingPhoto;
            
            let circleClasses = "rounded-full flex items-center justify-center transition-all";
            let shadowStyle = "none";
            
            if (isSelected) {
              circleClasses += " bg-white text-primary border-4 border-primary font-bold";
              shadowStyle = "0 2px 8px 0 rgba(59, 130, 246, 0.3)";
            } else if (isAtual) {
              circleClasses += " bg-blue-500 text-white";
            } else if (isFinalizada) {
              circleClasses += " bg-green-500 text-white";
            } else {
              circleClasses += " bg-gray-200 text-gray-600";
            }
            
            if (podeClicar) {
              circleClasses += " cursor-pointer hover:scale-105";
            } else {
              circleClasses += " cursor-not-allowed opacity-70";
            }

            const getDataEtapa = () => {
              switch (etapaIndex) {
                case 1: return carregamento?.data_chegada;
                case 2: return carregamento?.data_inicio;
                case 3: return carregamento?.data_carregando;
                case 4: return carregamento?.data_finalizacao;
                case 5: return carregamento?.data_documentacao;
                default: return null;
              }
            };
            
            return (
              <div
                key={etapa.id}
                className="flex flex-col items-center flex-1 min-w-[90px] relative"
              >
                {idx < ETAPAS.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      top: `-${ARROW_HEIGHT}px`,
                      left: "50%",
                      transform: "translateX(0)",
                      width: "100%",
                      display: "flex",
                      justifyContent: "center"
                    }}
                  >
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div
                  className={circleClasses}
                  style={{
                    width: 36,
                    height: 36,
                    fontSize: "1.1rem",
                    marginBottom: 3,
                    boxShadow: shadowStyle,
                  }}
                  onClick={() => {
                    if (podeClicar) {
                      console.log("🔍 [DEBUG] CarregamentoDetalhe - Etapa selecionada:", etapaIndex);
                      setSelectedEtapa(etapaIndex);
                    }
                  }}
                >
                  {isFinalizada && !isSelected ? <CheckCircle className="w-6 h-6" /> : etapaIndex}
                </div>
                <div
                  className={
                    "text-xs text-center leading-tight " +
                    (isSelected ? "text-primary font-bold" : "text-foreground") +
                    (podeClicar ? " cursor-pointer" : " cursor-not-allowed opacity-70")
                  }
                  style={{
                    minHeight: 32,
                    marginTop: 2,
                  }}
                  onClick={() => {
                    if (podeClicar) {
                      console.log("🔍 [DEBUG] CarregamentoDetalhe - Etapa selecionada (texto):", etapaIndex);
                      setSelectedEtapa(etapaIndex);
                    }
                  }}
                >
                  {etapa.nome}
                </div>
                <div className="text-[11px] text-center text-muted-foreground" style={{ marginTop: 1 }}>
                  {formatarDataHora(getDataEtapa())}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderAreaEtapas = () => {
    if (!selectedEtapa) return null;

    const etapa = ETAPAS.find(e => e.id === selectedEtapa);
    const etapaTitulo = etapa?.titulo || "Etapa";
    const isEtapaDoc = selectedEtapa === 5;
    const etapaAtual = carregamento?.etapa_atual ?? 1;
    const isEtapaConcluida = selectedEtapa < etapaAtual;
    const isEtapaAtual = selectedEtapa === etapaAtual;
    const isEtapaFutura = selectedEtapa > etapaAtual;
    const isEtapaFinalizada = selectedEtapa === 6 && etapaAtual === 6;
    
    const podeEditar = userRole === "armazem" && 
                      carregamento?.armazem_id === armazemId && 
                      isEtapaAtual && 
                      !isEtapaFinalizada;

    const canUseCamera = podeEditar && selectedEtapa >= 1 && selectedEtapa <= 4;

    const getEtapaData = () => {
      switch (selectedEtapa) {
        case 1:
          return {
            data: carregamento?.data_chegada,
            observacao: carregamento?.observacao_chegada,
            url_arquivo: carregamento?.url_foto_chegada
          };
        case 2:
          return {
            data: carregamento?.data_inicio,
            observacao: carregamento?.observacao_inicio,
            url_arquivo: carregamento?.url_foto_inicio
          };
        case 3:
          return {
            data: carregamento?.data_carregando,
            observacao: carregamento?.observacao_carregando,
            url_arquivo: carregamento?.url_foto_carregando
          };
        case 4:
          return {
            data: carregamento?.data_finalizacao,
            observacao: carregamento?.observacao_finalizacao,
            url_arquivo: carregamento?.url_foto_finalizacao
          };
        case 5:
          return {
            data: carregamento?.data_documentacao,
            observacao: carregamento?.observacao_documentacao,
            url_arquivo: carregamento?.url_nota_fiscal,
            url_xml: carregamento?.url_xml
          };
        default:
          return { data: null, observacao: null, url_arquivo: null };
      }
    };

    const etapaData = getEtapaData();

    return (
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{etapaTitulo}</h2>
              {etapaData.data && (
                <p className="text-xs text-muted-foreground mt-1">
                  Concluída em: {formatarDataHora(etapaData.data)}
                </p>
              )}
            </div>
            {podeEditar && (
              <Button
                disabled={
                  (isEtapaDoc ? (!stageFile || !stageFileXml) : !stageFile) || 
                  proximaEtapaMutation.isPending || 
                  isUploadingPhoto
                }
                size="sm"
                className="px-6"
                onClick={() => {
                  console.log("🔍 [DEBUG] CarregamentoDetalhe - Iniciando próxima etapa");
                  proximaEtapaMutation.mutate();
                }}
              >
                {proximaEtapaMutation.isPending || isUploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  selectedEtapa === 5 ? "Finalizar" : "Próxima"
                )}
              </Button>
            )}
          </div>

          {isEtapaFinalizada ? (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-base font-medium text-foreground mb-1">Processo Finalizado</h3>
              <p className="text-sm text-muted-foreground">
                O carregamento foi concluído com sucesso.
              </p>
            </div>
          ) : isEtapaConcluida ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800 text-sm">Etapa Concluída</span>
                </div>
                
                {etapaData.observacao && (
                  <div className="mb-3">
                    <span className="text-xs font-medium text-green-700">Observações:</span>
                    <p className="text-xs text-green-600 mt-1 bg-white p-2 rounded border">{etapaData.observacao}</p>
                  </div>
                )}

                <div className="space-y-2">
                  {isEtapaDoc ? (
                    <>
                      <DocumentViewer
                        url={etapaData.url_arquivo}
                        type="pdf"
                        bucket="carregamento-documentos"
                        title="Nota Fiscal"
                        description="PDF"
                        variant="button"
                        size="md"
                        showPreview={true}
                      />
                      <DocumentViewer
                        url={etapaData.url_xml}
                        type="xml"
                        bucket="carregamento-documentos"
                        title="Arquivo XML"
                        description="XML"
                        variant="button"
                        size="md"
                        showPreview={true}
                      />
                    </>
                  ) : (
                    <DocumentViewer
                      url={etapaData.url_arquivo}
                      type="image"
                      bucket="carregamento-fotos"
                      title={`Foto - ${etapa?.nome}`}
                      description="Imagem"
                      variant="button"
                      size="md"
                      showPreview={true}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : podeEditar ? (
            <div className="space-y-3">             
              <div>
                <label className="text-sm font-semibold block mb-2">
                  {isEtapaDoc ? "Anexar Nota Fiscal (PDF) *" : "Anexar foto obrigatória *"}
                </label>
                
                <div className="space-y-3">
                  {canUseCamera ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartPhotoCapture(selectedEtapa)}
                      disabled={proximaEtapaMutation.isPending || isUploadingPhoto}
                      className="flex items-center gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      Anexar Foto
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('file-upload-pdf')?.click()}
                      disabled={proximaEtapaMutation.isPending || isUploadingPhoto}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {stageFile ? "Alterar PDF" : "Anexar PDF"}
                    </Button>
                  )}
                  
                  <Input
                    id="file-upload-pdf"
                    type="file"
                    accept={isEtapaDoc ? ".pdf" : "image/*"}
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      console.log("🔍 [DEBUG] CarregamentoDetalhe - Arquivo selecionado:", file?.name);
                      setStageFile(file);
                    }}
                    className="hidden"
                    disabled={proximaEtapaMutation.isPending || isUploadingPhoto}
                  />
                  
                  {stageFile && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700 flex-1">{stageFile.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStageFile(null)}
                        disabled={proximaEtapaMutation.isPending || isUploadingPhoto}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            
              {isEtapaDoc && (
                <div>
                  <label className="text-sm font-semibold block mb-2">
                    Anexar Arquivo XML *
                  </label>
                  
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('file-upload-xml')?.click()}
                      disabled={proximaEtapaMutation.isPending || isUploadingPhoto}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {stageFileXml ? "Alterar XML" : "Anexar XML"}
                    </Button>
                    
                    <Input
                      id="file-upload-xml"
                      type="file"
                      accept=".xml"
                      onChange={e => {
                        const file = e.target.files?.[0] ?? null;
                        console.log("🔍 [DEBUG] CarregamentoDetalhe - Arquivo XML selecionado:", file?.name);
                        setStageFileXml(file);
                      }}
                      className="hidden"
                      disabled={proximaEtapaMutation.isPending || isUploadingPhoto}
                    />
                    
                    {stageFileXml && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700 flex-1">{stageFileXml.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStageFileXml(null)}
                          disabled={proximaEtapaMutation.isPending || isUploadingPhoto}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            
              <div>
                <label className="text-sm font-semibold block mb-1">
                  Observações (opcional)
                </label>
                <Textarea
                  placeholder={`Digite observações sobre ${etapa?.nome.toLowerCase()}...`}
                  value={stageObs}
                  onChange={e => setStageObs(e.target.value)}
                  rows={2}
                  className="text-sm"
                  disabled={proximaEtapaMutation.isPending || isUploadingPhoto}
                />
              </div>
            </div>
          ) : isEtapaFutura ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">Aguardando a etapa anterior ser finalizada.</p>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">Aguardando execução desta etapa pelo armazém.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderInformacoesProcesso = () => {
    const agendamento = carregamento?.agendamento;
    const etapaAtual = carregamento?.etapa_atual ?? 1;
    const etapaInfo = getEtapaInfo(etapaAtual);
  
    return (
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <h2 className="text-base font-semibold mb-4">Informações do Carregamento</h2>
          
          <div className="space-y-4">
            {agendamento && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Pedido:</span>
                    <p className="font-semibold text-sm">{carregamento?.agendamento?.liberacao?.pedido_interno || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Produto:</span>
                    <p className="font-semibold text-sm">{carregamento?.agendamento?.liberacao?.produto?.nome || "N/A"}</p>
                  </div>
                </div>
  
                <div className="border-t"></div>
  
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Cliente:</span>
                    <p className="font-semibold text-sm">{agendamento.cliente?.nome || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Quantidade:</span>
                    <p className="font-semibold text-sm">{agendamento.quantidade ?? "N/A"} ton</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Placa:</span>
                    <p className="font-semibold text-sm">{agendamento.placa_caminhao || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Motorista:</span>
                    <p className="font-semibold text-sm">
                      {agendamento.motorista_nome || "N/A"}
                      {agendamento.motorista_documento && (
                        <span className="block text-xs text-muted-foreground font-normal">
                          CPF: {agendamento.motorista_documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
  
                <div className="border-t"></div>
  
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Data Agendada:</span>
                    <p className="font-semibold text-sm">
                      {agendamento.data_retirada 
                        ? new Date(agendamento.data_retirada).toLocaleDateString("pt-BR")
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Etapa Atual:</span>
                    <div className="mt-1">
                      <Badge className={`${etapaInfo.cor} border-0 font-medium text-xs`}>
                        {etapaInfo.nome}
                      </Badge>
                    </div>
                  </div>
                </div>
  
                {carregamento.numero_nf && (
                  <>
                    <div className="border-t"></div>
                    <div>
                      <span className="text-xs text-muted-foreground">Nota Fiscal:</span>
                      <p className="font-semibold text-sm">{carregamento.numero_nf}</p>
                    </div>
                  </>
                )}
  
                {stats && (
                  <>
                    <div className="border-t"></div>
                    <div>
                      <h3 className="text-sm font-medium mb-3">Estatísticas de Tempo</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <span className="text-xs text-muted-foreground">Tempo Decorrido:</span>
                          <p className="font-semibold text-sm">{formatarTempo(stats.tempoTotalDecorrido)}</p>
                        </div>
                        
                        {stats.tempoTotalProcesso && (
                          <div>
                            <span className="text-xs text-muted-foreground">Tempo Total:</span>
                            <p className="font-semibold text-sm">{formatarTempo(stats.tempoTotalProcesso)}</p>
                          </div>
                        )}
                        
                        {stats.tempoMedioPorEtapa > 0 && (
                          <div>
                            <span className="text-xs text-muted-foreground">Tempo Médio/Etapa:</span>
                            <p className="font-semibold text-sm">{formatarTempo(stats.tempoMedioPorEtapa)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // 🆕 LOADING/ERROR SIMPLIFICADOS
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader 
          title="Detalhes do Carregamento"
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
  
  if (error || !carregamento) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <PageHeader 
          title="Detalhes do Carregamento"
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
              <p className="font-semibold">Carregamento não encontrado</p>
              <p className="text-sm mt-2">Você não tem permissão ou o carregamento não existe.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHeader 
        title="Detalhes do Carregamento"
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
      
      <div className="max-w-[1050px] mx-auto space-y-6">
        {renderEtapasFluxo()}
        {renderAreaEtapas()}
        {renderInformacoesProcesso()}
      </div>

      {showPhotoCapture && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl">
            <PhotoCaptureMethod
              onFileSelect={handlePhotoCapture}
              onCancel={handleCancelPhotoCapture}
              isUploading={isUploadingPhoto}
              accept="image/*"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CarregamentoDetalhe;
