import type { AssistantPlan, AssistantRequest } from "@/lib/ai/schema";
import type { ProviderStatus } from "@/lib/core/provider";

export interface AIProvider {
  id: string;
  getStatus(): ProviderStatus;
  plan(req: AssistantRequest): Promise<AssistantPlan>;
}
