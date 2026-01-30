import OpenAI from "openai";
import { env } from "../config/env.ts";
import { logger } from "../utils/logger.ts";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const llmClient = {
  /**
   * Generate text content using OpenAI
   */
  async generateContent(
    systemPrompt: string,
    userPrompt: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string> {
    const maxTokens = options?.maxTokens || 512;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: options?.temperature ?? 0.7,
      });

      const text = response.choices[0]?.message?.content;
      const usage = response.usage;
      const finishReason = response.choices[0]?.finish_reason;

      // Log token usage for monitoring
      logger.info("OpenAI API call completed", {
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        maxTokensLimit: maxTokens,
        finishReason,
      });

      // Warn if output was truncated
      if (finishReason === "length") {
        logger.warn("Response was truncated due to max_tokens limit", {
          maxTokens,
          completionTokens: usage?.completion_tokens,
        });
      }

      if (!text) {
        throw new Error("No content in OpenAI response");
      }

      return text.trim();
    } catch (error) {
      logger.error("LLM generation failed", { error });
      throw error;
    }
  },

  /**
   * Generate content and parse as JSON
   */
  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: { maxTokens?: number }
  ): Promise<T> {
    const text = await this.generateContent(systemPrompt, userPrompt, options);

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      logger.error("Failed to parse LLM JSON response", { text, error });
      throw new Error("Invalid JSON response from LLM");
    }
  },
};
