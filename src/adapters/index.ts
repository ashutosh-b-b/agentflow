/* Adapter contract */
export type {
  AdapterOptions,
  AdapterContext,
  MessageAdapter,
} from "./types";
export {
  createAdapterContext,
  durationFromContext,
  inferIsError,
  safeParseJson,
} from "./types";
export type { InferIsErrorOptions } from "./types";

/* OpenAI Chat Completions */
export { openAIToEvents, createOpenAIMessageAdapter } from "./openai";
export type {
  OpenAIRole,
  OpenAIToolCall,
  OpenAIUserContentPart,
  OpenAIMessage,
  OpenAIAdapterOptions,
} from "./openai";

/* Anthropic Messages */
export { anthropicToEvents, createAnthropicMessageAdapter } from "./anthropic";
export type {
  AnthropicMessage,
  AnthropicAdapterOptions,
  AnthropicContentBlock,
  AnthropicTextBlock,
  AnthropicImageBlock,
  AnthropicDocumentBlock,
  AnthropicToolUseBlock,
  AnthropicToolResultBlock,
  AnthropicThinkingBlock,
  AnthropicRedactedThinkingBlock,
} from "./anthropic";
