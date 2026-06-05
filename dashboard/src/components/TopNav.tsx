import { Activity, ShieldCheck, Database, Server } from 'lucide-react';

export function TopNav() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="flex h-16 items-center px-6 gap-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon-purple/20 border border-neon-purple/50">
            <ShieldCheck className="h-6 w-6 text-neon-purple" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">
              Sentinel<span className="text-neon-purple">Command</span>
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              Global Interdiction Grid
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-6 text-xs font-mono">
          <StatusIndicator icon={<Activity className="h-4 w-4" />} label="API Gateway" status="operational" />
          <StatusIndicator icon={<Server className="h-4 w-4" />} label="Kafka Cluster" status="operational" />
          <StatusIndicator icon={<Database className="h-4 w-4" />} label="Redis Cache" status="operational" />
          <StatusIndicator icon={<ShieldCheck className="h-4 w-4" />} label="Zone 4 Interdiction" status="standby" />
        </div>
      </div>
    </nav>
  );
}

function StatusIndicator({ icon, label, status }: { icon: React.ReactNode; label: string; status: 'operational' | 'degraded' | 'standby' }) {
  const colors = {
    operational: 'text-emerald-safe bg-emerald-safe/10 border-emerald-safe/20',
    degraded: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    standby: 'text-neon-purple bg-neon-purple/10 border-neon-purple/20',
  };

  const pulse = status === 'operational' ? 'animate-pulse' : '';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors[status]}`}>
      {icon}
      <span className="uppercase tracking-wider">{label}</span>
      <div className={`h-1.5 w-1.5 rounded-full bg-current ${pulse}`} />
    </div>
  );
}
