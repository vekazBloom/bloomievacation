export const leaveRequestUserEmbed = 'users!leave_requests_user_id_fkey';

/** Request project (required when balance_project_id also references projects). */
export const leaveRequestProjectEmbed = 'projects!leave_requests_project_id_fkey(name)';

export const leaveRequestProjectEmbedWithSlug =
  'projects!leave_requests_project_id_fkey(name, slug)';

export const leaveRequestBalanceProjectEmbed =
  'balance_project:projects!leave_requests_balance_project_id_fkey(name)';

/** Grant rows embedded under each allocation (PostgREST). */
export const leaveRequestGrantAllocationsEmbed =
  'leave_request_grant_allocations(grant_id, working_days, annual_entitlement_grants(id, label, source, grant_year))';

export const leaveRequestWithUserSelect = `*, ${leaveRequestUserEmbed}(name, email), ${leaveRequestProjectEmbed}, ${leaveRequestBalanceProjectEmbed}, ${leaveRequestGrantAllocationsEmbed}`;

export const leaveRequestWithUserAvatarSelect = `*, ${leaveRequestUserEmbed}(name, email, avatar_url), ${leaveRequestProjectEmbed}, ${leaveRequestBalanceProjectEmbed}, ${leaveRequestGrantAllocationsEmbed}`;
