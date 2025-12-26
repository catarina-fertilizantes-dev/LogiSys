// ... imports iguais

const ETAPAS = [
  { id: 1, nome: "Chegada", campoObs: "observacao_chegada", campoData: "data_chegada" },
  { id: 2, nome: "Início Carregamento", campoObs: "observacao_inicio", campoData: "data_inicio_carregamento" },
  { id: 3, nome: "Carregando", campoObs: "observacao_carregando", campoData: "data_carregando" },
  { id: 4, nome: "Carreg. Finalizado", campoObs: "observacao_finalizacao", campoData: "data_finalizacao" },
  { id: 5, nome: "Documentação", campoObs: "observacao_nf", campoData: "data_nf", campoUrl: "url_nota_fiscal", campoXml: "url_xml" },
  { id: 6, nome: "Finalizado" }
];

// ... função formatarDataHora e demais helpers

  // DENTRO do componente:
  const { data: carregamento, isLoading, error } = useQuery({
    queryKey: ["carregamento-detalhe", id, clienteId, armazemId, roles],
    queryFn: async () => {
      let query = supabase
        .from("carregamentos")
        .select(
          `
        id,
        status,
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
        observacao_nf,
        url_nota_fiscal,
        url_xml,
        data_inicio_carregamento,
        data_carregando,
        data_finalizacao,
        data_nf,
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
      `
        )
        .eq("id", id)
        .single();

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    // ... enabled igual
  });

  // ... resto do código dos hooks igual

  // -- No renderAreaRegistro, só exiba campoUrl/campoXml para a etapa 5:
  const campoObs = (etapa as any).campoObs;
  const campoData = (etapa as any).campoData;
  const campoUrl = (etapa as any).campoUrl;
  const campoXml = (etapa as any).campoXml;
  const obsVal = carregamento?.[campoObs] ?? "";
  const dataVal = carregamento?.[campoData] ?? "";

  // PARA etapas 1-4: não exibir anexo (não existe!)
  // PARA etapa 5:
  const urlVal = campoUrl ? carregamento?.[campoUrl] ?? "" : "";
  const urlXml = campoXml ? carregamento?.[campoXml] ?? "" : "";

  // -- Exibição das etapas já finalizadas:
  if (isFinalizada) {
    return (
      <Card className="mb-8 shadow-sm">
        <CardContent className="p-4 space-y-5">
          <div className="font-medium">{etapa.nome} (finalizada em {formatarDataHora(dataVal)})</div>
          <div>
            <span className="font-semibold">Observação:</span>{" "}
            {obsVal ? <span>{obsVal}</span> : <span className="text-gray-400">-</span>}
          </div>
          {/* Para etapas 5, exibe download PDF/XML; para outras, nada! */}
          {etapa.id === 5 && (
            <>
              <div>
                <span className="font-semibold">Nota Fiscal PDF: </span>
                {urlVal ? <a href={urlVal} target="_blank" className="text-primary underline" download>Baixar</a> : <span className="text-gray-400">Não enviado</span>}
              </div>
              <div>
                <span className="font-semibold">Arquivo XML: </span>
                {urlXml ? <a href={urlXml} target="_blank" className="text-primary underline" download>Baixar</a> : <span className="text-gray-400">Não enviado</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // -- O resto (inputs, botões etc.) permanece, mas só para a etapa liberada!
  // ...
