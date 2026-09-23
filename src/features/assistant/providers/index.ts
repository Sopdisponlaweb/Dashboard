import { anthropicProvider } from "./anthropic-provider";
import { groqProvider } from "./groq-provider";
import { openRouterProvider } from "./openrouter-provider";
import type { AssistantProvider, ModelOption } from "./types";

export const assistantProviders: AssistantProvider[] = [anthropicProvider, groqProvider, openRouterProvider];

export function getProvider(providerId: string): AssistantProvider | undefined {
  return assistantProviders.find((provider) => provider.id === providerId);
}

export function isAnyProviderConfigured(): boolean {
  return assistantProviders.some((provider) => provider.isConfigured());
}

export type AvailableModel = ModelOption & { providerId: string; providerLabel: string };

export function listAvailableModels(): AvailableModel[] {
  return assistantProviders
    .filter((provider) => provider.isConfigured())
    .flatMap((provider) => provider.models.map((model) => ({ ...model, providerId: provider.id, providerLabel: provider.label })));
}

export type { AssistantProvider, ModelOption } from "./types";
