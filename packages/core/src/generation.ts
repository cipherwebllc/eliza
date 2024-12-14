import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import {
    generateObject,
    generateText as aiGenerateText,
    GenerateObjectResult,
    CoreMessage,
} from "ai";
import { Buffer } from "buffer";
import { createOllama } from "ollama-ai-provider";
import OpenAI from "openai";
import { encodingForModel, TiktokenModel } from "js-tiktoken";
import Together from "together-ai";
import { ZodSchema } from "zod";
import { elizaLogger } from "./index.js";
import { getModel, models } from "./models.js";
import {
    parseBooleanFromText,
    parseJsonArrayFromText,
    parseJSONObjectFromText,
    parseShouldRespondFromText,
    parseActionResponseFromText
} from "./parsing.js";
import settings from "./settings.js";
import {
    Content,
    IAgentRuntime,
    IImageDescriptionService,
    ITextGenerationService,
    ModelClass,
    ModelProviderName,
    ServiceType,
    SearchResponse,
    ActionResponse
} from "./types.js";
import { fal } from "@fal-ai/client";

// Define model types that aren't exported from SDKs
type AnthropicMessagesModelId = 'claude-3-opus-20240229' | 'claude-3-sonnet-20240229' | 'claude-2.1' | 'claude-2.0' | 'claude-instant-1.2';
type GoogleGenerativeAIModelId = 'gemini-pro' | 'gemini-pro-vision';
type GroqChatModelId = 'mixtral-8x7b-32768' | 'llama2-70b-4096';
type OllamaChatModelId = string;

/**
 * Send a message to the model for a text generateText - receive a string back and parse how you'd like
 * @param opts - The options for the generateText request.
 * @param opts.context The context of the message to be completed.
 * @param opts.stop A list of strings to stop the generateText at.
 * @param opts.model The model to use for generateText.
 * @param opts.frequency_penalty The frequency penalty to apply to the generateText.
 * @param opts.presence_penalty The presence penalty to apply to the generateText.
 * @param opts.temperature The temperature to apply to the generateText.
 * @param opts.max_context_length The maximum length of the context to apply to the generateText.
 * @returns The completed message.
 */

export async function generateText({
    runtime,
    context,
    modelClass,
    stop,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
    stop?: string[];
}): Promise<string> {
    if (!context) {
        console.error("generateText context is empty");
        return "";
    }

    elizaLogger.log("Generating text...");

    elizaLogger.info("Generating text with options:", {
        modelProvider: runtime.modelProvider,
        model: modelClass,
    });

    const provider = runtime.modelProvider;
    const endpoint =
        runtime.character.modelEndpointOverride || models[provider].endpoint;
    let model = models[provider].model[modelClass as keyof typeof models[typeof provider]['model']];

    // allow character.json settings => secrets to override models
    // FIXME: add MODEL_MEDIUM support
    switch (provider) {
        // if runtime.getSetting("LLAMACLOUD_MODEL_LARGE") is true and modelProvider is LLAMACLOUD, then use the large model
        case ModelProviderName.LLAMACLOUD:
            {
                switch (modelClass) {
                    case ModelClass.LARGE:
                        {
                            model =
                                runtime.getSetting("LLAMACLOUD_MODEL_LARGE") ||
                                model;
                        }
                        break;
                    case ModelClass.SMALL:
                        {
                            model =
                                runtime.getSetting("LLAMACLOUD_MODEL_SMALL") ||
                                model;
                        }
                        break;
                }
            }
            break;
        case ModelProviderName.TOGETHER:
            {
                switch (modelClass) {
                    case ModelClass.LARGE:
                        {
                            model =
                                runtime.getSetting("TOGETHER_MODEL_LARGE") ||
                                model;
                        }
                        break;
                    case ModelClass.SMALL:
                        {
                            model =
                                runtime.getSetting("TOGETHER_MODEL_SMALL") ||
                                model;
                        }
                        break;
                }
            }
            break;
        case ModelProviderName.OPENROUTER:
            {
                switch (modelClass) {
                    case ModelClass.LARGE:
                        {
                            model =
                                runtime.getSetting("LARGE_OPENROUTER_MODEL") ||
                                model;
                        }
                        break;
                    case ModelClass.SMALL:
                        {
                            model =
                                runtime.getSetting("SMALL_OPENROUTER_MODEL") ||
                                model;
                        }
                        break;
                }
            }
            break;
    }

    elizaLogger.info("Selected model:", model);

    const temperature = models[provider].settings.temperature;
    const frequency_penalty = models[provider].settings.frequency_penalty;
    const presence_penalty = models[provider].settings.presence_penalty;
    const max_context_length = models[provider].settings.maxInputTokens;
    const max_response_length = models[provider].settings.maxOutputTokens;

    const apiKey = runtime.token;

    try {
        elizaLogger.debug(
            `Trimming context to max length of ${max_context_length} tokens.`
        );
        context = await trimTokens(context, max_context_length, "gpt-4o");

        let response: string;

        const _stop = stop || models[provider].settings.stop;
        elizaLogger.debug(
            `Using provider: ${provider}, model: ${model}, temperature: ${temperature}, max response length: ${max_response_length}`
        );

        switch (provider) {
            // OPENAI & LLAMACLOUD shared same structure.
            case ModelProviderName.OPENAI:
            case ModelProviderName.ETERNALAI:
            case ModelProviderName.ALI_BAILIAN:
            case ModelProviderName.VOLENGINE:
            case ModelProviderName.LLAMACLOUD:
            case ModelProviderName.NANOGPT:
            case ModelProviderName.HYPERBOLIC:
            case ModelProviderName.TOGETHER: {
                elizaLogger.debug("Initializing OpenAI model.");
                const openai = createOpenAI({
                    apiKey: apiKey ?? '',
                    baseURL: endpoint ?? '',
                    fetch: runtime.fetch ?? undefined,
                });

                const { text: openaiResponse } = await aiGenerateText({
                    model: openai.languageModel(model as string),
                    prompt: context,
                    system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = openaiResponse;
                elizaLogger.debug("Received response from OpenAI model.");
                break;
            }

            case ModelProviderName.GOOGLE: {
                const google = createGoogleGenerativeAI({
                    fetch: runtime.fetch || undefined,
                });

                const { text: googleResponse } = await aiGenerateText({
                    model: google(model as GoogleGenerativeAIModelId),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = googleResponse;
                elizaLogger.debug("Received response from Google model.");
                break;
            }

            case ModelProviderName.ANTHROPIC: {
                elizaLogger.debug("Initializing Anthropic model.");

                const anthropic = createAnthropic({
                    apiKey: apiKey ?? '',
                    fetch: runtime.fetch ?? undefined,
                });

                const { text: anthropicResponse } = await aiGenerateText({
                    model: anthropic.languageModel(model as AnthropicMessagesModelId),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = anthropicResponse;
                elizaLogger.debug("Received response from Anthropic model.");
                break;
            }

            case ModelProviderName.CLAUDE_VERTEX: {
                elizaLogger.debug("Initializing Claude Vertex model.");

                const anthropic = createAnthropic({
                    apiKey: apiKey ?? '',
                    fetch: runtime.fetch ?? undefined,
                });

                const { text: anthropicResponse } = await aiGenerateText({
                    model: anthropic.languageModel(model as AnthropicMessagesModelId),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = anthropicResponse;
                elizaLogger.debug(
                    "Received response from Claude Vertex model."
                );
                break;
            }

            case ModelProviderName.GROK: {
                elizaLogger.debug("Initializing Grok model.");
                const grok = createOpenAI({
                    apiKey: apiKey ?? '',
                    baseURL: endpoint ?? '',
                    fetch: runtime.fetch ?? undefined,
                });

                const { text: grokResponse } = await aiGenerateText({
                    model: grok.languageModel(model as string, {
                        parallelToolCalls: false,
                    }),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = grokResponse;
                elizaLogger.debug("Received response from Grok model.");
                break;
            }

            case ModelProviderName.GROQ: {
                const groq = createGroq({
                    apiKey: apiKey ?? '',
                    fetch: runtime.fetch ?? undefined
                });

                const { text: groqResponse } = await aiGenerateText({
                    model: groq.languageModel(model as GroqChatModelId),
                    prompt: context,
                    system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = groqResponse;
                elizaLogger.debug("Received response from Groq model.");
                break;
            }

            case ModelProviderName.LLAMALOCAL: {
                elizaLogger.debug(
                    "Using local Llama model for text completion."
                );
                const textGenerationService =
                    runtime.getService<ITextGenerationService>(
                        ServiceType.TEXT_GENERATION
                    );

                if (!textGenerationService) {
                    throw new Error("Text generation service not found");
                }

                response = await textGenerationService.queueTextCompletion(
                    context,
                    temperature ?? 0.7,
                    _stop,
                    frequency_penalty ?? 0,
                    presence_penalty ?? 0,
                    max_response_length ?? 1000
                );
                elizaLogger.debug("Received response from local Llama model.");
                break;
            }

            case ModelProviderName.REDPILL: {
                elizaLogger.debug("Initializing RedPill model.");
                const serverUrl = models[provider].endpoint;
                const openai = createOpenAI({
                    apiKey: apiKey ?? '',
                    baseURL: serverUrl ?? '',
                    fetch: runtime.fetch ?? undefined,
                });

                const { text: redpillResponse } = await aiGenerateText({
                    model: openai.languageModel(model as string),
                    prompt: context,
                    system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = redpillResponse;
                elizaLogger.debug("Received response from redpill model.");
                break;
            }

            case ModelProviderName.OPENROUTER: {
                elizaLogger.debug("Initializing OpenRouter model.");
                const serverUrl = models[provider].endpoint;
                const openrouter = createOpenAI({
                    apiKey: apiKey ?? '',
                    baseURL: serverUrl ?? '',
                    fetch: runtime.fetch ?? undefined,
                });

                const { text: openrouterResponse } = await aiGenerateText({
                    model: openrouter.languageModel(model as string),
                    prompt: context,
                    system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = openrouterResponse;
                elizaLogger.debug("Received response from OpenRouter model.");
                break;
            }

            case ModelProviderName.OLLAMA:
                {
                    elizaLogger.debug("Initializing Ollama model.");

                    const ollamaProvider = createOllama({
                        baseURL: models[provider].endpoint + "/api",
                        fetch: runtime.fetch ?? undefined,
                    });
                    const ollama = ollamaProvider(model as OllamaChatModelId);

                    elizaLogger.debug("****** MODEL\n", model);

                    const { text: ollamaResponse } = await aiGenerateText({
                        model: ollama,
                        prompt: context,
                        system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
                        temperature: temperature ?? 0.7,
                        maxTokens: max_response_length ?? 1000,
                        frequencyPenalty: frequency_penalty ?? 0,
                        presencePenalty: presence_penalty ?? 0,
                    });

                    response = ollamaResponse;
                }
                elizaLogger.debug("Received response from Ollama model.");
                break;

            case ModelProviderName.HEURIST: {
                elizaLogger.debug("Initializing Heurist model.");
                const heurist = createOpenAI({
                    apiKey: apiKey ?? '',
                    baseURL: endpoint ?? '',
                    fetch: runtime.fetch ?? undefined,
                });

                const { text: heuristResponse } = await aiGenerateText({
                    model: heurist.languageModel(model as string),
                    prompt: context,
                    system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = heuristResponse;
                elizaLogger.debug("Received response from Heurist model.");
                break;
            }
            case ModelProviderName.GAIANET: {
                elizaLogger.debug("Initializing GAIANET model.");

                var baseURL = models[provider].endpoint;
                if (!baseURL) {
                    switch (modelClass) {
                        case ModelClass.SMALL:
                            baseURL =
                                settings.SMALL_GAIANET_SERVER_URL ||
                                "https://llama3b.gaia.domains/v1";
                            break;
                        case ModelClass.MEDIUM:
                            baseURL =
                                settings.MEDIUM_GAIANET_SERVER_URL ||
                                "https://llama8b.gaia.domains/v1";
                            break;
                        case ModelClass.LARGE:
                            baseURL =
                                settings.LARGE_GAIANET_SERVER_URL ||
                                "https://qwen72b.gaia.domains/v1";
                            break;
                    }
                }

                elizaLogger.debug("Using GAIANET model with baseURL:", baseURL);

                const openai = createOpenAI({
                    apiKey: apiKey ?? '',
                    baseURL: endpoint ?? '',
                    fetch: runtime.fetch ?? undefined,
                });

                const { text: openaiResponse } = await aiGenerateText({
                    model: openai.languageModel(model as string),
                    prompt: context,
                    system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = openaiResponse;
                elizaLogger.debug("Received response from GAIANET model.");
                break;
            }

            case ModelProviderName.GALADRIEL: {
                elizaLogger.debug("Initializing Galadriel model.");
                const galadriel = createOpenAI({
                    apiKey: apiKey ?? '',
                    baseURL: endpoint ?? '',
                    fetch: runtime.fetch ?? undefined,
                });

                const { text: galadrielResponse } = await aiGenerateText({
                    model: galadriel.languageModel(model as string),
                    prompt: context,
                    system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
                    temperature: temperature ?? 0.7,
                    maxTokens: max_response_length ?? 1000,
                    frequencyPenalty: frequency_penalty ?? 0,
                    presencePenalty: presence_penalty ?? 0,
                });

                response = galadrielResponse;
                elizaLogger.debug("Received response from Galadriel model.");
                break;
            }

            default: {
                const errorMessage = `Unsupported provider: ${provider}`;
                elizaLogger.error(errorMessage);
                throw new Error(errorMessage);
            }
        }

        return response;
    } catch (error) {
        elizaLogger.error("Error in generateText:", error);
        throw error;
    }
}

/**
 * Truncate the context to the maximum length allowed by the model.
 * @param context The text to truncate
 * @param maxTokens Maximum number of tokens to keep
 * @param model The tokenizer model to use
 * @returns The truncated text
 */
export function trimTokens(
    context: string,
    maxTokens: number,
    model: TiktokenModel
): string {
    if (!context) return "";
    if (maxTokens <= 0) throw new Error("maxTokens must be positive");

    // Get the tokenizer for the model
    const encoding = encodingForModel(model);

    try {
        // Encode the text into tokens
        const tokens = encoding.encode(context);

        // If already within limits, return unchanged
        if (tokens.length <= maxTokens) {
            return context;
        }

        // Keep the most recent tokens by slicing from the end
        const truncatedTokens = tokens.slice(-maxTokens);

        // Decode back to text - js-tiktoken decode() returns a string directly
        return encoding.decode(truncatedTokens);
    } catch (error) {
        console.error("Error in trimTokens:", error);
        // Return truncated string if tokenization fails
        return context.slice(-maxTokens * 4); // Rough estimate of 4 chars per token
    }
}

/**
 * Sends a message to the model to determine if it should respond to the given context.
 * @param opts - The options for the generateText request
 * @param opts.context The context to evaluate for response
 * @param opts.stop A list of strings to stop the generateText at
 * @param opts.model The model to use for generateText
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to "RESPOND", "IGNORE", "STOP" or null
 */
export async function generateShouldRespond({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<"RESPOND" | "IGNORE" | "STOP" | null> {
    let retryDelay = 1000;
    while (true) {
        try {
            elizaLogger.debug(
                "Attempting to generate text with context:",
                context
            );
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });

            elizaLogger.debug("Received response from generateText:", response);
            const parsedResponse = parseShouldRespondFromText(response.trim());
            if (parsedResponse) {
                elizaLogger.debug("Parsed response:", parsedResponse);
                return parsedResponse;
            } else {
                elizaLogger.debug("generateShouldRespond no response");
            }
        } catch (error) {
            elizaLogger.error("Error in generateShouldRespond:", error);
            if (
                error instanceof TypeError &&
                error.message.includes("queueTextCompletion")
            ) {
                elizaLogger.error(
                    "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
                );
            }
        }

        elizaLogger.log(`Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

/**
 * Splits content into chunks of specified size with optional overlapping bleed sections
 * @param content - The text content to split into chunks
 * @param chunkSize - The maximum size of each chunk in tokens
 * @param bleed - Number of characters to overlap between chunks (default: 100)
 * @returns Promise resolving to array of text chunks with bleed sections
 */
export async function splitChunks(
    content: string,
    chunkSize: number = 512,
    bleed: number = 20
): Promise<string[]> {
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: Number(chunkSize),
        chunkOverlap: Number(bleed),
    });

    return textSplitter.splitText(content);
}

/**
 * Sends a message to the model and parses the response as a boolean value
 * @param opts - The options for the generateText request
 * @param opts.context The context to evaluate for the boolean response
 * @param opts.stop A list of strings to stop the generateText at
 * @param opts.model The model to use for generateText
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.token The API token for authentication
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to a boolean value parsed from the model's response
 */
export async function generateTrueOrFalse({
    runtime,
    context = "",
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<boolean> {
    let retryDelay = 1000;

    const stop = Array.from(
        new Set([
            ...(models[runtime.modelProvider].settings.stop || []),
            ["\n"],
        ])
    ) as string[];

    while (true) {
        try {
            const response = await generateText({
                stop,
                runtime,
                context,
                modelClass,
            });

            const parsedResponse = parseBooleanFromText(response.trim());
            if (parsedResponse !== null) {
                return parsedResponse;
            }
        } catch (error) {
            elizaLogger.error("Error in generateTrueOrFalse:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

/**
 * Send a message to the model and parse the response as a string array
 * @param opts - The options for the generateText request
 * @param opts.context The context/prompt to send to the model
 * @param opts.stop Array of strings that will stop the model's generation if encountered
 * @param opts.model The language model to use
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.token The API token for authentication
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to an array of strings parsed from the model's response
 */
export async function generateTextArray({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<string[]> {
    if (!context) {
        elizaLogger.error("generateTextArray context is empty");
        return [];
    }
    let retryDelay = 1000;

    while (true) {
        try {
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });

            const parsedResponse = parseJsonArrayFromText(response);
            if (parsedResponse) {
                return parsedResponse;
            }
        } catch (error) {
            elizaLogger.error("Error in generateTextArray:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

export async function generateObjectDEPRECATED({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<any> {
    if (!context) {
        elizaLogger.error("generateObjectDEPRECATED context is empty");
        return null;
    }
    let retryDelay = 1000;

    while (true) {
        try {
            // this is slightly different than generateObjectArray, in that we parse object, not object array
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });
            const parsedResponse = parseJSONObjectFromText(response);
            if (parsedResponse) {
                return parsedResponse;
            }
        } catch (error) {
            elizaLogger.error("Error in generateObject:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

export async function generateObjectArray({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<any[]> {
    if (!context) {
        elizaLogger.error("generateObjectArray context is empty");
        return [];
    }
    let retryDelay = 1000;

    while (true) {
        try {
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });

            const parsedResponse = parseJsonArrayFromText(response);
            if (parsedResponse) {
                return parsedResponse;
            }
        } catch (error) {
            elizaLogger.error("Error in generateTextArray:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

/**
 * Send a message to the model for generateText.
 * @param opts - The options for the generateText request.
 * @param opts.context The context of the message to be completed.
 * @param opts.stop A list of strings to stop the generateText at.
 * @param opts.model The model to use for generateText.
 * @param opts.frequency_penalty The frequency penalty to apply to the generateText.
 * @param opts.presence_penalty The presence penalty to apply to the generateText.
 * @param opts.temperature The temperature to apply to the generateText.
 * @param opts.max_context_length The maximum length of the context to apply to the generateText.
 * @returns The completed message.
 */
export async function generateMessageResponse({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<Content> {
    const max_context_length =
        models[runtime.modelProvider].settings.maxInputTokens;
    context = trimTokens(context, max_context_length, "gpt-4o");
    let retryLength = 1000; // exponential backoff
    while (true) {
        try {
            elizaLogger.log("Generating message response..");

            const response = await generateText({
                runtime,
                context,
                modelClass,
            });

            // try parsing the response as JSON, if null then try again
            const parsedContent = parseJSONObjectFromText(response) as Content;
            if (!parsedContent) {
                elizaLogger.debug("parsedContent is null, retrying");
                continue;
            }

            return parsedContent;
        } catch (error) {
            elizaLogger.error("ERROR:", error);
            // wait for 2 seconds
            retryLength *= 2;
            await new Promise((resolve) => setTimeout(resolve, retryLength));
            elizaLogger.debug("Retrying...");
        }
    }
}

export const generateImage = async (
    data: {
        prompt: string;
        width: number;
        height: number;
        count?: number;
        negativePrompt?: string;
        numIterations?: number;
        guidanceScale?: number;
        seed?: number;
        modelId?: string;
        jobId?: string;
    },
    runtime: IAgentRuntime
): Promise<{
    success: boolean;
    data?: string[];
    error?: any;
}> => {
    const model = getModel(runtime.imageModelProvider, ModelClass.IMAGE);
    const modelSettings = models[runtime.imageModelProvider].imageSettings;

    elizaLogger.info("Generating image with options:", {
        imageModelProvider: model,
    });

    const apiKey =
        runtime.imageModelProvider === runtime.modelProvider
            ? runtime.token
            : (runtime.getSetting("HEURIST_API_KEY") ??
              runtime.getSetting("TOGETHER_API_KEY") ??
              runtime.getSetting("FAL_API_KEY") ??
              runtime.getSetting("OPENAI_API_KEY"));

    try {
        if (runtime.imageModelProvider === ModelProviderName.HEURIST) {
            const response = await fetch(
                "http://sequencer.heurist.xyz/submit_job",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        job_id: data.jobId || crypto.randomUUID(),
                        model_input: {
                            SD: {
                                prompt: data.prompt,
                                neg_prompt: data.negativePrompt,
                                num_iterations: data.numIterations || 20,
                                width: data.width || 512,
                                height: data.height || 512,
                                guidance_scale: data.guidanceScale || 3,
                                seed: data.seed || -1,
                            },
                        },
                        model_id: data.modelId || "FLUX.1-dev",
                        deadline: 60,
                        priority: 1,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Heurist image generation failed: ${response.statusText}`
                );
            }

            const imageURL = await response.json();
            return { success: true, data: [imageURL] };
        } else if (
            runtime.imageModelProvider === ModelProviderName.TOGETHER ||
            // for backwards compat
            runtime.imageModelProvider === ModelProviderName.LLAMACLOUD
        ) {
            const together = new Together({ apiKey: apiKey as string });
            const response = await together.images.create({
                model: "black-forest-labs/FLUX.1-schnell",
                prompt: data.prompt,
                width: data.width,
                height: data.height,
                steps: modelSettings?.steps ?? 4,
                n: data.count,
            });

            // Add type assertion to handle the response properly
            const togetherResponse =
                response as unknown as TogetherAIImageResponse;

            if (
                !togetherResponse.data ||
                !Array.isArray(togetherResponse.data)
            ) {
                throw new Error("Invalid response format from Together AI");
            }

            // Rest of the code remains the same...
            const base64s = await Promise.all(
                togetherResponse.data.map(async (image) => {
                    if (!image.url) {
                        elizaLogger.error("Missing URL in image data:", image);
                        throw new Error("Missing URL in Together AI response");
                    }

                    // Fetch the image from the URL
                    const imageResponse = await fetch(image.url);
                    if (!imageResponse.ok) {
                        throw new Error(
                            `Failed to fetch image: ${imageResponse.statusText}`
                        );
                    }

                    // Convert to blob and then to base64
                    const blob = await imageResponse.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString("base64");

                    // Return with proper MIME type
                    return `data:image/jpeg;base64,${base64}`;
                })
            );

            if (base64s.length === 0) {
                throw new Error("No images generated by Together AI");
            }

            elizaLogger.debug(`Generated ${base64s.length} images`);
            return { success: true, data: base64s };
        } else if (runtime.imageModelProvider === ModelProviderName.FAL) {
            fal.config({
                credentials: apiKey as string,
            });

            // Prepare the input parameters according to their schema
            const input = {
                prompt: data.prompt,
                image_size: "square" as const,
                num_inference_steps: modelSettings?.steps ?? 50,
                guidance_scale: data.guidanceScale || 3.5,
                num_images: data.count,
                enable_safety_checker: true,
                output_format: "png" as const,
                seed: data.seed ?? 6252023,
                ...(runtime.getSetting("FAL_AI_LORA_PATH")
                    ? {
                          loras: [
                              {
                                  path: runtime.getSetting("FAL_AI_LORA_PATH"),
                                  scale: 1,
                              },
                          ],
                      }
                    : {}),
            };

            // Subscribe to the model
            const result = await fal.subscribe(model as string, {
                input,
                logs: true,
                onQueueUpdate: (update) => {
                    if (update.status === "IN_PROGRESS") {
                        elizaLogger.info(update.logs.map((log) => log.message));
                    }
                },
            });

            // Convert the returned image URLs to base64 to match existing functionality
            const base64Promises = result.data.images.map(async (image: { url: string; content_type: string }) => {
                const response = await fetch(image.url);
                const blob = await response.blob();
                const buffer = await blob.arrayBuffer();
                const base64 = Buffer.from(buffer).toString("base64");
                return `data:${image.content_type};base64,${base64}`;
            });

            const base64s = await Promise.all(base64Promises);
            return { success: true, data: base64s };
        } else {
            let targetSize = `${data.width}x${data.height}`;
            if (
                targetSize !== "1024x1024" &&
                targetSize !== "1792x1024" &&
                targetSize !== "1024x1792"
            ) {
                targetSize = "1024x1024";
            }
            const openaiApiKey = runtime.getSetting("OPENAI_API_KEY") as string;
            if (!openaiApiKey) {
                throw new Error("OPENAI_API_KEY is not set");
            }
            const openai = new OpenAI({
                apiKey: openaiApiKey as string,
            });
            const response = await openai.images.generate({
                model,
                prompt: data.prompt,
                size: targetSize as "1024x1024" | "1792x1024" | "1024x1792",
                n: data.count,
                response_format: "b64_json",
            });
            const base64s = response.data.map(
                (image) => `data:image/png;base64,${image.b64_json}`
            );
            return { success: true, data: base64s };
        }
    } catch (error) {
        console.error(error);
        return { success: false, error: error };
    }
};

export const generateCaption = async (
    data: { imageUrl: string },
    runtime: IAgentRuntime
): Promise<{
    title: string;
    description: string;
}> => {
    const { imageUrl } = data;
    const imageDescriptionService =
        runtime.getService<IImageDescriptionService>(
            ServiceType.IMAGE_DESCRIPTION
        );

    if (!imageDescriptionService) {
        throw new Error("Image description service not found");
    }

    const resp = await imageDescriptionService.describeImage(imageUrl);
    return {
        title: resp.title.trim(),
        description: resp.description.trim(),
    };
};

export const generateWebSearch = async (
    query: string,
    runtime: IAgentRuntime
): Promise<SearchResponse> => {
    const apiUrl = "https://api.tavily.com/search";
    const apiKey = runtime.getSetting("TAVILY_API_KEY");

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                include_answer: true,
            }),
        });

        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            elizaLogger.error(error);
            throw error;
        }

        const data: SearchResponse = await response.json();
        return data;
    } catch (error) {
        elizaLogger.error("Error:", error);
        throw error; // Re-throw to maintain Promise<SearchResponse> return type
    }
};
/**
 * Configuration options for generating objects with a model.
 */
export interface GenerationOptions {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
    schema?: ZodSchema;
    schemaName?: string;
    schemaDescription?: string;
    stop?: string[];
    mode?: "json";  // Must be 'json' or undefined when using no-schema output
    experimental_providerMetadata?: Record<string, unknown>;
}

/**
 * Base settings for model generation.
 */
interface ModelSettings {
    prompt: string;
    temperature: number;
    maxTokens: number;
    frequencyPenalty: number;
    presencePenalty: number;
    stop?: string[];
}

/**
 * Generates structured objects from a prompt using specified AI models and configuration options.
 *
 * @param {GenerationOptions} options - Configuration options for generating objects.
 * @returns {Promise<any[]>} - A promise that resolves to an array of generated objects.
 * @throws {Error} - Throws an error if the provider is unsupported or if generation fails.
 */
export const generateObjectV2 = async ({
    runtime,
    context,
    modelClass,
    schema,
    schemaName,
    schemaDescription,
    stop,
    mode = 'json', // Default to 'json' for no-schema output
}: GenerationOptions): Promise<GenerateObjectResult<unknown>> => {
    if (!context) {
        const errorMessage = "generateObjectV2 context is empty";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const provider = runtime.modelProvider;
    const model = models[provider].model[modelClass] as TiktokenModel;
    if (!model) {
        throw new Error(`Unsupported model class: ${modelClass}`);
    }
    const temperature = models[provider].settings.temperature ?? 0.7;
    const frequency_penalty = models[provider].settings.frequency_penalty ?? 0;
    const presence_penalty = models[provider].settings.presence_penalty ?? 0;
    const max_context_length = models[provider].settings.maxInputTokens;
    const max_response_length = models[provider].settings.maxOutputTokens;
    const apiKey = runtime.token ?? '';

    try {
        context = trimTokens(context, max_context_length, model);

        const modelOptions: ModelSettings = {
            prompt: context,
            temperature,
            maxTokens: max_response_length,
            frequencyPenalty: frequency_penalty,
            presencePenalty: presence_penalty,
            stop: stop || models[provider].settings.stop,
        };

        const response = await handleProvider({
            provider,
            model,
            apiKey,
            schema,
            schemaName,
            schemaDescription,
            mode,
            modelOptions,
            runtime,
            context,
            modelClass,
        });

        return response;
    } catch (error) {
        console.error("Error in generateObject:", error);
        throw error;
    }
};

/**
 * Interface for provider-specific generation options.
 */
interface ProviderOptions {
    runtime: IAgentRuntime;
    provider: ModelProviderName;
    model: any;
    apiKey: string;
    schema?: ZodSchema;
    schemaName?: string;
    schemaDescription?: string;
    mode?: "json";  // Changed from "auto" | "json" | "tool" to just "json"
    experimental_providerMetadata?: Record<string, unknown>;
    modelOptions: ModelSettings;
    modelClass: string;
    context: string;
    prompt?: string;
    messages?: Array<CoreMessage>;
    system?: string;
}

/**
 * Handles AI generation based on the specified provider.
 *
 * @param {ProviderOptions} options - Configuration options specific to the provider.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to a generated object result.
 */
export async function handleProvider(
    options: ProviderOptions
): Promise<GenerateObjectResult<unknown>> {
    const { provider, runtime, context, modelClass } = options;
    switch (provider) {
        case ModelProviderName.OPENAI:
            return await handleOpenAI(options);
        case ModelProviderName.ANTHROPIC:
            return await handleAnthropic(options);
        case ModelProviderName.OLLAMA:
            return await handleOllama(options);
        case ModelProviderName.LLAMALOCAL:
            return await generateObjectDEPRECATED({
                runtime,
                context,
                modelClass,
            });
        default: {
            const errorMessage = `Unsupported provider: ${provider}`;
            elizaLogger.error(errorMessage);
            throw new Error(errorMessage);
        }
    }
}

async function handleOpenAI({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    modelOptions,
    prompt,
    messages,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const baseURL = models.openai.endpoint || undefined;
    const openai = createOpenAI({ apiKey, baseURL });
    const result = await generateObject({
        model: openai.languageModel(model as string),
        messages,
        prompt,
        output: 'no-schema' as const,
        mode: 'json' as 'json', // Must be explicitly 'json' when output is 'no-schema'
        temperature: modelOptions.temperature,
        maxTokens: modelOptions.maxTokens,
        frequencyPenalty: modelOptions.frequencyPenalty,
        presencePenalty: modelOptions.presencePenalty,
    });
    return result;
}

async function handleAnthropic({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    modelOptions,
    prompt,
    messages,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const anthropic = createAnthropic({ apiKey });
    const result = await generateObject({
        model: anthropic.languageModel(model as string),
        messages,
        prompt,
        output: 'no-schema' as const,
        mode: 'json' as 'json', // Must be explicitly 'json' when output is 'no-schema'
        temperature: modelOptions.temperature,
        maxTokens: modelOptions.maxTokens,
        frequencyPenalty: modelOptions.frequencyPenalty,
        presencePenalty: modelOptions.presencePenalty,
    });
    return result;
}

async function handleOllama({
    model,
    provider,
    schema,
    schemaName,
    schemaDescription,
    modelOptions,
    prompt,
    messages,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const ollamaProvider = createOllama({
        baseURL: models[provider].endpoint + "/api",
    });
    const ollama = ollamaProvider(model);
    const result = await generateObject({
        model: ollama,
        messages,
        prompt,
        output: 'no-schema' as const,
        mode: 'json' as 'json', // Must be explicitly 'json' when output is 'no-schema'
        temperature: modelOptions.temperature,
        maxTokens: modelOptions.maxTokens,
        frequencyPenalty: modelOptions.frequencyPenalty,
        presencePenalty: modelOptions.presencePenalty,
    });
    return result;
}

// Add type definition for Together AI response
interface TogetherAIImageResponse {
    data: Array<{
        url: string;
        content_type?: string;
        image_type?: string;
    }>;
}

export async function generateTweetActions({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<ActionResponse | null> {
    let retryDelay = 1000;
    while (true) {
        try {
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });
            console.debug("Received response from generateText for tweet actions:", response);
            const { actions } = parseActionResponseFromText(response.trim());
            if (actions) {
                console.debug("Parsed tweet actions:", actions);
                return actions;
            } else {
                elizaLogger.debug("generateTweetActions no valid response");
            }
        } catch (error) {
            elizaLogger.error("Error in generateTweetActions:", error);
            if (
                error instanceof TypeError &&
                error.message.includes("queueTextCompletion")
            ) {
                elizaLogger.error(
                    "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
                );
            }
        }
        elizaLogger.log(`Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}
