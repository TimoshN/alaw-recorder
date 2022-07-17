export interface IElectronAPI {
    writeToStream: (data: Uint8Array) => Promise<void>,
    closeStream: () => void
  }

  declare global {
    interface Window {
        api: IElectronAPI
    }
  }