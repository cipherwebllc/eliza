import { IAgentRuntime, Provider } from "./types.js";

/**
 * Formats provider outputs into a string which can be injected into the context.
 * @param runtime The AgentRuntime object.
 * @returns A string that concatenates the outputs of each provider.
 */
export async function getProviders(runtime: IAgentRuntime): Promise<string> {
    const providerResults = (
        await Promise.all(
            runtime.providers.map(async (provider) => {
                return await provider.provide(runtime);
            })
        )
    ).filter((result) => result != null && result !== "");

    return providerResults.join("\n");
}
