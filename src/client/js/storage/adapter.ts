/*
 * Storage adapter interface and shared types.
 * Defines the contract that FSA and GitHub storage backends implement.
 */

// A single file's name and content as returned by listFiles.
export type FileEntry = {
  filename: string;
  content: string;
};

// A file write target with collection path, filename, and content.
export type FileWrite = {
  collection: string;
  filename: string;
  content: string;
};

// Contract for storage backend adapters. Both FSA and GitHub adapters implement this.
export interface StorageAdapter {
  /**
   * Lists files in a collection matching the given extensions, returning their names and content.
   * @param {string} collection - The collection name
   * @param {string[]} extensions - File extensions to include (e.g. ['.md', '.mdx', '.yaml'])
   * @return {Promise<FileEntry[]>} Array of filename + content pairs
   */
  listFiles(collection: string, extensions: string[]): Promise<FileEntry[]>;

  /**
   * Deletes a single file from the collection. Used during file type conversion to remove the old file after the new one is written.
   * @param {string} collection - The collection name
   * @param {string} filename - The filename to delete
   * @return {Promise<void>}
   */
  deleteFile(collection: string, filename: string): Promise<void>;

  /**
   * Reads a single file's content.
   * @param {string} collection - The collection name
   * @param {string} filename - The filename within the collection
   * @return {Promise<string>} The file content as a string
   */
  readFile(collection: string, filename: string): Promise<string>;

  /**
   * Writes content to a single file, creating it if it doesn't exist.
   * @param {string} collection - The collection name
   * @param {string} filename - The filename within the collection
   * @param {string} content - The content to write
   * @return {Promise<void>}
   */
  writeFile(
    collection: string,
    filename: string,
    content: string,
  ): Promise<void>;

  /**
   * Writes multiple files atomically (single commit for GitHub, sequential for FSA).
   * @param {FileWrite[]} files - Array of files to write
   * @return {Promise<void>}
   */
  writeFiles(files: FileWrite[]): Promise<void>;
}

/*
//////////////////////////////
// Message types for SharedWorker communication
//////////////////////////////
*/

// Union of all request messages that can be sent to the storage SharedWorker.
export type StorageRequest =
  | {
      type: 'init';
      backend:
        | { type: 'fsa'; handle: FileSystemDirectoryHandle }
        | { type: 'github'; token: string; repo: string };
    }
  | { type: 'listFiles'; collection: string; extensions: string[] }
  | { type: 'readFile'; collection: string; filename: string }
  | { type: 'writeFile'; collection: string; filename: string; content: string }
  | { type: 'writeFiles'; files: FileWrite[] }
  | { type: 'deleteFile'; collection: string; filename: string }
  | { type: 'teardown' };

// Union of all response messages from the storage SharedWorker.
export type StorageResponse =
  | { type: 'init'; ok: true }
  | { type: 'init'; ok: false; error: string }
  | { type: 'listFiles'; ok: true; files: FileEntry[] }
  | { type: 'listFiles'; ok: false; error: string }
  | { type: 'readFile'; ok: true; content: string }
  | { type: 'readFile'; ok: false; error: string }
  | { type: 'writeFile'; ok: true }
  | { type: 'writeFile'; ok: false; error: string }
  | { type: 'writeFiles'; ok: true }
  | { type: 'writeFiles'; ok: false; error: string }
  | { type: 'deleteFile'; ok: true }
  | { type: 'deleteFile'; ok: false; error: string }
  | { type: 'teardown'; ok: true }
  | { type: 'port-connected' };
