import { ProviderFactory } from "../providers/ProviderFactory.js";

import type { ChatRequest } from "../types/Chat.js";
import type { ChatResponse } from "../types/Chat.js";

export class ChatHandler {

    async handle(request: ChatRequest): Promise<ChatResponse> {

        const provider =
            ProviderFactory.get(request.provider);

        const response =
            await provider.generate(request.message);

        return {

            response

        };

    }

}