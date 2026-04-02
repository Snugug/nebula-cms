/*
 * Storage adapter backed by the File System Access API.
 * Traverses from a project root handle through src/content/{collection}/ for all operations.
 */

import type { StorageAdapter, FileEntry, FileWrite } from './adapter';

// FSA adapter implementation
export class FsaAdapter implements StorageAdapter {
  /**
   * Creates an FSA adapter rooted at the given directory handle.
   * @param {FileSystemDirectoryHandle} root - The project root directory handle
   */
  constructor(private root: FileSystemDirectoryHandle) {}

  /**
   * Traverses root → src → content → {collection}.
   * @param {string} collection - The collection name
   * @return {Promise<FileSystemDirectoryHandle>} The collection directory handle
   */
  private async getCollectionDir(
    collection: string,
  ): Promise<FileSystemDirectoryHandle> {
    const src = await this.root.getDirectoryHandle('src');
    const content = await src.getDirectoryHandle('content');
    return content.getDirectoryHandle(collection);
  }

  /**
   * Lists files in the collection matching the given extensions, with their content.
   * @param {string} collection - The collection name
   * @param {string[]} extensions - File extensions to include (e.g. ['.md', '.mdx'])
   * @return {Promise<FileEntry[]>} Array of filename + content pairs
   */
  async listFiles(
    collection: string,
    extensions: string[],
  ): Promise<FileEntry[]> {
    const dir = await this.getCollectionDir(collection);
    const entries: FileEntry[] = [];

    for await (const [name, entry] of dir.entries()) {
      if (
        entry.kind !== 'file' ||
        !extensions.some((ext) => name.endsWith(ext))
      ) {
        continue;
      }
      const file = await entry.getFile();
      const content = await file.text();
      entries.push({ filename: name, content });
    }

    return entries;
  }

  /**
   * Deletes a file from the collection directory.
   * @param {string} collection - The collection name
   * @param {string} filename - The filename to delete
   * @return {Promise<void>}
   */
  async deleteFile(collection: string, filename: string): Promise<void> {
    const dir = await this.getCollectionDir(collection);
    await dir.removeEntry(filename);
  }

  /**
   * Reads a single file's content from the collection.
   * @param {string} collection - The collection name
   * @param {string} filename - The filename
   * @return {Promise<string>} The file content
   */
  async readFile(collection: string, filename: string): Promise<string> {
    const dir = await this.getCollectionDir(collection);
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return file.text();
  }

  /**
   * Writes content to a file, creating it if necessary.
   * @param {string} collection - The collection name
   * @param {string} filename - The filename
   * @param {string} content - The content to write
   * @return {Promise<void>}
   */
  async writeFile(
    collection: string,
    filename: string,
    content: string,
  ): Promise<void> {
    const dir = await this.getCollectionDir(collection);
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * Writes multiple files sequentially (FSA has no atomic multi-file write).
   * @param {FileWrite[]} files - Array of files to write
   * @return {Promise<void>}
   */
  async writeFiles(files: FileWrite[]): Promise<void> {
    for (const f of files) {
      await this.writeFile(f.collection, f.filename, f.content);
    }
  }
}
