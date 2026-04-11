import { supabase } from '@/integrations/supabase/client';

interface AuditParams {
  userId: string;
  action: 'login' | 'insert' | 'update' | 'delete';
  entityType: string;
  entityId?: string;
  oldData?: any;
  newData?: any;
  source?: string;
}

export async function logAudit(params: AuditParams) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      old_data: params.oldData || null,
      new_data: params.newData || null,
      source: params.source || 'manual',
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
