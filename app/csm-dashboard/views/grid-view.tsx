"use client";

import { type ClientData } from "@/lib/dashboard/csm-clients";
import { ClientCard } from "../client-card";

interface GridViewProps {
  clients: ClientData[];
  onSelectClient: (client: ClientData) => void;
}

export function GridView({ clients, onSelectClient }: GridViewProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {clients.map((client) => (
        <ClientCard
          key={client.id}
          client={client}
          onClick={() => onSelectClient(client)}
        />
      ))}
    </div>
  );
}
