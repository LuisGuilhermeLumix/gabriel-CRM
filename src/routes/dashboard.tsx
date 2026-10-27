import { createFileRoute } from "@tanstack/react-router";
import {
  Send,
  TrendingUp,
  Target,
  Receipt,
  DollarSign,
  Wallet,
  BadgeDollarSign,
  ShoppingCart,
  CreditCard,
} from "lucide-react";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard, MetricBreakdownRow } from "@/components/MetricCard";
import { RecoveryChart } from "@/components/RecoveryChart";
import { LeadsTable } from "@/components/LeadsTable";
import { CostsModal } from "@/components/CostsModal";
import { useMetrics, RecoveryMetric } from "@/hooks/useMetrics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Lumix - Gabriel" },
      { name: "description", content: "Métricas de recuperação de vendas em tempo real." },
    ],
  }),
  component: DashboardPage,
});

// Cores dos fluxos de recuperação (padrão dos CRMs Lumix)
const FLOW_COLORS = {
  cart: "#f59e0b", // Carrinho Abandonado
  card: "#ef4444", // Cartão Recusado
} as const;

function flowBreakdown(
  m: RecoveryMetric,
  fmt: (v: number) => string,
): MetricBreakdownRow[] {
  return [
    { color: FLOW_COLORS.cart, label: "Carrinho Abandonado", value: fmt(m.cart) },
    { color: FLOW_COLORS.card, label: "Cartão Recusado", value: fmt(m.card) },
  ];
}

function channelSub(m: RecoveryMetric, fmt: (v: number) => string): string {
  return `SMS: ${fmt(m.sms)} | Email: ${fmt(m.email)}`;
}

function DashboardPage() {
  const [costsOpen, setCostsOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { metrics: m, loading } = useMetrics();

  const fmtPct = (v: number) => formatPercent(v, 1);

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <MetricCard
            label="Carrinhos Abandonados"
            icon={ShoppingCart}
            loading={loading}
            value={formatNumber(m.carrinhosAbandonados)}
          />
          <MetricCard
            label="Cartões Recusados"
            icon={CreditCard}
            loading={loading}
            value={formatNumber(m.cartoesRecusados)}
          />
          <MetricCard
            label="Disparos Feitos"
            icon={Send}
            loading={loading}
            value={formatNumber(m.disparosFeitos.total)}
            subInfo={channelSub(m.disparosFeitos, formatNumber)}
            breakdown={flowBreakdown(m.disparosFeitos, formatNumber)}
          />
          <MetricCard
            label="Vendas Recuperadas"
            icon={TrendingUp}
            variant="brand"
            loading={loading}
            value={formatNumber(m.vendasRecuperadas.total)}
            subInfo={channelSub(m.vendasRecuperadas, formatNumber)}
            breakdown={flowBreakdown(m.vendasRecuperadas, formatNumber)}
          />
          <MetricCard
            label="Taxa de Conversão"
            icon={Target}
            loading={loading}
            value={fmtPct(m.taxaConversao.total)}
            subInfo={channelSub(m.taxaConversao, fmtPct)}
            breakdown={flowBreakdown(m.taxaConversao, fmtPct)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <MetricCard
            label="Ticket Médio"
            icon={Receipt}
            loading={loading}
            value={formatCurrency(m.ticketMedio.total)}
            subInfo={channelSub(m.ticketMedio, formatCurrency)}
            breakdown={flowBreakdown(m.ticketMedio, formatCurrency)}
          />
          <MetricCard
            label="Valor Recuperado"
            icon={BadgeDollarSign}
            variant="brand"
            loading={loading}
            value={formatCurrency(m.receitaRecuperada.total)}
            subInfo={channelSub(m.receitaRecuperada, formatCurrency)}
            breakdown={flowBreakdown(m.receitaRecuperada, formatCurrency)}
          />
          <MetricCard
            label="Faturamento Total (Front)"
            icon={TrendingUp}
            loading={loading}
            value={formatCurrency(m.faturamentoFront)}
          />
          <MetricCard
            label="Comissão Lumix"
            icon={DollarSign}
            variant="brand2"
            loading={loading}
            value={formatCurrency(m.comissaoLumix)}
            subInfo="25% sobre receita recuperada no período"
          />
          <MetricCard
            label="Faturamento Sob o Front"
            icon={Wallet}
            loading={loading}
            value={formatPercent(m.faturamentoSobFrontPct, 2)}
            subInfo="Recuperado vs. faturamento do front orgânico"
            editable
            onEdit={() => setCostsOpen(true)}
          />
        </div>

        <RecoveryChart />
        <LeadsTable />
      </div>

      <CostsModal
        key={reloadKey}
        open={costsOpen}
        onClose={() => setCostsOpen(false)}
        onSaved={() => setReloadKey((k) => k + 1)}
      />
    </AppLayout>
  );
}
