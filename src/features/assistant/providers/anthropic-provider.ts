import Anthropic from "@anthropic-ai/sdk";

import { assistantTools, runAssistantTool } from "../tools";
import type { AssistantProvider } from "./types";

let cachedClient: Anthropic | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
}

const maxToolRounds = 6;

const anthropicTools: Anthropic.Tool[] = assistantTools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.parameters,
}));

export const anthropicProvider: AssistantProvider = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  models: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-opus-5", label: "Claude Opus 5" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },
  async runConversation({ model, systemPrompt, messages }) {
    const anthropic = getClient();
    const conversation: Anthropic.MessageParam[] = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    for (let round = 0; round < maxToolRounds; round += 1) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 1200,
        system: systemPrompt,
        tools: anthropicTools,
        messages: conversation,
      });

      const toolUses = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      if (!toolUses.length) {
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim();
        return text || "No tengo una respuesta para esa pregunta.";
      }

      conversation.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const result = await runAssistantTool(toolUse.name, (toolUse.input as Record<string, unknown>) ?? {});
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
      conversation.push({ role: "user", content: toolResults });
    }

    return "No fue posible completar la consulta después de varios pasos. Intenta reformular la pregunta.";
  },
};
