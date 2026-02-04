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
  X,
  FileText,
  AlertCircle
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
    titulo: "Documentação",
    campo_data: "data_documentacao",
    campo_obs: "observacao_documentacao",
    campo_url: null,
    cor: "bg-yellow-600 text-white",
    sub_etapas: [
      {
        id: "5a",
        nome: "Docs. Retorno",
        titulo: "Documentos de Retorno",
        campo_url: "docs_retorno_url",
        campo_xml: "docs_retorno_xml_url",
        campo_status: "etapa_5a_status",
        roles_permitidos: ["armazem"],
        cor: "bg-yellow-600 text-white",
        descricao: "Armazém anexa Nota de Retorno + XML"
      },
      {
        id: "5b",
        nome: "Docs. Venda",
        titulo: "Documentos de Venda",
        campo_url: "docs_venda_url",
        campo_xml: "docs_venda_xml_url",
        campo_status: "etapa_5b_status",
        roles_permitidos: ["admin", "logistica"],
        cor: "bg-amber-600 text-white",
        descricao: "Logística anexa Nota de Venda + XML"
      },
      {
        id: "5c",
        nome: "Docs. Remessa",
        titulo: "Documentos de Remessa",
        campo_url: "docs_remessa_url",
        campo_xml: "docs_remessa_xml_url",
        campo_status: "etapa_5c_status",
        roles_permitidos: ["armazem"],
        cor: "bg-orange-600 text-white",
        descricao: "Armazém anexa Nota de Remessa + XML"
      }
    ]
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

  // Estados para etapas normais (1-4)
  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageFileXml, setStageFileXml] = useState<File | null>(null);
  const [stageObs, setStageObs] = useState("");
  const [selectedEtapa, setSelectedEtapa] = useState<number | null>(null);
  const [selectedSubEtapa, setSelectedSubEtapa] = useState<string | null>(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [currentPhotoEtapa, setCurrentPhotoEtapa] = useState<number | null>(null);

  // Estados para sub-etapas da etapa 5
  const [subEtapaFiles, setSubEtapaFiles] = useState<{[key: string]: {pdf: File | null, xml: File | null}}>({
    '5a': { pdf: null, xml: null },
    '5b': { pdf: null, xml: null },
    '5c': { pdf: null, xml: null }
  });

  const { uploadPhoto, isUploading: isUploadingPhoto } = usePhotoUpload({
    bucket: 'carregamento-fotos',
    folder: id || 'unknown'
  });

  const handleGoBack = () => {
    navigate("/carregamentos");
  };

  const handleStartPhotoCapture = (etapa: number) => {
    setCurrentPhotoEtapa(etapa);
    setShowPhotoCapture(true);
  };

  const handlePhotoCapture = async (file: File) => {
    if (!currentPhotoEtapa || !id) return;

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

    const { error } = await supabase
      .from('carregamentos')
      .update({ [campoFoto]: fotoUrl })
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao salvar foto: ${error.message}`);
    }
  };

  // Query otimizada: aguarda permissões carregarem, mas sem verificação redundante
  const { data: carregamento, isLoading, error } = useQuery({
    queryKey: ["carregamento-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_carregamento_detalhe_universal', {
        p_carregamento_id: id,
        p_user_role: userRole,
        p_user_id: user?.id,
        p_cliente_id: clienteId || null,
        p_armazem_id: armazemId || null,
        p_representante_id: representanteId || null
      });
      
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: (() => {
      // ✅ Verificação mínima: apenas aguarda os dados carregarem
      if (!user || !userRole || !id) return false;
      
      // ✅ Para admin/logistica: pode executar imediatamente
      if (userRole === "admin" || userRole === "logistica") return true;
      
      // ✅ Para outros roles: aguarda os IDs carregarem (mas sem verificação de permissão)
      if (userRole === "cliente") return clienteId !== undefined;
      if (userRole === "armazem") return armazemId !== undefined;
      if (userRole === "representante") return representanteId !== undefined;
      
      return true;
    })(),
  });

  // Mutation para etapas normais (1-4)
  const proximaEtapaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEtapa || !carregamento) {
        throw new Error("Dados inválidos");
      }
      
      const etapaAtual = carregamento.etapa_atual;
      const proximaEtapa = etapaAtual + 1;
      const agora = new Date().toISOString();
      
      const updateData: any = {
        etapa_atual: proximaEtapa,
        updated_by: user?.id,
      };

      const etapaConfig = ETAPAS.find(e => e.id === etapaAtual);
      if (etapaConfig?.campo_data) {
        updateData[etapaConfig.campo_data] = agora;
      }
      if (etapaConfig?.campo_obs && stageObs.trim()) {
        updateData[etapaConfig.campo_obs] = stageObs.trim();
      }

      if (stageFile) {
        const fileExt = stageFile.name.split('.').pop();
        const bucket = 'carregamento-fotos';
        const fileName = `${carregamento.id}_etapa_${etapaAtual}_${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, stageFile);

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        if (etapaConfig?.campo_url) {
          updateData[etapaConfig.campo_url] = urlData.publicUrl;
        }
      }

      const { error: updateError } = await supabase
        .from('carregamentos')
        .update(updateData)
        .eq('id', carregamento.id);

      if (updateError) {
        throw updateError;
      }

      return { proximaEtapa };
    },
    onSuccess: ({ proximaEtapa }) => {
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
      toast({
        title: "Erro ao avançar etapa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Mutation para sub-etapas da etapa 5
  const subEtapaMutation = useMutation({
    mutationFn: async (subEtapaId: string) => {
      if (!carregamento || !subEtapaId) {
        throw new Error("Dados inválidos");
      }

      const subEtapa = ETAPAS.find(e => e.id === 5)?.sub_etapas?.find(se => se.id === subEtapaId);
      if (!subEtapa) {
        throw new Error("Sub-etapa não encontrada");
      }

      const files = subEtapaFiles[subEtapaId];
      if (!files.pdf || !files.xml) {
        throw new Error("PDF e XML são obrigatórios");
      }

      const updateData: any = {
        [subEtapa.campo_status]: 'concluida',
        updated_by: user?.id,
      };

      // Upload do PDF
      const pdfFileName = `${carregamento.id}_${subEtapaId}_nota_${Date.now()}.pdf`;
      const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
        .from('carregamento-documentos')
        .upload(pdfFileName, files.pdf);

      if (pdfUploadError) {
        throw new Error(`Erro no upload do PDF: ${pdfUploadError.message}`);
      }

      const { data: pdfUrlData } = supabase.storage
        .from('carregamento-documentos')
        .getPublicUrl(pdfFileName);

      updateData[subEtapa.campo_url] = pdfUrlData.publicUrl;

      // Upload do XML
      const xmlFileName = `${carregamento.id}_${subEtapaId}_xml_${Date.now()}.xml`;
      const { data: xmlUploadData, error: xmlUploadError } = await supabase.storage
        .from('carregamento-documentos')
        .upload(xmlFileName, files.xml);

      if (xmlUploadError) {
        throw new Error(`Erro no upload do XML: ${xmlUploadError.message}`);
      }

      const { data: xmlUrlData } = supabase.storage
        .from('carregamento-documentos')
        .getPublicUrl(xmlFileName);

      updateData[subEtapa.campo_xml] = xmlUrlData.publicUrl;

      // Verificar se todas as sub-etapas foram concluídas para finalizar a etapa 5
      const status5a = subEtapaId === '5a' ? 'concluida' : (carregamento.etapa_5a_status || 'pendente');
      const status5b = subEtapaId === '5b' ? 'concluida' : (carregamento.etapa_5b_status || 'pendente');
      const status5c = subEtapaId === '5c' ? 'concluida' : (carregamento.etapa_5c_status || 'pendente');

      if (status5a === 'concluida' && status5b === 'concluida' && status5c === 'concluida') {
        updateData.etapa_atual = 6;
        updateData.data_documentacao = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('carregamentos')
        .update(updateData)
        .eq('id', carregamento.id);

      if (updateError) {
        throw updateError;
      }

      return { subEtapaId, finalizada: updateData.etapa_atual === 6 };
    },
    onSuccess: ({ subEtapaId, finalizada }) => {
      const subEtapa = ETAPAS.find(e => e.id === 5)?.sub_etapas?.find(se => se.id === subEtapaId);
      
      toast({
        title: "Documentos enviados com sucesso!",
        description: finalizada 
          ? "Carregamento finalizado completamente!" 
          : `${subEtapa?.nome} concluída. Aguardando próxima etapa.`,
      });
      
      // Limpar arquivos da sub-etapa
      setSubEtapaFiles(prev => ({
        ...prev,
        [subEtapaId]: { pdf: null, xml: null }
      }));
      
      queryClient.invalidateQueries({ queryKey: ["carregamento-detalhe", id] });
      
      if (finalizada) {
        setSelectedEtapa(6);
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar documentos",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (carregamento?.etapa_atual != null) {
      setSelectedEtapa(carregamento.etapa_atual);
    }
  }, [carregamento]);

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
  
  const getSubEtapaStatus = (subEtapaId: string) => {
    if (!carregamento) return 'pendente';
    
    switch (subEtapaId) {
      case '5a': return carregamento.etapa_5a_status || 'pendente';
      case '5b': return carregamento.etapa_5b_status || 'pendente';
      case '5c': return carregamento.etapa_5c_status || 'pendente';
      default: return 'pendente';
    }
  };
  
  const getProximaSubEtapa = () => {
    if (!carregamento || carregamento.etapa_atual !== 5) return null;
    
    const status5a = getSubEtapaStatus('5a');
    const status5b = getSubEtapaStatus('5b');
    const status5c = getSubEtapaStatus('5c');
    
    if (status5a === 'pendente') return '5a';
    if (status5a === 'concluida' && status5b === 'pendente') return '5b';
    if (status5b === 'concluida' && status5c === 'pendente') return '5c';
    return null; // Todas concluídas
  };
  
  const podeEditarSubEtapa = (subEtapaId: string) => {
    if (!carregamento || carregamento.etapa_atual !== 5) return false;
    
    const etapa5 = ETAPAS.find(e => e.id === 5);
    const subEtapa = etapa5?.sub_etapas?.find(se => se.id === subEtapaId);
    
    if (!subEtapa) return false;
    
    // Verificar role
    const temPermissao = subEtapa.roles_permitidos.includes(userRole) || userRole === 'admin';
    if (!temPermissao) return false;
    
    // Verificar se é a próxima sub-etapa
    const proximaSubEtapa = getProximaSubEtapa();
    return proximaSubEtapa === subEtapaId;
  };
  
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
            const podeClicar = !proximaEtapaMutation.isPending && !isUploadingPhoto && !subEtapaMutation.isPending;
            
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

  const renderSubEtapas = () => {
    if (!carregamento || selectedEtapa !== 5) return null;

    const etapa5 = ETAPAS.find(e => e.id === 5);
    if (!etapa5?.sub_etapas) return null;

    return (
      <div className="space-y-4">
        {etapa5.sub_etapas.map((subEtapa) => {
          const status = getSubEtapaStatus(subEtapa.id);
          const podeEditar = podeEditarSubEtapa(subEtapa.id);
          const isConcluida = status === 'concluida';
          const files = subEtapaFiles[subEtapa.id];

          const getDocumentUrl = (campo: string) => {
            switch (campo) {
              case 'docs_retorno_url': return carregamento.docs_retorno_url;
              case 'docs_retorno_xml_url': return carregamento.docs_retorno_xml_url;
              case 'docs_venda_url': return carregamento.docs_venda_url;
              case 'docs_venda_xml_url': return carregamento.docs_venda_xml_url;
              case 'docs_remessa_url': return carregamento.docs_remessa_url;
              case 'docs_remessa_xml_url': return carregamento.docs_remessa_xml_url;
              default: return null;
            }
          };

          return (
            <Card key={subEtapa.id} className={`transition-all ${isConcluida ? 'border-green-200 bg-green-50' : podeEditar ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Badge className={`${subEtapa.cor} border-0 font-medium`}>
                      {subEtapa.nome}
                    </Badge>
                    <div>
                      <h3 className="font-semibold text-sm">{subEtapa.titulo}</h3>
                      <p className="text-xs text-muted-foreground">{subEtapa.descricao}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isConcluida && (
                      <Badge className="bg-green-100 text-green-800 border-0">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Concluída
                      </Badge>
                    )}
                    
                    {podeEditar && !isConcluida && (
                      <Button
                        size="sm"
                        disabled={!files.pdf || !files.xml || subEtapaMutation.isPending}
                        onClick={() => subEtapaMutation.mutate(subEtapa.id)}
                      >
                        {subEtapaMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Enviando...
                          </>
                        ) : (
                          'Enviar Documentos'
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {isConcluida ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <DocumentViewer
                        url={getDocumentUrl(subEtapa.campo_url)}
                        type="pdf"
                        bucket="carregamento-documentos"
                        title="Nota Fiscal"
                        description="PDF"
                        variant="button"
                        size="sm"
                        showPreview={true}
                      />
                      <DocumentViewer
                        url={getDocumentUrl(subEtapa.campo_xml)}
                        type="xml"
                        bucket="carregamento-documentos"
                        title="Arquivo XML"
                        description="XML"
                        variant="button"
                        size="sm"
                        showPreview={true}
                      />
                    </div>
                  </div>
                ) : podeEditar ? (
                  <div className="space-y-3">
                    {/* Upload PDF */}
                    <div>
                      <label className="text-sm font-medium block mb-2">
                        Nota Fiscal (PDF) *
                      </label>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`pdf-upload-${subEtapa.id}`)?.click()}
                          disabled={subEtapaMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          {files.pdf ? "Alterar PDF" : "Anexar PDF"}
                        </Button>
                        
                        <Input
                          id={`pdf-upload-${subEtapa.id}`}
                          type="file"
                          accept=".pdf"
                          onChange={e => {
                            const file = e.target.files?.[0] ?? null;
                            setSubEtapaFiles(prev => ({
                              ...prev,
                              [subEtapa.id]: { ...prev[subEtapa.id], pdf: file }
                            }));
                          }}
                          className="hidden"
                          disabled={subEtapaMutation.isPending}
                        />
                        
                        {files.pdf && (
                          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-700 flex-1">{files.pdf.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSubEtapaFiles(prev => ({
                                ...prev,
                                [subEtapa.id]: { ...prev[subEtapa.id], pdf: null }
                              }))}
                              disabled={subEtapaMutation.isPending}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upload XML */}
                    <div>
                      <label className="text-sm font-medium block mb-2">
                        Arquivo XML *
                      </label>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`xml-upload-${subEtapa.id}`)?.click()}
                          disabled={subEtapaMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          {files.xml ? "Alterar XML" : "Anexar XML"}
                        </Button>
                        
                        <Input
                          id={`xml-upload-${subEtapa.id}`}
                          type="file"
                          accept=".xml"
                          onChange={e => {
                            const file = e.target.files?.[0] ?? null;
                            setSubEtapaFiles(prev => ({
                              ...prev,
                              [subEtapa.id]: { ...prev[subEtapa.id], xml: file }
                            }));
                          }}
                          className="hidden"
                          disabled={subEtapaMutation.isPending}
                        />
                        
                        {files.xml && (
                          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-700 flex-1">{files.xml.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSubEtapaFiles(prev => ({
                                ...prev,
                                [subEtapa.id]: { ...prev[subEtapa.id], xml: null }
                              }))}
                              disabled={subEtapaMutation.isPending}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">
                      {!subEtapa.roles_permitidos.includes(userRole) 
                        ? `Aguardando ação do ${subEtapa.roles_permitidos.join('/')}`
                        : 'Aguardando etapa anterior ser concluída'
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

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
                      !isEtapaFinalizada &&
                      selectedEtapa !== 5; // Etapa 5 tem lógica própria

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
            url_arquivo: null
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
                disabled={!stageFile || proximaEtapaMutation.isPending || isUploadingPhoto}
                size="sm"
                className="px-6"
                onClick={() => {
                  proximaEtapaMutation.mutate();
                }}
              >
                {proximaEtapaMutation.isPending || isUploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  "Próxima"
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
          ) : isEtapaDoc ? (
            renderSubEtapas()
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
                </div>
              </div>
            </div>
          ) : podeEditar ? (
            <div className="space-y-3">             
              <div>
                <label className="text-sm font-semibold block mb-2">
                  Anexar foto obrigatória *
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
                      onClick={() => document.getElementById('file-upload-foto')?.click()}
                      disabled={proximaEtapaMutation.isPending || isUploadingPhoto}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {stageFile ? "Alterar Foto" : "Anexar Foto"}
                    </Button>
                  )}
                  
                  <Input
                    id="file-upload-foto"
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
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
                    <p className="font-semibold text-sm">{carregamento?.liberacao_pedido_interno || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Produto:</span>
                    <p className="font-semibold text-sm">{carregamento?.produto_nome || "N/A"}</p>
                  </div>
                </div>

                <div className="border-t"></div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Cliente:</span>
                    <p className="font-semibold text-sm">{carregamento?.cliente_nome || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Quantidade:</span>
                    <p className="font-semibold text-sm">{carregamento?.agendamento_quantidade ?? "N/A"} ton</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Placa:</span>
                    <p className="font-semibold text-sm">{carregamento?.agendamento_placa_caminhao || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Motorista:</span>
                    <p className="font-semibold text-sm">
                      {carregamento?.agendamento_motorista_nome || "N/A"}
                      {carregamento?.agendamento_motorista_documento && (
                        <span className="block text-xs text-muted-foreground font-normal">
                          CPF: {carregamento.agendamento_motorista_documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
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
                      {carregamento?.agendamento_data_retirada 
                        ? new Date(carregamento.agendamento_data_retirada).toLocaleDateString("pt-BR")
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

                {/* Progresso das Sub-etapas da Etapa 5 */}
                {carregamento?.etapa_atual === 5 && (
                  <>
                    <div className="border-t"></div>
                    <div>
                      <h3 className="text-sm font-medium mb-3">Progresso da Documentação</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Docs. Retorno:</span>
                          <Badge className={getSubEtapaStatus('5a') === 'concluida' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {getSubEtapaStatus('5a') === 'concluida' ? 'Concluída' : 'Pendente'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Docs. Venda:</span>
                          <Badge className={getSubEtapaStatus('5b') === 'concluida' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {getSubEtapaStatus('5b') === 'concluida' ? 'Concluída' : 'Pendente'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Docs. Remessa:</span>
                          <Badge className={getSubEtapaStatus('5c') === 'concluida' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {getSubEtapaStatus('5c') === 'concluida' ? 'Concluída' : 'Pendente'}
                          </Badge>
                        </div>
                      </div>
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
