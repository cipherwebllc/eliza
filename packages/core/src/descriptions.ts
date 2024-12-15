import { IMemoryManager, Memory, UUID, IAgentRuntime } from "./types.js";
import { MemoryManager } from "./memory.js";

export class DescriptionManager extends MemoryManager implements IMemoryManager {
    constructor(opts: { runtime: IAgentRuntime; tableName: string }) {
        super(opts);
    }

    async get(message: Memory): Promise<Memory[]> {
        return this.getMemories({
            roomId: message.roomId,
            count: 10,
            unique: true
        });
    }
}
