/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ElectronAPI {
  selectAlbumDirectory: () => Promise<string | null>;
  readAlbumFiles: (dirPath: string) => Promise<Array<{ name: string; url: string; path: string }>>;
  getLocalIP: () => Promise<string>;
  getAlbums: () => Promise<any[]>;
  saveAlbums: (albums: any[]) => Promise<boolean>;
  selectAudioFile: () => Promise<string | null>;
  toggleFullscreen: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
