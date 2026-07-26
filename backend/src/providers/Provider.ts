export interface Provider {
    generate(message: string): Promise<string>;
}