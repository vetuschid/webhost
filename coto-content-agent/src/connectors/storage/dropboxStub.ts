export const dropboxStub = {
  name: 'dropbox',
  isReady: () => Boolean(process.env.DROPBOX_ACCESS_TOKEN),
  async syncBatch() {
    return { ok: false, message: 'dropbox stub: not wired' };
  },
};
