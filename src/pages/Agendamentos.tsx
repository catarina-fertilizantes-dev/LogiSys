import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Adapte para seus campos conforme o schema real
interface Liberacao {
  id: string;
  pedido_interno: string;
}

const Agendamentos = () => {
  const { toast } = useToast();

  // Estado do formulário minimalista
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    liberacao_id: "",
    quantidade: "",
    data_retirada: "",
    horario: "",
    placa_caminhao: "",
    motorista_nome: "",
    motorista_documento: ""
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [liberacoes, setLiberacoes] = useState<Liberacao[]>([]);

  // Buscar liberações simplificadas ao abrir o dialog
  const buscarLiberacoes = async () => {
    const { data, error } = await supabase
      .from("liberacoes")
      .select("id,pedido_interno")
      .limit(20);
    if (!error) setLiberacoes(data || []);
  };

  // Handler do submit
  const handleCreateAgendamento = async () => {
    setLoading(true);
    setFormError(null);

    // Checagem mínima (você pode enriquecer depois)
    if (
      !form.liberacao_id ||
      !form.quantidade ||
      !form.data_retirada ||
      !form.horario ||
      !form.placa_caminhao ||
      !form.motorista_nome ||
      !form.motorista_documento
    ) {
      setFormError("Preencha todos os campos!");
      setLoading(false);
      return;
    }

    // Monta payload minimalista
    const payload = {
      liberacao_id: form.liberacao_id,
      quantidade: Number(form.quantidade),
      data_retirada: form.data_retirada,
      horario: form.horario,
      placa_caminhao: form.placa_caminhao.trim().toUpperCase(),
      motorista_nome: form.motorista_nome.trim(),
      motorista_documento: form.motorista_documento.trim()
    };

    try {
      // INSERE no backend SEM SELECT ENCADEADO
      const { data, error } = await supabase
        .from("agendamentos")
        .insert([payload]);

      if (error) {
        setFormError(error.message);
        toast({ variant: "destructive", title: "Erro", description: error.message });
      } else {
        toast({ title: "Agendamento criado com sucesso!" });
        setDialogOpen(false);
        setForm({
          liberacao_id: "",
          quantidade: "",
          data_retirada: "",
          horario: "",
          placa_caminhao: "",
          motorista_nome: "",
          motorista_documento: ""
        });
      }
    } catch (err: any) {
      setFormError(err.message ?? "Erro desconhecido");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Agendamentos de Retirada"
        description="Cadastro minimalista de agendamentos para depuração"
        actions={
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (open) buscarLiberacoes();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">Novo Agendamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Agendamento (Minimal)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Liberação *</Label>
                  <Select value={form.liberacao_id} onValueChange={v => setForm(f => ({ ...f, liberacao_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a liberação" />
                    </SelectTrigger>
                    <SelectContent>
                      {liberacoes.map(lib => (
                        <SelectItem key={lib.id} value={lib.id}>
                          {lib.pedido_interno}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade (t) *</Label>
                  <Input
                    type="number"
                    value={form.quantidade}
                    onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={form.data_retirada}
                    onChange={e => setForm(f => ({ ...f, data_retirada: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário *</Label>
                  <Input
                    type="time"
                    value={form.horario}
                    onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Placa do veículo *</Label>
                  <Input
                    value={form.placa_caminhao}
                    onChange={e => setForm(f => ({ ...f, placa_caminhao: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome do motorista *</Label>
                  <Input
                    value={form.motorista_nome}
                    onChange={e => setForm(f => ({ ...f, motorista_nome: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Documento/CPF do motorista *</Label>
                  <Input
                    value={form.motorista_documento}
                    onChange={e => setForm(f => ({ ...f, motorista_documento: e.target.value }))}
                  />
                </div>
                {formError && (
                  <div className="pt-2 text-destructive text-sm font-semibold border-t">{formError}</div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>Cancelar</Button>
                <Button className="bg-gradient-primary" onClick={handleCreateAgendamento} loading={loading}>Criar Agendamento</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {/* (Não exibe lista, loading, etc — foco só no insert minimalista) */}
    </div>
  );
};

export default Agendamentos;
