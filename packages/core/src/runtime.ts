import { names, uniqueNamesGenerator } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";
import {
    composeActionExamples,
    formatActionNames,
    formatActions,
} from "./actions.js";
import { composeContext } from "./context.js";
import { defaultCharacter } from "./defaultCharacter.js";
import {
    evaluationTemplate,
    formatEvaluatorExamples,
    formatEvaluatorNames,
    formatEvaluators,
} from "./evaluators.js";
import { generateText } from "./generation.js";
import { formatGoalsAsString, getGoals } from "./goals.js";
import { elizaLogger } from "./index.js";
import { MemoryManager } from "./memory.js";
import { formatActors, formatMessages, getActorDetails } from "./messages.js";
import { parseJsonArrayFromText } from "./parsing.js";
import { formatPosts } from "./posts.js";
import { getProviders } from "./providers.js";
import { embed, getEmbeddingZeroVector } from "./embedding.js";
import {
    Character,
    Goal,
    HandlerCallback,
    IAgentRuntime,
    ICacheManager,
    IDatabaseAdapter,
    IMemoryManager,
    KnowledgeItem,
    Media,
    ModelClass,
    ModelProviderName,
    Plugin,
    Provider,
    Service,
    ServiceType,
    State,
    UUID,
    type Action,
    type Actor,
    type Evaluator,
    type Memory,
} from "./types.js";
import { stringToUuid } from "./uuid.js";
import { addHeader } from "./formatting.js";

/**
 * Represents the runtime environment for an agent, handling message processing,
 * action registration, and interaction with external services like OpenAI and Supabase.
 */
export class AgentRuntime implements IAgentRuntime {
    /**
     * Default count for recent messages to be kept in memory.
     * @private
     */
    readonly #conversationLength = 32 as number;
    /**
     * The ID of the agent
     */
    agentId: UUID;
    /**
     * The base URL of the server where the agent's requests are processed.
     */
    serverUrl = "http://localhost:7998";

    /**
     * The database adapter used for interacting with the database.
     */
    databaseAdapter: IDatabaseAdapter;

    /**
     * Authentication token used for securing requests.
     */
    token: string | null;

    /**
     * Custom actions that the agent can perform.
     */
    actions: Action[] = [];

    /**
     * Evaluators used to assess and guide the agent's responses.
     */
    evaluators: Evaluator[] = [];

    /**
     * Context providers used to provide context for message generation.
     */
    providers: Provider[] = [];

    plugins: Plugin[] = [];

    /**
     * The model to use for generateText.
     */
    modelProvider: ModelProviderName = ModelProviderName.OPENAI;

    /**
     * The model to use for generateImage.
     */
    imageModelProvider: ModelProviderName = ModelProviderName.OPENAI;

    /**
     * Fetch function to use
     * Some environments may not have access to the global fetch function and need a custom fetch override.
     */
    fetch = fetch;

    /**
     * The character to use for the agent
     */
    character: Character;

    /**
     * Store messages that are sent and received by the agent.
     */
    messageManager: IMemoryManager;

    /**
     * Store and recall descriptions of users based on conversations.
     */
    descriptionManager: IMemoryManager;

    /**
     * Manage the creation and recall of static information (documents, historical game lore, etc)
     */
    loreManager: IMemoryManager;

    /**
     * Hold large documents that can be referenced
     */
    documentsManager: IMemoryManager;

    /**
     * Searchable document fragments
     */
    knowledgeManager: IMemoryManager;

    services: Map<ServiceType, Service> = new Map();
    memoryManagers: Map<string, IMemoryManager> = new Map();
    cacheManager: ICacheManager;

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

    /**
     * Creates an instance of AgentRuntime.
     * @param opts - The options for configuring the AgentRuntime.
     * @param opts.conversationLength - The number of messages to hold in the recent message cache.
     * @param opts.token - The JWT token, can be a JWT token if outside worker, or an OpenAI token if inside worker.
     * @param opts.serverUrl - The URL of the worker.
     * @param opts.actions - Optional custom actions.
     * @param opts.evaluators - Optional custom evaluators.
     * @param opts.services - Optional custom services.
     * @param opts.memoryManagers - Optional custom memory managers.
     * @param opts.providers - Optional context providers.
     * @param opts.model - The model to use for generateText.
     * @param opts.embeddingModel - The model to use for embedding.
     * @param opts.agentId - Optional ID of the agent.
     * @param opts.databaseAdapter - The database adapter used for interacting with the database.
     * @param opts.fetch - Custom fetch function to use for making requests.
     */

    constructor(opts: {
        conversationLength?: number; // number of messages to hold in the recent message cache
        agentId?: UUID; // ID of the agent
        character?: Character; // The character to use for the agent
        token: string; // JWT token, can be a JWT token if outside worker, or an OpenAI token if inside worker
        serverUrl?: string; // The URL of the worker
        actions?: Action[]; // Optional custom actions
        evaluators?: Evaluator[]; // Optional custom evaluators
        plugins?: Plugin[];
        providers?: Provider[];
        modelProvider: ModelProviderName;

        services?: Service[]; // Map of service name to service instance
        managers?: IMemoryManager[]; // Map of table name to memory manager
        databaseAdapter: IDatabaseAdapter; // The database adapter used for interacting with the database
        fetch?: typeof fetch | unknown;
        speechModelPath?: string;
        cacheManager: ICacheManager;
        logging?: boolean;
    }) {
        elizaLogger.info("Initializing AgentRuntime with options:", {
            character: opts.character?.name,
            modelProvider: opts.modelProvider,
            characterModelProvider: opts.character?.modelProvider,
        });

        this.#conversationLength =
            opts.conversationLength ?? this.#conversationLength;
        this.databaseAdapter = opts.databaseAdapter;
        // use the character id if it exists, otherwise use the agentId if it is passed in, otherwise use the character name
        this.agentId =
            opts.character?.id ??
            opts?.agentId ??
            stringToUuid(opts.character?.name ?? uuidv4());
        this.character = opts.character || defaultCharacter;

        // By convention, we create a user and room using the agent id.
        // Memories related to it are considered global context for the agent.
        this.ensureRoomExists(this.agentId);
        this.ensureUserExists(
            this.agentId,
            this.character.name,
            this.character.name
        );
        this.ensureParticipantExists(this.agentId, this.agentId);

        elizaLogger.success("Agent ID", this.agentId);

        this.fetch = (opts.fetch as typeof fetch) ?? this.fetch;
        if (!opts.databaseAdapter) {
            throw new Error("No database adapter provided");
        }

        this.cacheManager = opts.cacheManager;

        this.messageManager = new MemoryManager({
            runtime: this,
            tableName: "messages",
        });

        this.descriptionManager = new MemoryManager({
            runtime: this,
            tableName: "descriptions",
        });

        this.loreManager = new MemoryManager({
            runtime: this,
            tableName: "lore",
        });

        this.documentsManager = new MemoryManager({
            runtime: this,
            tableName: "documents",
        });

        this.knowledgeManager = new MemoryManager({
            runtime: this,
            tableName: "fragments",
        });

        (opts.managers ?? []).forEach((manager: IMemoryManager) => {
            this.registerMemoryManager(manager);
        });

        (opts.services ?? []).forEach((service: Service) => {
            this.registerService(service);
        });

        this.serverUrl = opts.serverUrl ?? this.serverUrl;

        elizaLogger.info("Setting model provider...");
        elizaLogger.info("Model Provider Selection:", {
            characterModelProvider: this.character.modelProvider,
            optsModelProvider: opts.modelProvider,
            currentModelProvider: this.modelProvider,
            finalSelection:
                this.character.modelProvider ??
                opts.modelProvider ??
                this.modelProvider,
        });

        this.modelProvider =
            this.character.modelProvider ??
            opts.modelProvider ??
            this.modelProvider;

        this.imageModelProvider =
            this.character.imageModelProvider ?? this.modelProvider;

        elizaLogger.info("Selected model provider:", this.modelProvider);
        elizaLogger.info(
            "Selected image model provider:",
            this.imageModelProvider
        );

        // Validate model provider
        if (!Object.values(ModelProviderName).includes(this.modelProvider)) {
            elizaLogger.error("Invalid model provider:", this.modelProvider);
            elizaLogger.error(
                "Available providers:",
                Object.values(ModelProviderName)
            );
            throw new Error(`Invalid model provider: ${this.modelProvider}`);
        }

        if (!this.serverUrl) {
            elizaLogger.warn("No serverUrl provided, defaulting to localhost");
        }

        this.token = opts.token;

        this.plugins = [
            ...(opts.character?.plugins ?? []),
            ...(opts.plugins ?? []),
        ];

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
    private async processCharacterKnowledge(items: string[]) {
        for (const item of items) {
            const knowledgeId = stringToUuid(item);
            const existingDocument =
                await this.documentsManager.getMemoryById(knowledgeId);
            if (existingDocument) {
                continue;
            }

            elizaLogger.info(
                "Processing knowledge for ",
                this.character.name,
                " - ",
                item.slice(0, 100)
            );

            await this.knowledgeManager.createMemory({
                id: knowledgeId,
                agentId: this.agentId,
                roomId: this.agentId,
                userId: this.agentId,
                createdAt: Date.now(),
                content: {
                    text: item,
                },
                embedding: getEmbeddingZeroVector(),
            });
        }
    }

    getSetting(key: string): string | null {
        // first check if it's in the secrets object
        if (this.character.settings?.secrets?.[key]) {
            return this.character.settings.secrets[key];
        }
        // if not, check if it's in the settings object
        const settings = this.character.settings as Record<string, any>;
        if (settings?.[key]) {
            return settings[key];
        }

        // if not found, return null to match interface
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
    ) {
        const evaluatorPromises = this.evaluators.map(
            async (evaluator: Evaluator) => {
                elizaLogger.log("Evaluating", evaluator.name);
                if (!evaluator.handler) {
                    return null;
                }
                if (!didRespond && !evaluator.alwaysRun) {
                    return null;
                }
                const result = await evaluator.validate(this, message, state);
                if (result) {
                    return evaluator;
                }
                return null;
            }
        );

        const resolvedEvaluators = await Promise.all(evaluatorPromises);
        const evaluatorsData = resolvedEvaluators.filter((e): e is Evaluator => e !== null);

        // if there are no evaluators this frame, return
        if (evaluatorsData.length === 0) {
            return [];
        }

        // Create a new state object with all required fields
        const evaluationState: State = {
            ...(state || {}),
            roomId: state?.roomId || message.roomId || this.agentId,
            actors: state?.actors || "",  // Required field
            recentMessages: state?.recentMessages || "",  // Required field
            recentMessagesData: state?.recentMessagesData || [],  // Required field
            evaluators: formatEvaluators(evaluatorsData),
            evaluatorNames: formatEvaluatorNames(evaluatorsData),
        };

        const context = composeContext({
            state: evaluationState,
            template:
                this.character.templates?.evaluationTemplate ||
                evaluationTemplate,
        });

        const result = await generateText({
            runtime: this,
            context,
            modelClass: ModelClass.SMALL,
        });

        const evaluators = parseJsonArrayFromText(
            result
        ) as unknown as string[];

        for (const evaluator of this.evaluators) {
            if (!evaluators.includes(evaluator.name)) continue;

            if (evaluator.handler)
                await evaluator.handler(this, message, state, {}, callback);
        }

        return evaluators;
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

        const senderName = actorsData?.find(
            (actor: Actor) => actor.id === userId
        )?.name;

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
                const lastMessageTime = lastMessageWithAttachment.createdAt ?? Date.now();
                const oneHourBeforeLastMessage =
                    lastMessageTime - 60 * 60 * 1000; // 1 hour before last message

                allAttachments = recentMessagesData
                    .reverse()
                    .filter((msg) => {
                        const msgTime = msg.createdAt ?? Date.now();
                        const isWithinTime =
                            msgTime >= oneHourBeforeLastMessage;
                        return isWithinTime && msg.content.attachments && msg.content.attachments.length > 0;
                    })
                    .map((msg) => msg.content.attachments)
                    .flat() as Media[];
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

        // randomly get 3 bits of lore and join them into a paragraph, divided by \n
        let lore = "";
        // Assuming this.lore is an array of lore bits
        if (this.character.lore && this.character.lore.length > 0) {
            const shuffledLore = [...this.character.lore].sort(
                () => Math.random() - 0.5
            );
            const selectedLore = shuffledLore.slice(0, 10);
            lore = selectedLore.join("\n");
        }

        const formattedCharacterPostExamples = this.character.postExamples
            .sort(() => 0.5 - Math.random())
            .map((post) => {
                const messageString = `${post}`;
                return messageString;
            })
            .slice(0, 50)
            .join("\n");

        const formattedCharacterMessageExamples = this.character.messageExamples
            .sort(() => 0.5 - Math.random())
            .slice(0, 5)
            .map((example) => {
                const exampleNames = Array.from({ length: 5 }, () =>
                    uniqueNamesGenerator({ dictionaries: [names] })
                );

                return example
                    .map((message) => {
                        let messageString = `${message.user}: ${message.content.text}`;
                        exampleNames.forEach((name, index) => {
                            const placeholder = `{{user${index + 1}}}`;
                            messageString = messageString.replaceAll(
                                placeholder,
                                name
                            );
                        });
                        return messageString;
                    })
                    .join("\n");
            })
            .join("\n\n");

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
            existingMemories.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

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

        // if bio is a string, use it. if its an array, pick one at random
        let bio = this.character.bio || "";
        if (Array.isArray(bio)) {
            // get three random bio strings and join them with " "
            bio = bio
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .join(" ");
        }

        // Convert Memory[] to KnowledgeItem[] by mapping the required fields
        const knowledgeData = (await this.knowledgeManager.searchMemoriesByEmbedding(
            await embed(this, message.content.text),
            { roomId: this.agentId, count: 5, match_threshold: 0.1 }
        )).map(memory => ({
            id: memory.id,
            content: memory.content
        }));

        const formattedKnowledge = this.formatKnowledge(knowledgeData);

        const initialState: State = {
            agentId: this.agentId,
            bio: bio || "",
            lore: await this.getSetting("lore") || "",
            messageDirections: await this.getSetting("messageDirections") || "",
            postDirections: await this.getSetting("postDirections") || "",
            roomId,
            agentName: this.character.name,
            senderName,
            actors: formatActors({ actors: actorsData }),
            actorsData,
            goals: formatGoalsAsString({ goals: goalsData }),
            goalsData,
            recentMessages: formatMessages({ messages: recentMessagesData, actors: actorsData }),
            recentMessagesData,
            actionNames: formatActionNames(this.actions),
            actions: formatActions(this.actions),
            actionsData: this.actions,
            actionExamples: composeActionExamples(this.actions, 5),
            providers: this.providers.map(p => p.name).join(", "),
            recentInteractions: formattedMessageInteractions,
            recentInteractionsData: recentInteractions,
            formattedConversation: formatMessages({ messages: recentMessagesData, actors: actorsData }),
            knowledge: formattedKnowledge,
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
            characterPostExamples: formattedCharacterPostExamples?.length
                ? addHeader(`# Example Posts for ${this.character.name}`, formattedCharacterPostExamples)
                : "",
            characterMessageExamples: formattedCharacterMessageExamples?.length
                ? addHeader(`# Example Messages for ${this.character.name}`, formattedCharacterMessageExamples)
                : "",
            ...additionalKeys,
        } as State;

        const actionPromises = this.actions.map(async (action) => {
            if (await action.validate(this, message)) {
                return action.handler(this, message);
            }
            return null;
        });

        const evaluatorPromises = this.evaluators.map(async (evaluator) => {
            if (await evaluator.validate(this, message)) {
                return evaluator.handler(this, message);
            }
            return null;
        });
        const [resolvedEvaluators, resolvedActions, providers] =
            await Promise.all([
                Promise.all(evaluatorPromises),
                Promise.all(actionPromises),
                getProviders(this),
            ]);

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
            providers: providers && providers.length > 0
                ? addHeader(
                    "# Additional Information",
                    Array.isArray(providers) ? providers.join(", ") : providers
                )
                : "",
        };

        return { ...initialState, ...actionState } as State;
    }

    async updateRecentMessageState(state: State): Promise<State> {
        const conversationLength = this.getConversationLength();
        const recentMessagesData = await this.messageManager.getMemories({
            roomId: state.roomId || stringToUuid("default-room"),
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

        let allAttachments: Media[] = [];

        if (recentMessagesData && Array.isArray(recentMessagesData)) {
            const lastMessageWithAttachment = recentMessagesData.find(
                (msg) =>
                    msg.content.attachments &&
                    msg.content.attachments.length > 0
            );

            if (lastMessageWithAttachment && lastMessageWithAttachment.createdAt) {
                const lastMessageTime = lastMessageWithAttachment.createdAt;
                const oneHourBeforeLastMessage =
                    lastMessageTime - 60 * 60 * 1000; // 1 hour before last message

                allAttachments = recentMessagesData
                    .filter((msg) => {
                        const msgTime = msg.createdAt;
                        return msgTime !== undefined && msgTime >= oneHourBeforeLastMessage;
                    })
                    .flatMap((msg) => msg.content.attachments || []);
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

    private formatKnowledge(items: KnowledgeItem[]): string {
        if (!items || items.length === 0) return "";
        return items.map(item => item.content.text).join("\n\n");
    }
}
