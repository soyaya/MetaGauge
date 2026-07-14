export type ServiceStatus = "operational" | "degraded" | "down" | "maintenance";

interface Service {
  name: string;
  status: ServiceStatus;
  uptime: number;
  responseTime: number;
  lastChecked: string;
}

interface MonitoringStatusProps {
  services: Service[];
}

const statusConfig: Record<ServiceStatus, { label: string; color: string; bg: string }> = {
  operational: { label: "Operational", color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
  degraded: { label: "Degraded", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  down: { label: "Down", color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  maintenance: { label: "Maintenance", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
};

const statusDot: Record<ServiceStatus, string> = {
  operational: "bg-green-500",
  degraded: "bg-yellow-500",
  down: "bg-red-500",
  maintenance: "bg-blue-500",
};

export function MonitoringStatus({ services }: MonitoringStatusProps) {
  const overallStatus = services.every((s) => s.status === "operational")
    ? "operational"
    : services.some((s) => s.status === "down")
    ? "down"
    : "degraded";

  const overallConfig = statusConfig[overallStatus];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      {/* Overall Status Banner */}
      <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${overallConfig.bg}`}>
        <span className={`h-3 w-3 rounded-full ${statusDot[overallStatus]} animate-pulse`} />
        <span className={`font-medium ${overallConfig.color}`}>
          All Systems {overallConfig.label}
        </span>
      </div>

      {/* Service List */}
      <ul className="space-y-3">
        {services.map((service) => {
          const config = statusConfig[service.status];
          return (
            <li key={service.name} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${statusDot[service.status]}`} />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{service.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{service.uptime}% uptime</span>
                <span>{service.responseTime}ms</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${config.color} ${config.bg}`}>
                  {config.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
