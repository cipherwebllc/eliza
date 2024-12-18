import { IAgentRuntime, IMemoryManager, Memory, UUID } from "./types.js";
import { stringToUuid } from "./uuid.js";

export class DocumentsManager implements IMemoryManager {
    runtime: IAgentRuntime;
    tableName = "documents";

    constructor({ runtime }: { runtime: IAgentRuntime }) {
        this.runtime = runtime;
    }

    async addEmbeddingToMemory(memory: Memory): Promise<Memory> {
        return memory;
    }

    async getMemories(opts: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        start?: number;
        end?: number;
    }): Promise<Memory[]> {
        return [];
    }

    async getCachedEmbeddings(
        content: string
    ): Promise<{ embedding: number[]; levenshtein_score: number }[]> {
        return [];
    }

    async getMemoryById(id: UUID): Promise<Memory | null> {
        return null;
    }

    async getMemoriesByRoomIds(params: { roomIds: UUID[] }): Promise<Memory[]> {
        return [];
    }

    async searchMemoriesByEmbedding(
        embedding: number[],
        opts: {
            match_threshold?: number;
            count?: number;
            roomId: UUID;
            unique?: boolean;
        }
    ): Promise<Memory[]> {
        return [];
    }

    async createMemory(memory: Memory, unique?: boolean): Promise<void> {
        // Implementation
    }

    async removeMemory(memoryId: UUID): Promise<void> {
        // Implementation
    }

    async removeAllMemories(roomId: UUID): Promise<void> {
        // Implementation
    }

    async countMemories(roomId: UUID, unique?: boolean): Promise<number> {
        return 0;
    }
}
