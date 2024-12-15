import { Plugin } from "@ai16z/eliza";
import { icpWalletProvider } from "./providers/wallet.js";
import { executeCreateToken } from "./actions/createToken.js";

export const icpPlugin: Plugin = {
    name: "icp",
    description: "Internet Computer Protocol Plugin for Eliza",
    providers: [icpWalletProvider],
    actions: [executeCreateToken],
    evaluators: [],
};

export default icpPlugin;
