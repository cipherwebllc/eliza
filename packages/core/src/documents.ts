import { IMemoryManager, Memory, UUID } from "./types.js";
import { stringToUuid } from "./uuid.js";

export class DocumentsManager implements IMemoryManager {
    tableName = "documents";

    async get(id: UUID): Promise<Memory | null> {
        return null;
    }

    async set(item: Partial<Memory>): Promise<Memory> {
        if (!item.id) {
            item.id = stringToUuid(crypto.randomUUID());
        }
        return item as Memory;
    }
}
