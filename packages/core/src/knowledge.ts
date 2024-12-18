import { AgentRuntime } from "./runtime.js";
import { embed, getEmbeddingZeroVector } from "./embedding.js";
import { KnowledgeItem, UUID, type Memory } from "./types.js";
import { stringToUuid } from "./uuid.js";
import { splitChunks } from "./generation.js";
import elizaLogger from "./logger.js";

class KnowledgeManager {
    constructor(private runtime: AgentRuntime) {}

    async get(message: Memory): Promise<KnowledgeItem[]> {
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

        if (!processed || processed.trim().length === 0) {
            elizaLogger.warn("Empty processed text for knowledge query");
            return [];
        }

        const embedding = await embed(this.runtime, processed);
        const fragments = await this.runtime.knowledgeManager.searchMemoriesByEmbedding(
            embedding,
            {
                roomId: message.agentId,
                count: 5,
                match_threshold: 0.1,
            }
        );

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
                this.runtime.documentsManager.getMemoryById(source as UUID)
            )
        );

        return knowledgeDocuments
            .filter((memory): memory is NonNullable<typeof memory> =>
                memory !== null &&
                typeof memory.id === 'string' &&
                memory.id.length > 0
            )
            .map((memory) => ({
                id: memory.id as UUID,
                content: memory.content
            }));
    }

    async set(
        item: KnowledgeItem,
        chunkSize: number = 512,
        bleed: number = 20
    ) {
        await this.runtime.documentsManager.createMemory({
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
            await this.runtime.knowledgeManager.createMemory({
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

// Export standalone preprocess function that uses KnowledgeManager's implementation
export function preprocess(content: string): string {
    const manager = new KnowledgeManager(null);
    return manager.preprocess(content);
}

export default KnowledgeManager;
