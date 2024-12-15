import { v4 as uuidv4 } from "uuid";
import { stringToUuid } from "./uuid.js";
import { defaultCharacter } from "./defaultCharacter.js";
import { elizaLogger } from "./logger.js";
import {
    UUID,
    Character,
    Plugin,
    Action,
    Evaluator,
    State,
    IAgentRuntime,
    Service,
    ServiceType,
    IMemoryManager,
    ICacheManager,
    ModelProviderName,
    Actor,
    Goal,
    HandlerCallback,
    Memory,
    Provider,
    IDatabaseAdapter,
    KnowledgeItem
} from "./types.js";
import { MessageManager } from "./messages.js";
import { DescriptionManager } from "./descriptions.js";
import { LoreManager } from "./lore.js";
import { DocumentsManager } from "./documents.js";
import { KnowledgeManager } from "./knowledge.js";
import { CacheManager } from "./cache.js";
import { formatPosts } from "./posts.js";
import { getActorDetails, formatActors, formatMessages } from "./messages.js";
import { formatGoalsAsString, getGoals } from "./goals.js";
import { composeActionExamples, formatActionNames, formatActions } from "./actions.js";
import { evaluationTemplate, formatEvaluatorExamples, formatEvaluatorNames, formatEvaluators } from "./evaluators.js";
import { getProviders } from "./providers.js";

/**
 * Represents the runtime environment for an agent, handling message processing,
 * action registration, and interaction with external services like OpenAI and Supabase.
 */
export class AgentRuntime implements IAgentRuntime {
    readonly #conversationLength: number = 10;
    readonly memoryManagers: Map<string, IMemoryManager> = new Map();
    readonly services: Map<ServiceType, Service> = new Map();

    messageManager: IMemoryManager;
    descriptionManager: IMemoryManager;
    loreManager: IMemoryManager;
    documentsManager: IMemoryManager;
    knowledgeManager: IMemoryManager;
    cacheManager: ICacheManager;
    databaseAdapter: IDatabaseAdapter;
    modelProvider: ModelProviderName;
    imageModelProvider: ModelProviderName;
    character: Character;
    agentId: UUID;
    token: string | null;
    serverUrl: string = "http://localhost:3000";
    evaluators: Evaluator[] = [];
    actions: Action[] = [];
    plugins: Plugin[] = [];
    providers: Provider[] = [];
    fetch: typeof fetch = globalThis.fetch;
    private settings: Record<string, unknown>;
    constructor(opts: {
        conversationLength?: number;
        agentId?: UUID;
        character?: Character;
        token: string;
        serverUrl?: string;
        actions?: Action[];
        evaluators?: Evaluator[];
        plugins?: Plugin[];
        providers?: Provider[];
        modelProvider: ModelProviderName;
        services?: Service[];
        managers?: IMemoryManager[];
        databaseAdapter: IDatabaseAdapter;
        fetch?: typeof fetch;
        speechModelPath?: string;
        cacheManager: ICacheManager;
        logging?: boolean;
    }) {
        elizaLogger.info("Initializing AgentRuntime with options:", {
            character: opts.character?.name,
            modelProvider: opts.modelProvider,
            characterModelProvider: opts.character?.modelProvider,
        });

        // Initialize required properties
        this.modelProvider = opts.modelProvider;
        this.#conversationLength = opts.conversationLength ?? this.#conversationLength;
        this.databaseAdapter = opts.databaseAdapter;
        this.agentId = opts.character?.id ?? opts?.agentId ?? stringToUuid(opts.character?.name ?? uuidv4());
        this.character = opts.character || defaultCharacter;
        this.settings = opts.character?.settings || {};
        this.token = opts.token;
        this.evaluators = opts.evaluators || [];
        this.actions = opts.actions || [];
        this.plugins = opts.plugins || [];
        this.providers = opts.providers || [];

        // By convention, we create a user and room using the agent id.
        // Memories related to it are considered global context for the agent.
        this.ensureRoomExists(this.agentId);
        this.ensureUserExists(this.agentId, this.character.name, this.character.name);
        this.ensureParticipantExists(this.agentId, this.agentId);

        elizaLogger.success("Agent ID", this.agentId);

        this.fetch = (opts.fetch as typeof fetch) ?? this.fetch;
        if (!opts.databaseAdapter) {
            throw new Error("No database adapter provided");
        }

        this.cacheManager = opts.cacheManager;

        // Initialize memory managers
        this.messageManager = new MessageManager({
            runtime: this,
            tableName: "messages",
        });

        this.descriptionManager = new DescriptionManager({
            runtime: this,
            tableName: "descriptions",
        });

        this.loreManager = new LoreManager({
            runtime: this,
            tableName: "lore",
        });

        this.documentsManager = new DocumentsManager({
            runtime: this,
            tableName: "documents",
        });

        this.knowledgeManager = new KnowledgeManager({
            runtime: this,
            tableName: "fragments",
        });

        // Register additional managers and services
        (opts.managers ?? []).forEach((manager: IMemoryManager) => {
            this.registerMemoryManager(manager);
        });

        (opts.services ?? []).forEach((service: Service) => {
            this.registerService(service);
        });

        this.serverUrl = opts.serverUrl ?? this.serverUrl;

        // Update model provider based on character settings
        elizaLogger.info("Setting model provider...");
        elizaLogger.info("Model Provider Selection:", {
            characterModelProvider: this.character.modelProvider,
            optsModelProvider: opts.modelProvider,
            currentModelProvider: this.modelProvider,
            finalSelection: this.character.modelProvider ?? opts.modelProvider ?? this.modelProvider,
        });

        this.modelProvider = this.character.modelProvider ?? opts.modelProvider ?? this.modelProvider;
        this.imageModelProvider = this.character.imageModelProvider ?? this.modelProvider;

        elizaLogger.info("Selected model provider:", this.modelProvider);
        elizaLogger.info("Selected image model provider:", this.imageModelProvider);

        // Validate model provider
        if (!Object.values(ModelProviderName).includes(this.modelProvider)) {
            elizaLogger.error("Invalid model provider:", this.modelProvider);
            elizaLogger.error("Available providers:", Object.values(ModelProviderName));
            throw new Error(`Invalid model provider: ${this.modelProvider}`);
        }

        if (!this.serverUrl) {
            elizaLogger.warn("No serverUrl provided, defaulting to localhost");
        }

        this.plugins = [...(opts.character?.plugins ?? []), ...(opts.plugins ?? [])].filter((p): p is Plugin => typeof p === 'object' && p !== null);

        this.plugins.forEach((plugin) => {
            plugin.actions?.forEach((action) => {
                this.registerAction(action);
            });

            plugin.evaluators?.forEach((evaluator) => {
                this.registerEvaluator(evaluator);
            });

            plugin.services?.forEach((service) => {
                this.registerService(service);
            });

            plugin.providers?.forEach((provider) => {
                this.registerContextProvider(provider);
            });
        });

        (opts.actions ?? []).forEach((action) => {
            this.registerAction(action);
        });

        (opts.providers ?? []).forEach((provider) => {
            this.registerContextProvider(provider);
        });

        (opts.evaluators ?? []).forEach((evaluator: Evaluator) => {
            this.registerEvaluator(evaluator);
        });
    }

    registerMemoryManager(manager: IMemoryManager): void {
        if (!manager.tableName) {
            throw new Error("Memory manager must have a tableName");
        }

        if (this.memoryManagers.has(manager.tableName)) {
            elizaLogger.warn(
                `Memory manager ${manager.tableName} is already registered. Skipping registration.`
            );
            return;
        }

        this.memoryManagers.set(manager.tableName, manager);
    }

    getMemoryManager(tableName: string): IMemoryManager | null {
        return this.memoryManagers.get(tableName) || null;
    }

    getService<T extends Service>(service: ServiceType): T | null {
        const serviceInstance = this.services.get(service);
        if (!serviceInstance) {
            elizaLogger.error(`Service ${service} not found`);
            return null;
        }
        return serviceInstance as T;
    }

    async registerService(service: Service): Promise<void> {
        const serviceType = service.serviceType;
        elizaLogger.log("Registering service:", serviceType);

        if (this.services.has(serviceType)) {
            elizaLogger.warn(
                `Service ${serviceType} is already registered. Skipping registration.`
            );
            return;
        }

        // Add the service to the services map
        this.services.set(serviceType, service);
        elizaLogger.success(`Service ${serviceType} registered successfully`);
    }

    async initialize() {
        for (const [serviceType, service] of this.services.entries()) {
            try {
                await service.initialize(this);
                this.services.set(serviceType, service);
                elizaLogger.success(
                    `Service ${serviceType} initialized successfully`
                );
            } catch (error) {
                elizaLogger.error(
                    `Failed to initialize service ${serviceType}:`,
                    error
                );
                throw error;
            }
        }

        for (const plugin of this.plugins) {
            if (plugin.services)
                await Promise.all(
                    plugin.services?.map((service) => service.initialize(this))
                );
        }

        if (
            this.character &&
            this.character.knowledge &&
            this.character.knowledge.length > 0
        ) {
            await this.processCharacterKnowledge(this.character.knowledge);
        }
    }

    /**
     * Processes character knowledge by creating document memories and fragment memories.
     * This function takes an array of knowledge items, creates a document memory for each item if it doesn't exist,
     * then chunks the content into fragments, embeds each fragment, and creates fragment memories.
     * @param knowledge An array of knowledge items containing id, path, and content.
     */
    async processCharacterKnowledge(items: Array<KnowledgeItem | string>) {
        for (const item of items) {
            const knowledgeId = stringToUuid(typeof item === 'string' ? item : (item.content?.text || ''));
            const existingDocument =
                await this.knowledgeManager.getMemoryById(knowledgeId);
            if (existingDocument) {
                elizaLogger.debug("Knowledge item already exists:", {
                    id: existingDocument.id,
                    text:
                        typeof item === 'string' ? item.slice(0, 100) : (item.content?.text || '').slice(0, 100)
                });
                continue;
            }

            await this.knowledgeManager.createMemory({
                id: knowledgeId,
                agentId: this.agentId,
                roomId: this.agentId,
                userId: this.agentId,
                content: {
                    text: typeof item === 'string' ? item : (item.content?.text || ''),
                },
            });
        }
    }

    private formatKnowledge(knowledge: Array<KnowledgeItem | string>) {
        return knowledge
            .map((item) => `- ${typeof item === 'string' ? item : item.content?.text || ''}`)
            .join("\n");
    }

    getSetting(key: string): string | null {
        // Define the allowed settings keys type
        type SettingsKey = string;

        // Type guard to check if key is a valid settings key
        const isValidSettingKey = (key: string): key is SettingsKey => {
            return this.character.settings ? key in this.character.settings : false;
        };

        // Check if the key is in the character.settings.secrets object
        if (this.character.settings?.secrets) {
            const secrets = this.character.settings.secrets as unknown as Record<string, string>;
            if (key in secrets) {
                return secrets[key];
            }
        }

        // If not, check if it's in the settings object with type guard
        const settings = this.settings as Record<string, unknown>;
        if (typeof key === 'string' && key in settings) {
            const value = settings[key];
            return typeof value === 'string' ? value : null;
        }

        return null;
    }

    /**
     * Get the number of messages that are kept in the conversation buffer.
     * @returns The number of recent messages to be kept in memory.
     */
    getConversationLength() {
        return this.#conversationLength;
    }

    /**
     * Register an action for the agent to perform.
     * @param action The action to register.
     */
    registerAction(action: Action) {
        elizaLogger.success(`Registering action: ${action.name}`);
        this.actions.push(action);
    }

    /**
     * Register an evaluator to assess and guide the agent's responses.
     * @param evaluator The evaluator to register.
     */
    registerEvaluator(evaluator: Evaluator) {
        this.evaluators.push(evaluator);
    }

    /**
     * Register a context provider to provide context for message generation.
     * @param provider The context provider to register.
     */
    registerContextProvider(provider: Provider) {
        this.providers.push(provider);
    }

    /**
     * Process the actions of a message.
     * @param message The message to process.
     * @param content The content of the message to process actions from.
     */
    async processActions(
        message: Memory,
        responses: Memory[],
        state?: State,
        callback?: HandlerCallback
    ): Promise<void> {
        for (const response of responses) {
            if (!response.content?.action) {
                elizaLogger.warn("No action found in the response content.");
                continue;
            }

            const normalizedAction = response.content.action
                .toLowerCase()
                .replace("_", "");

            elizaLogger.success(`Normalized action: ${normalizedAction}`);

            let action = this.actions.find(
                (a: { name: string }) =>
                    a.name
                        .toLowerCase()
                        .replace("_", "")
                        .includes(normalizedAction) ||
                    normalizedAction.includes(
                        a.name.toLowerCase().replace("_", "")
                    )
            );

            if (!action) {
                elizaLogger.info("Attempting to find action in similes.");
                for (const _action of this.actions) {
                    const simileAction = _action.similes.find(
                        (simile) =>
                            simile
                                .toLowerCase()
                                .replace("_", "")
                                .includes(normalizedAction) ||
                            normalizedAction.includes(
                                simile.toLowerCase().replace("_", "")
                            )
                    );
                    if (simileAction) {
                        action = _action;
                        elizaLogger.success(
                            `Action found in similes: ${action.name}`
                        );
                        break;
                    }
                }
            }

            if (!action) {
                elizaLogger.error(
                    "No action found for",
                    response.content.action
                );
                continue;
            }

            if (!action.handler) {
                elizaLogger.error(`Action ${action.name} has no handler.`);
                continue;
            }

            try {
                elizaLogger.info(
                    `Executing handler for action: ${action.name}`
                );
                await action.handler(this, message, state, {}, callback);
            } catch (error) {
                elizaLogger.error(error);
            }
        }
    }

    /**
     * Evaluate the message and state using the registered evaluators.
     * @param message The message to evaluate.
     * @param state The state of the agent.
     * @param didRespond Whether the agent responded to the message.
     * @param callback The handler callback
     * @returns The results of the evaluation.
     */
    async evaluate(
        message: Memory,
        state?: State,
        didRespond?: boolean,
        callback?: HandlerCallback
    ): Promise<string[]> {
        // Filter out null evaluators and cast to proper type
        const validEvaluators = this.evaluators.filter((e): e is Evaluator => e !== null);
        const context = await this.getEvaluationContext(validEvaluators, message, state);
        const result = await this.processEvaluators(validEvaluators, message, state, context);

        return result;
    }

    async getEvaluationContext(
        evaluators: Evaluator[],
        message: Memory,
        state?: State
    ): Promise<Record<string, unknown>> {
        const context: Record<string, unknown> = {};

        // Add basic context
        context.message = message;
        context.state = state;

        // Allow each evaluator to contribute to context
        for (const evaluator of evaluators) {
            if (evaluator.prepareContext) {
                Object.assign(context, await evaluator.prepareContext(message, state));
            }
        }

        return context;
    }

    async processEvaluators(
        evaluators: Evaluator[],
        message: Memory,
        state?: State,
        context?: Record<string, unknown>
    ): Promise<string[]> {
        const results: string[] = [];

        for (const evaluator of evaluators) {
            if (await evaluator.validate(this, message, state)) {
                const result = await evaluator.evaluate(message, state, context);
                if (result) {
                    results.push(result);
                }
            }
        }

        return results;
    }

    /**
     * Ensure the existence of a participant in the room. If the participant does not exist, they are added to the room.
     * @param userId - The user ID to ensure the existence of.
     * @throws An error if the participant cannot be added.
     */
    async ensureParticipantExists(userId: UUID, roomId: UUID) {
        const participants =
            await this.databaseAdapter.getParticipantsForAccount(userId);

        if (participants?.length === 0) {
            await this.databaseAdapter.addParticipant(userId, roomId);
        }
    }

    /**
     * Ensure the existence of a user in the database. If the user does not exist, they are added to the database.
     * @param userId - The user ID to ensure the existence of.
     * @param userName - The user name to ensure the existence of.
     * @returns
     */

    async ensureUserExists(
        userId: UUID,
        userName: string | null,
        name: string | null,
        email?: string | null,
        source?: string | null
    ) {
        const account = await this.databaseAdapter.getAccountById(userId);
        if (!account) {
            await this.databaseAdapter.createAccount({
                id: userId,
                name: name || userName || "Unknown User",
                username: userName || name || "Unknown",
                email: email || (userName || "Bot") + "@" + source || "Unknown", // Temporary
                details: { summary: "" },
            });
            elizaLogger.success(`User ${userName} created successfully.`);
        }
    }

    async ensureParticipantInRoom(userId: UUID, roomId: UUID) {
        const participants =
            await this.databaseAdapter.getParticipantsForRoom(roomId);
        if (!participants.includes(userId)) {
            await this.databaseAdapter.addParticipant(userId, roomId);
            if (userId === this.agentId) {
                elizaLogger.log(
                    `Agent ${this.character.name} linked to room ${roomId} successfully.`
                );
            } else {
                elizaLogger.log(
                    `User ${userId} linked to room ${roomId} successfully.`
                );
            }
        }
    }

    async ensureConnection(
        userId: UUID,
        roomId: UUID,
        userName?: string,
        userScreenName?: string,
        source?: string
    ) {
        await Promise.all([
            this.ensureUserExists(
                this.agentId,
                this.character.name ?? "Agent",
                this.character.name ?? "Agent",
                source
            ),
            this.ensureUserExists(
                userId,
                userName ?? "User" + userId,
                userScreenName ?? "User" + userId,
                source
            ),
            this.ensureRoomExists(roomId),
        ]);

        await Promise.all([
            this.ensureParticipantInRoom(userId, roomId),
            this.ensureParticipantInRoom(this.agentId, roomId),
        ]);
    }

    /**
     * Ensure the existence of a room between the agent and a user. If no room exists, a new room is created and the user
     * and agent are added as participants. The room ID is returned.
     * @param userId - The user ID to create a room with.
     * @returns The room ID of the room between the agent and the user.
     * @throws An error if the room cannot be created.
     */
    async ensureRoomExists(roomId: UUID) {
        const room = await this.databaseAdapter.getRoom(roomId);
        if (!room) {
            await this.databaseAdapter.createRoom(roomId);
            elizaLogger.log(`Room ${roomId} created successfully.`);
        }
    }

    /**
     * Compose the state of the agent into an object that can be passed or used for response generation.
     * @param message The message to compose the state from.
     * @returns The state of the agent.
     */
    async composeState(
        message: Memory,
        additionalKeys: { [key: string]: unknown } = {}
    ) {
        const { userId, roomId } = message;

        const conversationLength = this.getConversationLength();

        const [actorsData, recentMessagesData, goalsData]: [
            Actor[],
            Memory[],
            Goal[],
        ] = await Promise.all([
            getActorDetails({ runtime: this, roomId }),
            this.messageManager.getMemories({
                roomId,
                count: conversationLength,
                unique: false,
            }),
            getGoals({
                runtime: this,
                count: 10,
                onlyInProgress: false,
                roomId,
            }),
        ]);

        const goals = formatGoalsAsString({ goals: goalsData });

        const actors = formatActors({ actors: actorsData ?? [] });

        const recentMessages = formatMessages({
            messages: recentMessagesData,
            actors: actorsData,
        });

        const recentPosts = formatPosts({
            messages: recentMessagesData,
            actors: actorsData,
            conversationHeader: false,
        });

        // const lore = formatLore(loreData);

        const senderName = actorsData?.find(
            (actor: Actor) => actor.id === userId
        )?.name;

        // TODO: We may wish to consolidate and just accept character.name here instead of the actor name
        const agentName =
            actorsData?.find((actor: Actor) => actor.id === this.agentId)
                ?.name || this.character.name;

        let allAttachments = message.content.attachments || [];

        if (recentMessagesData && Array.isArray(recentMessagesData)) {
            const lastMessageWithAttachment = recentMessagesData.find(
                (msg) =>
                    msg.content.attachments &&
                    msg.content.attachments.length > 0
            );

            if (lastMessageWithAttachment) {
                const lastMessageTime = lastMessageWithAttachment.createdAt;
                const oneHourBeforeLastMessage = (lastMessageTime ?? Date.now()) - 60 * 60 * 1000; // 1 hour before last message

                allAttachments = recentMessagesData
                    .reverse()
                    .map((msg) => {
                        const msgTime = msg.createdAt ?? Date.now();
                        const isWithinTime =
                            msgTime >= oneHourBeforeLastMessage;
                        const attachments = msg.content.attachments || [];
                        if (!isWithinTime) {
                            attachments.forEach((attachment) => {
                                attachment.text = "[Hidden]";
                            });
                        }
                        return attachments;
                    })
                    .flat();
            }
        }

        const formattedAttachments = allAttachments
            .map(
                (attachment) =>
                    `ID: ${attachment.id}
Name: ${attachment.title}
URL: ${attachment.url}
Type: ${attachment.source}
Description: ${attachment.description}
Text: ${attachment.text}
  `
            )
            .join("\n");

        // Format character lore examples
        const shuffledLore = this.character.lore
            ? Array.isArray(this.character.lore)
                ? [...this.character.lore].sort(() => 0.5 - Math.random())
                : [this.character.lore]
            : [];

        const formattedCharacterPostExamples = this.character.postExamples
            ? this.character.postExamples.join("\n")
            : "";

        const formattedCharacterMessageExamples = this.character.messageExamples
            ? this.character.messageExamples.join("\n")
            : "";

        const exampleNames = actorsData
            ? actorsData.map((actor) => actor.name).join(", ")
            : "";

        const messageString = formattedCharacterMessageExamples
            ? formattedCharacterMessageExamples
                .split("\n")
                .map((message) => message.trim())
                .filter(Boolean)
                .join("\n")
            : "";

        const getRecentInteractions = async (
            userA: UUID,
            userB: UUID
        ): Promise<Memory[]> => {
            // Find all rooms where userA and userB are participants
            const rooms = await this.databaseAdapter.getRoomsForParticipants([
                userA,
                userB,
            ]);

            // Check the existing memories in the database
            const existingMemories =
                await this.messageManager.getMemoriesByRoomIds({
                    // filter out the current room id from rooms
                    roomIds: rooms.filter((room) => room !== roomId),
                });

            // Sort messages by timestamp in descending order
            existingMemories.sort((a: Memory, b: Memory) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

            // Take the most recent messages
            const recentInteractionsData = existingMemories.slice(0, 20);
            return recentInteractionsData;
        };

        const recentInteractions =
            userId !== this.agentId
                ? await getRecentInteractions(userId, this.agentId)
                : [];

        const getRecentMessageInteractions = async (
            recentInteractionsData: Memory[]
        ): Promise<string> => {
            // Format the recent messages
            const formattedInteractions = await Promise.all(
                recentInteractionsData.map(async (message) => {
                    const isSelf = message.userId === this.agentId;
                    let sender: string;
                    if (isSelf) {
                        sender = this.character.name;
                    } else {
                        const accountId =
                            await this.databaseAdapter.getAccountById(
                                message.userId
                            );
                        sender = accountId?.username || "unknown";
                    }
                    return `${sender}: ${message.content.text}`;
                })
            );

            return formattedInteractions.join("\n");
        };

        const formattedMessageInteractions =
            await getRecentMessageInteractions(recentInteractions);

        const getRecentPostInteractions = async (
            recentInteractionsData: Memory[],
            actors: Actor[]
        ): Promise<string> => {
            const formattedInteractions = formatPosts({
                messages: recentInteractionsData,
                actors,
                conversationHeader: true,
            });

            return formattedInteractions;
        };

        const formattedPostInteractions = await getRecentPostInteractions(
            recentInteractions,
            actorsData
        );

        // Ensure required state properties are non-null strings
        const bio = Array.isArray(this.character.bio)
            ? this.character.bio.sort(() => 0.5 - Math.random()).slice(0, 3).join(" ")
            : this.character.bio || "";
        const lore = Array.isArray(this.character.lore)
            ? this.character.lore.join("\n")
            : this.character.lore || "";
        // Get message and post directions from character style
        const messageDirections = (() => {
            const all = this.character?.style?.all || [];
            const chat = this.character?.style?.chat || [];
            return [...all, ...chat].join("\n") || "";
        })();
        const postDirections = (() => {
            const all = this.character?.style?.all || [];
            const post = this.character?.style?.post || [];
            return [...all, ...post].join("\n") || "";
        })();

        const knowledgeData = await this.knowledgeManager.get(message);

        // Initialize action and evaluator promises
        const actionPromises = this.actions.map(async (action: Action) => {
            const result = await action.validate(this, message, initialState);
            return result ? action : null;
        });

        const evaluatorPromises = this.evaluators.map(async (evaluator: Evaluator) => {
            const result = await evaluator.validate(this, message);
            return result ? evaluator : null;
        });

        // Get evaluators, actions, and providers
        const [resolvedEvaluators, resolvedActions, providers] = await Promise.all([
            Promise.all(evaluatorPromises),
            Promise.all(actionPromises),
            getProviders(this, message)
        ]);

        // Filter out null actions before passing to formatters
        const validActions = (resolvedActions || []).filter((action): action is Action => action !== null);

        // Convert providers to array if it's a string
        const providersList = typeof providers === 'string' ? [providers] : (providers || []);

        const initialState: State = {
            userId,
            agentId: this.agentId,
            bio: bio || "",
            lore: lore || "",
            messageDirections,
            postDirections,
            roomId,
            agentName: this.character.name,
            senderName,
            actors: formatActors({ actors: actorsData }),
            actorsData,
            goals: formatGoalsAsString({ goals: goalsData }),
            goalsData,
            recentMessages: formatMessages({ messages: recentMessagesData, actors: actorsData }),
            recentMessagesData,
            actionNames: formatActionNames(validActions),
            actions: formatActions(validActions),
            actionsData: validActions,
            actionExamples: composeActionExamples(validActions, 5),
            providers: providersList.map(p => p.name).join(", "),
            recentInteractions: formattedMessageInteractions,
            recentInteractionsData: recentInteractions,
            formattedConversation: formatMessages({ messages: recentMessagesData, actors: actorsData }),
            knowledge: this.formatKnowledge(knowledgeData),
            knowledgeData,
            topic: this.character.topics && this.character.topics.length > 0
                ? this.character.topics[Math.floor(Math.random() * this.character.topics.length)]
                : "",
            topics: Array.isArray(this.character.topics)
                ? this.character.topics
                    .map((topic, index, array) => {
                        if (index === array.length - 2) {
                            return topic + " and ";
                        }
                        if (index === array.length - 1) {
                            return topic;
                        }
                        return topic + ", ";
                    })
                    .join("")
                : (typeof this.character.topics === 'string' ? this.character.topics : ""),
            characterPostExamples: formattedCharacterPostExamples && formattedCharacterPostExamples.length > 0
                ? addHeader(`# Example Posts for ${this.character.name}`, formattedCharacterPostExamples)
                : "",
            characterMessageExamples: formattedCharacterMessageExamples && formattedCharacterMessageExamples.length > 0
                ? addHeader(`# Example Messages for ${this.character.name}`, formattedCharacterMessageExamples)
                : ""
        };

        const evaluatorsData = resolvedEvaluators.filter(
            Boolean
        ) as Evaluator[];
        const actionsData = resolvedActions.filter(Boolean) as Action[];

        const actionState = {
            actionNames:
                "Possible response actions: " + formatActionNames(actionsData),
            actions:
                actionsData.length > 0
                    ? addHeader(
                          "# Available Actions",
                          formatActions(actionsData)
                      )
                    : "",
            actionExamples:
                actionsData.length > 0
                    ? addHeader(
                          "# Action Examples",
                          composeActionExamples(actionsData, 10)
                      )
                    : "",
            evaluatorsData,
            evaluators:
                evaluatorsData.length > 0
                    ? formatEvaluators(evaluatorsData)
                    : "",
            evaluatorNames:
                evaluatorsData.length > 0
                    ? formatEvaluatorNames(evaluatorsData)
                    : "",
            evaluatorExamples:
                evaluatorsData.length > 0
                    ? formatEvaluatorExamples(evaluatorsData)
                    : "",
            providers: addHeader(
                `# Additional Information About ${this.character.name} and The World`,
                providers
            ),
        };

        return { ...initialState, ...actionState } as State;
    }

    async updateRecentMessageState(state: State): Promise<State> {
        const conversationLength = this.getConversationLength();
        const recentMessagesData = await this.messageManager.getMemories({
            roomId: state.roomId,
            count: conversationLength,
            unique: false,
        });

        const recentMessages = formatMessages({
            actors: state.actorsData ?? [],
            messages: recentMessagesData.map((memory: Memory) => {
                const newMemory = { ...memory };
                delete newMemory.embedding;
                return newMemory;
            }),
        });

        const allAttachments: Array<{ id: string; title: string; url: string; source: string; description: string; text: string }> = [];

        if (recentMessagesData && Array.isArray(recentMessagesData)) {
            const lastMessageWithAttachment = recentMessagesData.find(
                (msg) =>
                    msg.content.attachments &&
                    msg.content.attachments.length > 0
            );

            if (lastMessageWithAttachment?.createdAt) {
                const lastMessageTime = lastMessageWithAttachment.createdAt;
                const oneHourBeforeLastMessage =
                    lastMessageTime - 60 * 60 * 1000; // 1 hour before last message

                allAttachments.push(...recentMessagesData
                    .filter((msg) => {
                        const msgTime = msg.createdAt;
                        return msgTime && msgTime >= oneHourBeforeLastMessage;
                    })
                    .flatMap((msg) => msg.content.attachments || []));
            }
        }

        const formattedAttachments = allAttachments
            .map(
                (attachment) =>
                    `ID: ${attachment.id}
Name: ${attachment.title}
URL: ${attachment.url}
Type: ${attachment.source}
Description: ${attachment.description}
Text: ${attachment.text}
    `
            )
            .join("\n");

        return {
            ...state,
            recentMessages: addHeader(
                "# Conversation Messages",
                recentMessages
            ),
            recentMessagesData,
            attachments: formattedAttachments,
        } as State;
    }

}
