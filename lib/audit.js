import { supabase } from './supabase'

export const logAudit = async (userId, userName, action, details = {}, entityType = null, entityId = null) => {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      user_name: userName,
      action,
      details,
      entity_type: entityType,
      entity_id: entityId,
      ip_address: null,
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Audit log error:', e)
  }
}
