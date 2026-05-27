// GoHighLevel scheduling stub. The MVP explicitly does not schedule social
// posts yet, but everything downstream (the approved/ folder, the approval
// log, manifest captions field) lines up with what GHL will need.

export const ghlStub = {
  name: 'gohighlevel',
  isReady: () => Boolean(process.env.GHL_API_KEY),
  async scheduleApprovedPosts(_batchId: string) {
    return { ok: false, message: 'ghl stub: scheduling deliberately deferred' };
  },
  async pairApprovedImagesWithCaptions(_batchId: string) {
    return { ok: false, message: 'ghl stub: caption pairing deliberately deferred' };
  },
};
