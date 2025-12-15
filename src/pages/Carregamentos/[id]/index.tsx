import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, CheckCircle, Loader2 } from "lucide-react";

const ETAPAS = [
  { id: 1, nome: "Chegada" },
  { id: 2, nome: "Início Carregamento" },
  { id: 3, nome: "Carregando" },
  { id: 4, nome: "Finalização Processual" },
  { id: 5, nome: "Finalização Fiscal" },
];

// Helper para formatar data/hora
const formatarDataHora = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const CarregamentoDetalhe = () => {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const queryClient = useQueryClient();

  // Estados
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Buscar detalhes do carregamento + agendamento + etapas + fotos
  const { data: carregamento, isLoading, error, refetch } = useQuery({
    queryKey: ["carregamento-detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      // Adapte os nomes de joins se necessário conforme o seu banco!
      const { data, error } = await supabase
        .from("carregamentos")
        .select(`
          *,
          agendamento:agendamentos!carregamentos_agendamento_id_fkey (
            data_retirada,
            horario,
            quantidade,
            placa_caminhao,
            motorista_nome,
            motorista_documento,
            cliente:clientes!agendamentos_cliente_id_fkey (
              nome
            )
          ),
          etapas:etapas_carregamento(id, etapa, nome_etapa, inicio, fim, observacao, created_at),
          fotos:fotos_carregamento(id, etapa, url, legenda, created_at)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
  });

  // Controlar etapa atual
  const etapaAtual = carregamento?.etapa_atual || 1;

  // Filtrar infos
  const fotosPorEtapa = useMemo(() => {
    if (!carregamento?.fotos) return {};
    const map: Record<number, any[]> = {};
    for (const f of carregamento.fotos) {
      if (!f.etapa) continue;
      if (!map[f.etapa]) map[f.etapa] = [];
      map[f.etapa].push(f);
    }
    return map;
  }, [carregamento?.fotos]);

  // Observação da etapa atual
  const etapaObservacoes: Record<number, string> = {
    1: carregamento?.observacao_chegada ?? "",
    2: carregamento?.observacao_inicio ?? "",
    3: carregamento?.observacao_carregando ?? "",
    4: carregamento?.observacao_finalizacao ?? "",
    5: carregamento?.observacao_nf ?? "",
  };

  // Datas de início de cada etapa
  const dataEtapas: Record<number, string | null | undefined> = {
    1: carregamento?.data_chegada,
    2: carregamento?.data_inicio_carregamento,
    3: carregamento?.data_carregando,
    4: carregamento?.data_finalizacao,
    5: carregamento?.data_nf,
  };

  // Upload de foto
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setFoto(e.target.files[0]);
  };

  // Salvar foto
  const uploadFotoMutation = useMutation({
    mutationFn: async () => {
      if (!foto) throw new Error("Selecione uma foto");
      setUploading(true);
      // Exemplo: sobrescreva o nome/rota/bucket conforme seu projeto!
      const filePath = `carregamentos/${id}/etapa${etapaAtual}_${Date.now()}_${foto.name}`;
      const { error: uploadError } = await supabase.storage
        .from("carregamento-fotos")
        .upload(filePath, foto);
      if (uploadError) throw uploadError;

      // Insere registro em fotos_carregamento
      const { error: insertError } = await supabase
        .from("fotos_carregamento")
        .insert([{
          carregamento_id: id,
          etapa: etapaAtual,
          url: filePath,
          legenda: "",
        }]);
      if (insertError) throw insertError;
      setFoto(null);
      setUploading(false);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["carregamento-detalhe", id]);
    },
    onError: () => setUploading(false),
  });

  // Atualizar observação da etapa (campo)
  const handleObsSave = async () => {
    let col: string;
    switch (etapaAtual) {
      case 1: col = "observacao_chegada"; break;
      case 2: col = "observacao_inicio"; break;
      case 3: col = "observacao_carregando"; break;
      case 4: col = "observacao_finalizacao"; break;
      case 5: col = "observacao_nf"; break;
      default: return;
    }
    const { error } = await supabase
      .from("carregamentos")
      .update({ [col]: obs })
      .eq("id", id);
    if (!error) refetch();
  };

  // Avançar para próxima etapa
  const avancarEtapa = async () => {
    const { error } = await supabase
      .from("carregamentos")
      .update({ etapa_atual: etapaAtual + 1 })
      .eq("id", id);
    if (!error) refetch();
  };

  // Calcular estatísticas de tempo
  const tempoEtapas = useMemo(() => {
    const result: Record<number, string> = {};
    // Para cada etapa, calcula quanto tempo até a próxima (ou agora)
    for (let i = 1; i <= 5; i++) {
      const ini = dataEtapas[i];
      const fim = i < 5 ? dataEtapas[i + 1] : carregamento?.updated_at;
      if (!ini) continue;
      const dtIni = new Date(ini).getTime();
      const dtFim = fim ? new Date(fim).getTime() : Date.now();
      const duracao = dtFim - dtIni;
      // Exemplo formatado: "2h 15m"
      if (duracao > 0) {
        const min = Math.floor(duracao / 60000) % 60;
        const hrs = Math.floor(duracao / 3600000);
        result[i] = `${hrs ? hrs + "h " : ""}${min}m`;
      }
    }
    return result;
  }, [dataEtapas, carregamento?.updated_at]);

  // Permissões
  const etapaFinalizada = etapaAtual > ETAPAS.length;
  const bloqueado = uploading || etapaFinalizada || carregamento?.status === "finalizado";

  // Renderização
  if (isLoading || !carregamento) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detalhes do Carregamento" />
        <div className="flex justify-center items-center h-40">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detalhes do Carregamento" />
        <div className="flex justify-center items-center h-40 text-destructive">
          Erro ao carregar detalhes: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Detalhes do Carregamento" />

      {/* Stepper etapas */}
      <div className="container mx-auto px-6 mt-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {ETAPAS.map((etapa, idx) => (
              <div key={etapa.id} className="flex-1 flex flex-col items-center">
                <div className={`rounded-full h-8 w-8 flex items-center justify-center font-bold mb-1
                    ${etapaAtual === etapa.id ? "bg-primary text-white" :
                      (etapaAtual > etapa.id ? "bg-green-400 text-white" : "bg-gray-300 text-muted-foreground")}`}>
                  {etapaAtual > etapa.id ? <CheckCircle className="h-5 w-5" /> : etapa.id}
                </div>
                <span className={`text-xs font-semibold ${etapaAtual === etapa.id ? "text-primary" : ""}`}>{etapa.nome}</span>
                <span className="text-[10px] text-muted-foreground">{formatarDataHora(dataEtapas[etapa.id])}</span>
                {/* Exibe tempo gasto na etapa */}
                {tempoEtapas[etapa.id] && <span className="text-xs">{tempoEtapas[etapa.id]}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Etapa atual: upload, obs, próxima etapa */}
      {!etapaFinalizada && (
        <div className="container mx-auto px-6 mt-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Etapa atual:&nbsp; {ETAPAS.find((e) => e.id === etapaAtual)?.nome || "Desconhecida"}</Badge>
                </div>

                {/* Foto obrigatória da etapa - ou documento se for finalização */}
                <Label className="font-medium">Subir foto{etapaAtual === 5 ? ' / NF/Doc.' : ''} (obrigatório)</Label>
                <div className="flex gap-2 items-center">
                  <Input type="file" accept="image/*" disabled={bloqueado} onChange={handleFotoChange} />
                  <Button
                    variant="default"
                    size="sm"
                    disabled={bloqueado || !foto}
                    onClick={() => uploadFotoMutation.mutate()}
                  >
                    {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                    &nbsp; Anexar
                  </Button>
                  {foto && <span className="text-xs text-muted-foreground">{foto.name}</span>}
                </div>
                {/* Visualização da foto já enviada */}
                {fotosPorEtapa[etapaAtual] && fotosPorEtapa[etapaAtual].map((f) => (
                  <img key={f.id} src={supabase.storage.from("carregamento-fotos").getPublicUrl(f.url).data.publicUrl} alt="" className="h-20 rounded mt-2 cursor-pointer" />
                ))}

                {/* Observação da etapa */}
                <div className="space-y-1">
                  <Label>Observação da etapa</Label>
                  <Input
                    value={obs.length ? obs : etapaObservacoes[etapaAtual]}
                    onChange={e => setObs(e.target.value)}
                    disabled={bloqueado}
                  />
                  {!bloqueado && <Button size="sm" className="mt-1" onClick={handleObsSave}>Salvar Observação</Button>}
                </div>
                {/* Botão para avançar etapa: só habilitado se já houver foto */}
                <Button
                  size="lg"
                  className="mt-2"
                  disabled={bloqueado || !(fotosPorEtapa[etapaAtual]?.length > 0)}
                  onClick={avancarEtapa}
                >
                  Próxima etapa
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Depois de finalizado, mostra todas as fotos, observações e estatísticas */}
      {etapaFinalizada && (
        <div className="container mx-auto px-6 mt-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-green-600 font-bold flex items-center gap-1">
                <CheckCircle className="h-5 w-5" /> Carregamento finalizado!
              </div>
              <div className="flex flex-wrap gap-4 mt-4">
                {ETAPAS.map((etapa) => (
                  <div key={etapa.id} className="flex-1 min-w-[160px]">
                    <div className="font-semibold">{etapa.nome}</div>
                    <div className="text-xs text-muted-foreground">{formatarDataHora(dataEtapas[etapa.id])}</div>
                    {etapaObservacoes[etapa.id] && (
                      <div className="text-xs my-1">Obs: {etapaObservacoes[etapa.id]}</div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {(fotosPorEtapa[etapa.id] || []).map((f) => (
                        <img key={f.id} src={supabase.storage.from("carregamento-fotos").getPublicUrl(f.url).data.publicUrl} alt="" className="h-16 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="font-medium">Tempo total: {
                  (() => {
                    const ini = dataEtapas[1];
                    const fim = carregamento.updated_at;
                    if (ini && fim) {
                      const dtIni = new Date(ini).getTime();
                      const dtFim = new Date(fim).getTime();
                      const min = Math.floor((dtFim - dtIni) / 60000) % 60;
                      const hrs = Math.floor((dtFim - dtIni) / 3600000);
                      return `${hrs ? hrs + "h " : ""}${min}m`;
                    }
                    return "-";
                  })()
                }</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resumo geral embaixo */}
      <div className="container mx-auto px-6 py-8">
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Cliente</div>
                <div className="font-semibold">{carregamento?.agendamento?.cliente?.nome}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Data/Hora Agendamento</div>
                <div className="font-semibold">{carregamento.agendamento?.data_retirada} {carregamento.agendamento?.horario}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Quantidade</div>
                <div className="font-semibold">{carregamento.agendamento?.quantidade} t</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Placa caminhão</div>
                <div className="font-semibold">{carregamento.agendamento?.placa_caminhao}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Motorista</div>
                <div className="font-semibold">{carregamento.agendamento?.motorista_nome}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Doc. motorista</div>
                <div className="font-semibold">{carregamento.agendamento?.motorista_documento}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CarregamentoDetalhe;
