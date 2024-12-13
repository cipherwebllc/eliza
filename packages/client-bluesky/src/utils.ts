/**
 * Format timestamp into a human-readable string
 */
export function formatTimestamp(messageDate: number): string {
    const now = new Date();
    const diff = now.getTime() - messageDate;

    const absDiff = Math.abs(diff);
    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (absDiff < 60000) {
        return "just now";
    } else if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    } else if (hours < 24) {
        return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else {
        return `${days} day${days !== 1 ? "s" : ""} ago`;
    }
}
