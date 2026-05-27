// Stub. Real implementation will use googleapis with a service account or
// refresh token. We sketch the interface so callers can be wired now.

export interface GoogleDriveStub {
  isReady(): boolean;
  createClientFolder(clientId: string): Promise<{ ok: boolean; folderId?: string }>;
  syncBatchToDrive(args: {
    clientId: string;
    batchId: string;
  }): Promise<{ ok: boolean; message: string }>;
  uploadApprovedAssets(args: {
    clientId: string;
    batchId: string;
  }): Promise<{ ok: boolean; message: string }>;
}

export const googleDriveStub: GoogleDriveStub = {
  isReady() {
    return Boolean(
      process.env.GOOGLE_DRIVE_CLIENT_ID &&
        process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
        process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    );
  },
  async createClientFolder() {
    return { ok: false, folderId: undefined };
  },
  async syncBatchToDrive() {
    return { ok: false, message: 'google_drive stub: not wired' };
  },
  async uploadApprovedAssets() {
    return { ok: false, message: 'google_drive stub: not wired' };
  },
};
