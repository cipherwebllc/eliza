/**
 * Adds a header to a block of text
 * @param header The header text
 * @param content The content to add the header to
 * @returns The content with the header added
 */
export function addHeader(header: string, content: string): string {
    if (!content || content.trim().length === 0) {
        return "";
    }
    return `${header}\n\n${content}`;
}
