export const ADMIN_ATTENTION_CHANGED = 'coursedekho:admin-attention-changed';

export function notifyAdminAttentionChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ADMIN_ATTENTION_CHANGED));
}
