export const VERSION: string;
export const FILES: [from: string, name: string, sha256: string][];
export function sha256(bytes: Uint8Array): string;
export function matches(bytes: Uint8Array, expected: string): boolean;
/** Names of the vendored files that are missing or whose SHA-256 is not the pinned one (no network). */
export function unverified(dir?: string): Promise<string[]>;
