/**
 * File System Types
 * Interfaces for file system handles and writable streams
 */

/** File System Handle */
export interface FileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
}

/** File System File Handle */
export interface FileSystemFileHandle extends FileSystemHandle {
    kind: 'file';
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
}

/** File System Directory Handle */
export interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: 'directory';
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    values(): AsyncIterableIterator<FileSystemHandle>;
}

/** File System Writable File Stream */
export interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | Buffer | Blob): Promise<void>;
    close(): Promise<void>;
}
