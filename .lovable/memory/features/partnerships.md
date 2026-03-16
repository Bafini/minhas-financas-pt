Shared account partnerships: two users can share financial data with configurable permissions.

## Model
- Table: partnerships (requester_id, target_email, target_id, status, permission_level)
- Max 1 active/pending partnership per user (enforced by trigger)
- Status: pending → accepted/rejected/dissolved
- permission_level: 'read' or 'full' (configurable by inviter)

## RLS
- All data tables updated: SELECT allows partner access, INSERT/UPDATE/DELETE allow if permission='full'
- Security definer functions: get_partner_id, get_partner_permission, find_user_id_by_email, is_partnership_member
- Inviter always has 'full' access to partner's data; invitee gets configured permission

## Profile Switching
- ActiveProfileContext (src/contexts/ActiveProfileContext.tsx) tracks active profile
- `activeUserId`: the user_id to use for all queries (own or partner's)
- `canWrite`: whether user has write access to active profile
- `isViewingPartner`: boolean flag
- Profile switcher in AppSidebar header (two buttons: own name / partner name)
- Badge shown in mobile header when viewing partner's data
- ALL pages updated to use `activeUserId` for reads AND writes

## UI
- PartnershipSection component in DefinicoesPage
- Send invite by email, accept/reject received, cancel sent, dissolve active
- Profile switcher in sidebar when partnership is accepted
