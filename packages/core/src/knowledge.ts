import { AgentRuntime } from "./runtime.js";
import { embed, getEmbeddingZeroVector } from "./embedding.js";
import { KnowledgeItem, UUID, type Memory, IMemoryManager } from "./types.js";
import { stringToUuid } from "./uuid.js";
import { splitChunks } from "./generation.js";
import elizaLogger from "./logger.js";
import { MemoryManager } from "./memory.js";

export class KnowledgeManager extends MemoryManager implements IMemoryManager {
    constructor(opts: { runtime: any; tableName: string }) {
        super(opts);
    }

    async get(message: Memory): Promise<Memory[]> {
        // Add validation for message
        if (!message?.content?.text) {
            elizaLogger.warn("Invalid message for knowledge query:", {
                message,
                content: message?.content,
                text: message?.content?.text,
            });
            return [];
        }

        const processed = this.preprocess(message.content.text);
        elizaLogger.debug("Knowledge query:", {
            original: message.content.text,
            processed,
            length: processed?.length,
        });

        // Validate processed text
        if (!processed || processed.trim().length === 0) {
            elizaLogger.warn("Empty processed text for knowledge query");
            return [];
        }

        const embedding = await embed(this.runtime, processed);
        const fragments = await this.searchMemoriesByEmbedding(embedding, {
            roomId: message.agentId,
            count: 5,
            match_threshold: 0.1,
        });

        const uniqueSources = [
            ...new Set(
                fragments.map((memory) => {
                    elizaLogger.log(
                        `Matched fragment: ${memory.content.text} with similarity: ${memory.similarity}`
                    );
                    return memory.content.source;
                })
            ),
        ];

        const knowledgeDocuments = await Promise.all(
            uniqueSources.map((source) =>
                this.getMemoryById(source as UUID)
            )
        );

        return knowledgeDocuments.filter((memory): memory is Memory => memory !== null);
    }

    async set(
        item: KnowledgeItem & { id: UUID },
        chunkSize: number = 512,
        bleed: number = 20
    ): Promise<void> {
        await this.createMemory({
            id: item.id,
            agentId: this.runtime.agentId,
            roomId: this.runtime.agentId,
            userId: this.runtime.agentId,
            createdAt: Date.now(),
            content: item.content,
            embedding: getEmbeddingZeroVector(),
        });

        const preprocessed = this.preprocess(item.content.text);
        const fragments = await splitChunks(preprocessed, chunkSize, bleed);

        for (const fragment of fragments) {
            const embedding = await embed(this.runtime, fragment);
            await this.createMemory({
                id: stringToUuid(item.id + fragment),
                roomId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                userId: this.runtime.agentId,
                createdAt: Date.now(),
                content: {
                    source: item.id,
                    text: fragment,
                },
                embedding,
            });
        }
    }

    public preprocess(content: string): string {
        elizaLogger.debug("Preprocessing text:", {
            input: content,
            length: content?.length,
        });

        if (!content || typeof content !== "string") {
            elizaLogger.warn("Invalid input for preprocessing");
            return "";
        }

        return (
            content
                .replace(/```[\s\S]*?```/g, "")
                .replace(/`.*?`/g, "")
                .replace(/#{1,6}\s*(.*)/g, "$1")
                .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
                .replace(/\[(.*?)\]\(.*?\)/g, "$1")
                .replace(/(https?:\/\/)?(www\.)?([^\s]+\.[^\s]+)/g, "$3")
                .replace(/<@[!&]?\d+>/g, "")
                .replace(/<[^>]*>/g, "")
                .replace(/^\s*[-*_]{3,}\s*$/gm, "")
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/\/\/.*/g, "")
                .replace(/\s+/g, " ")
                .replace(/\n{3,}/g, "\n\n")
                .replace(/[^a-zA-Z0-9\s\-_./:?=&]/g, "")
                .trim()
                .toLowerCase()
        );
    }
}

// Export a default instance for backward compatibility
export default {
    get: (runtime: AgentRuntime, message: Memory) => {
        const manager = new KnowledgeManager({ runtime, tableName: "fragments" });
        return manager.get(message);
    },
    set: (runtime: AgentRuntime, item: KnowledgeItem & { id: UUID }, chunkSize?: number, bleed?: number) => {
        const manager = new KnowledgeManager({ runtime, tableName: "fragments" });
        return manager.set(item, chunkSize, bleed);
    },
    preprocess: (content: string) => {
        const manager = new KnowledgeManager({ runtime: null, tableName: "" });
        return manager.preprocess(content);
    }
};
