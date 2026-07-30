declare module "@whiskeysockets/baileys" {
  export function makeWASocket(config: any): any;
  export function useMultiFileAuthState(authDir: string): Promise<{ state: any; saveCreds: () => Promise<void> }>;
  export const DisconnectReason: {
    loggedOut: number;
    connectionClosed: number;
    connectionLost: number;
    [key: string]: number;
  };
}
