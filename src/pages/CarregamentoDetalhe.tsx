import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, FilePlus } from "lucide-react";

const ETAPAS = [
  { id: 1, nome: "Chegada" },
  { id: 2, nome: "Início Carregamento" },
  { id: 3, nome: "Carregando" },
  { id: 4, nome: "Carreg. Finalizado" },
  { id: 5, nome: "Documentação" },
  { id: 6, nome: "Finalizado" },
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

const getStatusLabel = (status: string | null) => {
  switch (status) {
    case "aguardando":
      return "Aguardando início";
    case "em_andamento":
      return "Em andamento";
    case "finalizado":
      return "Finalizado";
    case "cancelado":
      return "Cancelado";
    default:
      return status || "";
  }
};

const getStatusBadgeVariant = (status: string | null) => {
  switch (status) {
    case "aguardando":
      return "secondary";
    case "em_andamento":
      return "default";
    case "finalizado":
      return "default";
    case "cancelado":
      return "outline";
    default:
      return "outline";
  }
};

const CarregamentoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [armazemId, setArmazemId] = useState<string | null>(null);
  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageObs, setStageObs] = useState("");
  const [selectedEtapa, setSelectedEtapa] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const fetchRoles = async () => {
      if (!userId) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (data) setRoles(data.map((r) => r.role));
    };
    fetchRoles();
  }, [userId]);

  useEffect(() => {
    const fetchVinculos = async () => {
      if (!userId || roles.length === 0) return;
      if (roles.includes("cliente")) {
        const { data: cliente } = await supabase.from("clientes").select("id").eq("user_id", userId).single();
        setClienteId(cliente?.id ?? null);
      } else {
        setClienteId(null);
      }
      if (roles.includes("armazem")) {
        const { data: armazem } = await supabase.from("armazens").select("id").eq("user_id", userId).single();
        setArmazemId(armazem?.id ?? null);
      } else {
        setArmazemId(null);
      }
    };
    fetchVinculos();
    // eslint-disable-next-line
  }, [userId, roles]);

  const { data: carregamento, isLoading, error } = useQuery({
    queryKey: ["carregamento-detalhe", id, clienteId, armazemId, roles],
    queryFn: async () => {
      let query = supabase.from("carregamentos").select(`
        id,
        status,
        etapa_atual,
        numero_nf,
        data_chegada,
        created_at,
        cliente_id,
        armazem_id,
        agendamento:agendamentos!carregamentos_agendamento_id_fkey (
          id,
          data_retirada,
          horario,
          quantidade,
          cliente:clientes!agendamentos_cliente_id_fkey (
            nome
          ),
          placa_caminhao,
          motorista_nome,
          motorista_documento
        )
      `).eq("id", id).single();

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled:
      !!id &&
      userId != null &&
      roles.length > 0 &&
      ((!roles.includes("cliente") && !roles.includes("armazem"))
        || (roles.includes("cliente") && clienteId !== null)
        || (roles.includes("armazem") && armazemId !== null)),
  });

  useEffect(() => {
    if (carregamento?.etapa_atual != null) {
      setSelectedEtapa(carregamento.etapa_atual + 1);
    }
  }, [carregamento]);

  useEffect(() => {
    if (
      !isLoading &&
      carregamento &&
      userId &&
      roles.length > 0
    ) {
      if (
        !(
          roles.includes("admin") ||
          roles.includes("logistica") ||
          (roles.includes("cliente") && clienteId && carregamento.cliente_id === clienteId) ||
          (roles.includes("armazem") && armazemId && carregamento.armazem_id === armazemId)
        )
      ) {
        navigate("/carregamentos");
      }
    }
    // eslint-disable-next-line
  }, [isLoading, carregamento, userId, roles, clienteId, armazemId, navigate]);

  // Stats
  const processoInicio = carregamento?.data_chegada ? new Date(carregamento.data_chegada) : null;
  const processoCriacao = carregamento?.created_at ? new Date(carregamento.created_at) : null;

  // ----------- COMPONENTES DE LAYOUT -----------

  // Fluxo das etapas, menor, sem bordas, labels ajustados, data mais próxima do label, centralização visual corrigida
  const renderEtapasFluxo = () => (
    <div className="w-full pt-3 pb-5 flex flex-col">
      <div className="flex flex-row items-end justify-center gap-0 md:gap-2 px-2 overflow-x-auto">
        {ETAPAS.map((etapa, idx) => {
          const etapaIndex = etapa.id;
          const isFinalizada = (carregamento.etapa_atual ?? 0) + 1 > etapaIndex;
          const isAtual = selectedEtapa === etapaIndex;
          return (
            <div
              key={etapa.id}
              className="flex flex-col items-center min-w-[96px] max-w-[96px] mx-1 cursor-pointer group transition h-[104px] justify-end"
              onClick={() => setSelectedEtapa(etapaIndex)}
              style={{ zIndex: 10 }}
            >
              {/* Círculo reduzido, sem borda quando não-finalizado, cor fonte azul nome etapa corrente */}
              <div
                className={`
                  w-9 h-9 flex items-center justify-center rounded-full
                  font-bold text-[1rem] shadow
                  transition
                  ${isFinalizada
                    ? "bg-green-200 text-green-800"
                    : isAtual
                      ? "bg-primary text-white scale-110 shadow-lg"
                      : "bg-gray-100 text-muted-foreground group-hover:text-primary/80"
                  }
                `}
              >
                {isFinalizada
                  ? <CheckCircle className="w-6 h-6" />
                  : etapaIndex}
              </div>
              <div className={`flex flex-col items-center justify-start min-h-[38px] mt-1 w-full`}>
                <span className={`text-xs font-semibold text-center leading-tight break-words ${isAtual ? "text-primary" : "text-foreground"}`} style={{ fontWeight: 600 }}>
                  {etapa.nome}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium leading-tight mt-1" style={{ minHeight: 0, marginTop: 2 }}>
                  {/* Real apenas para Chegada por enquanto */}
                  {etapaIndex === 1 && carregamento.data_chegada
                    ? formatarDataHora(carregamento.data_chegada)
                    : "-"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCentralAtuacao = () => {
    const isEtapaDoc = selectedEtapa === 5;
    const isFinalizada = carregamento.etapa_atual != null
      ? selectedEtapa && selectedEtapa <= (carregamento.etapa_atual + 1)
      : false;

    return (
      <Card className="mb-8 shadow-sm">
        <CardContent className="p-5 space-y-6">
          {!isFinalizada ? (
            <>
              <div className="space-y-2">
                <label className="text-base font-semibold block mb-0.5">
                  {isEtapaDoc
                    ? "Anexar Nota Fiscal (PDF) *"
                    : "Anexar foto obrigatória *"}
                </label>
                <Input
                  disabled={isFinalizada}
                  type="file"
                  accept={isEtapaDoc ? ".pdf" : "image/*"}
                  onChange={e => setStageFile(e.target.files?.[0] ?? null)}
                  className="w-full"
                />
                {isEtapaDoc && (
                  <>
                    <label className="text-base font-semibold mt-2 block">Anexar Arquivo XML</label>
                    <Input
                      disabled={isFinalizada}
                      type="file"
                      accept=".xml"
                      className="w-full"
                    />
                  </>
                )}
              </div>
              <div>
                <label className="text-base font-semibold block mb-0.5">Observações (opcional)</label>
                <Textarea
                  disabled={isFinalizada}
                  placeholder="Digite observações sobre esta etapa..."
                  value={stageObs}
                  onChange={e => setStageObs(e.target.value)}
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  disabled={!stageFile}
                  variant="primary"
                  size="lg"
                >
                  Próxima Etapa
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-6 text-base">
              <span className="inline-flex items-center gap-2">
                <FilePlus className="w-6 h-6 mr-2" />
                Etapa finalizada. Você pode apenas visualizar os anexos e dados desta etapa.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderInformacoesProcesso = () => {
    const agendamento = carregamento?.agendamento;
    const tempoTotalDecorrido =
      processoInicio
        ? `${Math.round((Date.now() - processoInicio.getTime()) / 1000 / 60)} min`
        : "N/A";
    const tempoTotalFinalizacao =
      processoInicio
        ? carregamento.status === "finalizado"
          ? `${Math.round(((processoCriacao ? processoCriacao.getTime() : Date.now()) - processoInicio.getTime()) / 1000 / 60)} min`
          : "-"
        : "N/A";

    return (
      <Card className="shadow-sm">
        <CardContent className="p-5 grid grid-cols-1 gap-7 md:grid-cols-2 md:gap-10">
          <div className="space-y-4">
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase mb-0.5 tracking-wider">Nome do cliente</span>
              <span className="block text-lg font-semibold text-foreground break-all">{agendamento?.cliente?.nome || "N/A"}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase mb-0.5 tracking-wider">Quantidade</span>
              <span className="block text-lg font-semibold text-foreground">{agendamento?.quantidade ?? "N/A"} toneladas</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase mb-0.5 tracking-wider">Placa caminhão</span>
              <span className="block text-lg font-semibold text-foreground">{agendamento?.placa_caminhao || "N/A"}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase mb-0.5 tracking-wider">Motorista</span>
              <span className="block text-lg font-semibold text-foreground">{agendamento?.motorista_nome || "N/A"}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase mb-0.5 tracking-wider">Doc. Motorista</span>
              <span className="block text-lg font-semibold text-foreground">{agendamento?.motorista_documento || "N/A"}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase mb-0.5 tracking-wider">Número NF</span>
              <span className="block text-lg font-semibold text-foreground">{carregamento.numero_nf || "N/A"}</span>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase mb-0.5 tracking-wider">Tempo em cada etapa</span>
              <span className="block text-base font-medium text-muted-foreground">-- min (implementação futura)</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase mb-0.5 tracking-wider">Tempo total decorrido</span>
              <span className="block text-lg font-semibold text-foreground">{tempoTotalDecorrido}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase mb-0.5 tracking-wider">Tempo até finalização</span>
              <span className="block text-lg font-semibold text-foreground">{tempoTotalFinalizacao}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (
    isLoading ||
    userId == null ||
    roles.length === 0 ||
    (roles.includes("cliente") && clienteId === null) ||
    (roles.includes("armazem") && armazemId === null)
  ) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detalhes do Carregamento" />
        <div className="flex justify-center items-center h-40">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }
  if (error || !carregamento) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detalhes do Carregamento" />
        <div className="container mx-auto py-12">
          <Card className="border-destructive">
            <CardContent className="p-6">
              <div className="text-center text-destructive">
                <p className="font-semibold">Erro ao carregar carregamento</p>
                <p className="text-sm mt-2">{error instanceof Error ? error.message : "Erro desconhecido ou sem permissão"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Detalhes do Carregamento" />
      <div className="container mx-auto px-3 md:px-8 pt-2 pb-10 gap-8 flex flex-col">
        {renderEtapasFluxo()}
        {renderCentralAtuacao()}
        {renderInformacoesProcesso()}
      </div>
    </div>
  );
};

export default CarregamentoDetalhe;
