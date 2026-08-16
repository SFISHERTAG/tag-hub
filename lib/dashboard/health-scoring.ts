import "server-only";

/**
 * Health scoring system for CSM portfolio.
 *
 * Score = (ROAS_score × ROAS_weight) + (Spend_score × Spend_weight) +
 *         (Leads_score × Leads_weight) + (SLA_score × SLA_weight)
 *
 * Weights are adjustable per CSM.
 */

export interface HealthWeights {
  roas: number;      // 0-100, default 35
  spend: number;     // 0-100, default 25
  leads: number;     // 0-100, default 25
  sla: number;       // 0-100, default 15
}

export interface HealthMetrics {
  roas: number;      // Target achievement %
  spend: number;     // Budget adherence %
  leads: number;     // Lead volume vs target %
  sla: number;       // Response time compliance %
}

export interface ClientHealth {
  clientId: string;
  score: number;     // 0-100
  status: "excellent" | "healthy" | "at-risk" | "critical" | "alert";
  roas_score: number;
  spend_score: number;
  leads_score: number;
  sla_score: number;
  alert_count: number;
  last_updated: string;
}

// Default weights
const DEFAULT_WEIGHTS: HealthWeights = {
  roas: 35,
  spend: 25,
  leads: 25,
  sla: 15,
};

/**
 * Normalize weights to sum to 100.
 */
export function normalizeWeights(weights: Partial<HealthWeights>): HealthWeights {
  const normalized = { ...DEFAULT_WEIGHTS, ...weights };
  const total = normalized.roas + normalized.spend + normalized.leads + normalized.sla;

  if (total === 0) return DEFAULT_WEIGHTS;

  return {
    roas: (normalized.roas / total) * 100,
    spend: (normalized.spend / total) * 100,
    leads: (normalized.leads / total) * 100,
    sla: (normalized.sla / total) * 100,
  };
}

/**
 * Calculate component score (0-100) from metric.
 */
function calculateComponentScore(metric: number, componentType: "roas" | "spend" | "leads" | "sla"): number {
  switch (componentType) {
    case "roas":
      // ROAS: target = 100%
      if (metric >= 120) return 100;      // 20%+ above target
      if (metric >= 90) return 85;        // ±10% of target
      if (metric >= 80) return 50;        // 11-20% below
      return 0;                           // 20%+ below

    case "spend":
      // Spend: on budget = 100%
      if (metric <= 105 && metric >= 95) return 100;  // ±5%
      if (metric <= 115) return 70;       // 6-15% over
      if (metric <= 130) return 30;       // 16-30% over
      return 0;                           // 30%+ over

    case "leads":
      // Lead volume: target = 100%
      if (metric >= 110) return 100;      // Exceeds target
      if (metric >= 90) return 85;        // ±10% of target
      if (metric >= 75) return 50;        // 11-25% below
      return 0;                           // 25%+ below

    case "sla":
      // Response SLA: as percentage of on-time
      if (metric >= 100) return 100;      // All on time
      if (metric >= 95) return 85;        // 95%+ on time
      if (metric >= 85) return 50;        // 85%+ on time
      return 0;                           // <85% on time
  }
}

/**
 * Calculate overall health score.
 */
export function calculateHealthScore(
  metrics: HealthMetrics,
  weights: HealthWeights = DEFAULT_WEIGHTS,
): ClientHealth {
  const normalizedWeights = normalizeWeights(weights);

  const roas_score = calculateComponentScore(metrics.roas, "roas");
  const spend_score = calculateComponentScore(metrics.spend, "spend");
  const leads_score = calculateComponentScore(metrics.leads, "leads");
  const sla_score = calculateComponentScore(metrics.sla, "sla");

  const score =
    (roas_score * normalizedWeights.roas) / 100 +
    (spend_score * normalizedWeights.spend) / 100 +
    (leads_score * normalizedWeights.leads) / 100 +
    (sla_score * normalizedWeights.sla) / 100;

  const status = getStatusFromScore(score);

  return {
    clientId: "",
    score: Math.round(score),
    status,
    roas_score: Math.round(roas_score),
    spend_score: Math.round(spend_score),
    leads_score: Math.round(leads_score),
    sla_score: Math.round(sla_score),
    alert_count: 0,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Determine status from health score.
 */
export function getStatusFromScore(
  score: number,
): "excellent" | "healthy" | "at-risk" | "critical" | "alert" {
  if (score >= 90) return "excellent";
  if (score >= 75) return "healthy";
  if (score >= 60) return "at-risk";
  if (score >= 45) return "critical";
  return "alert";
}

/**
 * Get display properties for status.
 */
export function getStatusDisplay(status: ClientHealth["status"]): {
  label: string;
  color: string;
  icon: string;
  stars: number;
} {
  const displays = {
    excellent: { label: "Excellent", color: "text-ok", icon: "●●●●●", stars: 5 },
    healthy: { label: "Healthy", color: "text-ok", icon: "●●●●○", stars: 4 },
    "at-risk": { label: "At-Risk", color: "text-warn", icon: "●●●○○", stars: 3 },
    critical: { label: "Critical", color: "text-danger", icon: "●●○○○", stars: 2 },
    alert: { label: "Alert", color: "text-danger", icon: "●○○○○", stars: 1 },
  };
  return displays[status];
}
