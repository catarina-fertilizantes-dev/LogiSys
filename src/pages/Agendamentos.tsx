import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, User, Truck, Plus, X, Filter as FilterIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type AgendamentoStatus = "confirmado" | "pendente" | "concluido" | "cancelado";

interface AgendamentoItem {
  id: number;
  cliente: string;
  produto: string;
  quantidade: number;
  data: string; // dd/mm/yyyy
  horario: string;
  placa: string;
  motorista: string;
  documento: string;
  pedido: string;
  status: AgendamentoStatus;
}

const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Agendamentos = () => {
  const { hasRole } = useAuth();
  const canCreate = hasRole("admin") || hasRole("logistica") || hasRole("cliente");

  const [agendamentos] = useState<AgendamentoItem[]>([
    { id: 1, cliente: "Cliente ABC", produto: "Ureia", quantidade: 4.0, data: "17/01/2024", horario: "14:00", placa: "ABC-1234", motorista: "João Silva", documento: "123.456.789-00", pedido: "PED-2024-001", status: "confirmado" },
    { id: 2, cliente: "Transportadora XYZ", produto: "NPK 20-05-20", quantidade: 8.0, data: "17/01/2024", horario: "15:30", placa: "DEF-5678", motorista: "Maria Santos", documento: "987.654.321-00", pedido: "PED-2024-002", status: "confirmado" },
    { id: 3, cliente: "Fazenda Boa Vista", produto: "Super Simples", quantidade: 12.0, data: "18/01/2024", horario: "09:00", placa: "GHI-9012", motorista: "Pedro Costa", documento: "456.789.123-00", pedido: "PED-2024-005", status: "pendente" },
  ]);

  /* Filtros compactos + colapsáveis */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<AgendamentoStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const allStatuses: AgendamentoStatus[] = ["pendente", "confirmado", "concluido", "cancelado"];
  const toggleStatus = (st: AgendamentoStatus) => setSelectedStatuses((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  const clearFilters = () => { setSearch(""); setSelectedStatuses([]); setDateFrom(""); setDateTo(""); };

  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter((a) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${a.cliente} ${a.produto} ${a.pedido} ${a.motorista}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(a.status)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (parseDate(a.data) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (parseDate(a.data) > to) return false;
      }
      return true;
    });
  }, [agendamentos, search, selectedStatuses, dateFrom, dateTo]);

  const showingCount = filteredAgendamentos.length;
  const totalCount = agendamentos.length;
  const activeAdvancedCount = (selectedStatuses.length ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Agendamentos de Retirada"
        description="Gerencie os agendamentos de retirada de produtos"
        actions={
          <Button className="bg-gradient-primary" disabled={!canCreate} title={!canCreate ? "Sem permissão" : "Novo Agendamento"}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Agendamento
          </Button>
        }
      />

      {/* Barra compacta */}
      <div className="container mx-auto px-6 pt-3">
        <div className="flex items-center gap-3">
          <Input className="h-9 flex-1" placeholder="Buscar por cliente, produto, pedido ou motorista..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Mostrando <span className="font-medium">{showingCount}</span> de <span className="font-medium">{totalCount}</span></span>
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen((v) => !v)}>
            <FilterIcon className="h-4 w-4 mr-1" />
            Filtros {activeAdvancedCount ? `(${activeAdvancedCount})` : ""}
            {filtersOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="container mx-auto px-6 pt-2">
          <div className="rounded-md border p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {allStatuses.map((st) => {
                    const active = selectedStatuses.includes(st);
                    const label = st === "pendente" ? "Pendente" : st === "confirmado" ? "Confirmado" : st === "concluido" ? "Concluído" : "Cancelado";
                    return (
                      <Badge key={st} onClick={() => toggleStatus(st)} className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900"}`}>
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Período</Label>
                <div className="flex gap-2">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1"><X className="h-4 w-4" /> Limpar Filtros</Button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 py-6">
        <div className="grid gap-4">
          {filteredAgendamentos.map((ag) => (
            <Card key={ag.id} className="transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                        <Calendar className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{ag.cliente}</h3>
                        <p className="text-sm text-muted-foreground">{ag.produto} - {ag.quantidade}t</p>
                        <p className="text-xs text-muted-foreground">Pedido: <span className="font-medium text-foreground">{ag.pedido}</span></p>
                        <p className="text-xs text-muted-foreground">Data: {ag.data} • {ag.horario}</p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        ag.status === "confirmado" ? "default" :
                        ag.status === "pendente"  ? "secondary" :
                        ag.status === "concluido" ? "default" : "destructive"
                      }
                    >
                      {ag.status === "confirmado" ? "Confirmado" : ag.status === "pendente" ? "Pendente" : ag.status === "concluido" ? "Concluído" : "Cancelado"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2">
                    <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>{ag.data} às {ag.horario}</span></div>
                    <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" /><span>{ag.placa}</span></div>
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span>{ag.motorista}</span></div>
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span>{ag.documento}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredAgendamentos.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento encontrado.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agendamentos;
