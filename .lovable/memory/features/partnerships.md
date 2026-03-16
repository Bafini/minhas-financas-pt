Shared account partnerships: two users can share financial data with configurable permissions.

## Model
- Table: partnerships (requester_id, target_email, target_id, status, permission_level)
- Max 1 active/pending partnership per user (enforced by trigger)
- Status: pending → accepted/rejected/dissolved
- permission_level: 'read' or 'full' (configurable by inviter)

## RLS
- All data tables updated: SELECT allows partner access, UPDATE/DELETE allow if permission='full'
- Security definer functions: get_partner_id, get_partner_permission, find_user_id_by_email
- Inviter always has 'full' access to partner's data; invitee gets configured permission

## UI
- PartnershipSection component in DefinicoesPage
- Send invite by email, accept/reject received, cancel sent, dissolve active
