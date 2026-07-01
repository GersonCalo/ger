export type PlanId = 'free' | 'premium';

export type SubscriptionSnapshot = {
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
};

export type PlanLimits = {
  /** null = sin límite */
  maxOwnedGroups: number | null;
};

const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { maxOwnedGroups: 1 },
  premium: { maxOwnedGroups: null },
};

export const getPlanLimits = (plan: PlanId): PlanLimits => PLAN_LIMITS[plan];

/**
 * Resuelve el plan efectivo de un usuario a partir de su suscripción.
 * Sin suscripción, cancelada o caducada → free. La fecha actual se recibe
 * como parámetro para mantener el servicio puro y testeable.
 */
export const resolvePlan = (subscription: SubscriptionSnapshot | null, now: Date): PlanId => {
  if (!subscription) return 'free';
  if (subscription.plan !== 'premium') return 'free';
  if (subscription.status !== 'active') return 'free';
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= now) return 'free';
  return 'premium';
};

export type FeatureCheck = {
  allowed: boolean;
  limit: number | null;
  plan: PlanId;
};

/**
 * Política central de acceso por plan (CanUseFeaturePolicy). Las reglas
 * premium viven aquí, nunca en controladores Express ni componentes React.
 */
export const canCreateGroup = ({
  plan,
  ownedGroupsCount,
}: {
  plan: PlanId;
  ownedGroupsCount: number;
}): FeatureCheck => {
  const limit = getPlanLimits(plan).maxOwnedGroups;

  return {
    allowed: limit === null || ownedGroupsCount < limit,
    limit,
    plan,
  };
};
