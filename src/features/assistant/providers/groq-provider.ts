import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

import { assistantTools, runAssistantTool } from "../tools";
import type { AssistantProvider } from "./types";

let cachedClient: OpenAI | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return cachedClient;
}

const maxToolRounds = 6;

const groqTools: ChatCompletionTool[] = assistantTools.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

// Catálogo de Groq cambia con frecuencia; ajusta esta lista según
// https://console.groq.com/docs/models si agregan o retiran modelos.
export const groqModels = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B (OpenAI, open-weight)" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B (OpenAI, open-weight, rápido)" },
  { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
];

export const groqProvider: AssistantProvider = {
  id: "groq",
  label: "Groq (inferencia rápida)",
  models: groqModels,
  isConfigured() {
    return Boolean(process.env.GROQ_API_KEY);
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
        tools: groqTools,
        // Los modelos gpt-oss de Groq consumen parte del límite en razonamiento
        // interno antes de responder; un límite bajo puede truncar la respuesta a vacío.
        max_tokens: 2048,
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
