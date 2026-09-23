export type AssistantMessage = { role: "user" | "assistant"; content: string };

export type ModelOption = { id: string; label: string };

export type AssistantProvider = {
  id: string;
  label: string;
  models: ModelOption[];
  isConfigured(): boolean;
  runConversation(params: {
    model: string;
    systemPrompt: string;
    messages: AssistantMessage[];
  }): Promise<string>;
};
