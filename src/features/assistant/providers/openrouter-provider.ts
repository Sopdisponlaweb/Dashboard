import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

import { assistantTools, runAssistantTool } from "../tools";
import type { AssistantProvider } from "./types";

let cachedClient: OpenAI | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        ...(process.env.OPENROUTER_SITE_URL ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL } : {}),
        ...(process.env.OPENROUTER_SITE_NAME ? { "X-Title": process.env.OPENROUTER_SITE_NAME } : {}),
      },
    });
  }
  return cachedClient;
}

const maxToolRounds = 6;

const openRouterTools: ChatCompletionTool[] = assistantTools.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

// Curated set of well-known OpenRouter models. Add or adjust freely — this list
// is just what the model picker offers, not something OpenRouter itself limits.
export const openRouterModels = [
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (Google, económico, con visión)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Google, con visión)" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini (OpenAI, con visión)" },
  { id: "openai/gpt-4o", label: "GPT-4o (OpenAI, con visión)" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B (Meta)" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
];

export const openRouterProvider: AssistantProvider = {
  id: "openrouter",
  label: "OpenRouter (varios modelos)",
  models: openRouterModels,
  isConfigured() {
    return Boolean(process.env.OPENROUTER_API_KEY);
  },
  async runConversation({ model, systemPrompt, messages }) {
    const client = getClient();
    const conversation: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((message) => ({ role: message.role, content: message.content }) as ChatCompletionMessageParam),
    ];

    for (let round = 0; round < maxToolRounds; round += 1) {
      const response = await client.chat.completions.create({
        model,
        messages: conversation,
        tools: openRouterTools,
        max_tokens: 1200,
      });

      const choice = response.choices[0];
      const toolCalls = choice?.message.tool_calls ?? [];

      if (!toolCalls.length) {
        return choice?.message.content?.trim() || "No tengo una respuesta para esa pregunta.";
      }

      conversation.push(choice.message);

      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          input = {};
        }
        const result = await runAssistantTool(toolCall.function.name, input);
        conversation.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
    }

    return "No fue posible completar la consulta después de varios pasos. Intenta reformular la pregunta.";
  },
};
