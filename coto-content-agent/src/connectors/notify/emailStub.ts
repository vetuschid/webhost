export const emailStub = {
  name: 'email',
  isReady: () => false,
  async sendBatchSummary() {
    return { ok: false, message: 'email stub: not wired' };
  },
  async sendApprovalRequest() {
    return { ok: false, message: 'email stub: not wired' };
  },
};
