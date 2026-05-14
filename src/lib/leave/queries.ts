export const leaveRequestUserEmbed = 'users!leave_requests_user_id_fkey';

/** Grant rows embedded under each allocation (PostgREST). */
export const leaveRequestGrantAllocationsEmbed =
  'leave_request_grant_allocations(working_days, annual_entitlement_grants(label, source, grant_year))';

export const leaveRequestWithUserSelect = `*, ${leaveRequestUserEmbed}(name, email), ${leaveRequestGrantAllocationsEmbed}`;

export const leaveRequestWithUserAvatarSelect = `*, ${leaveRequestUserEmbed}(name, email, avatar_url), ${leaveRequestGrantAllocationsEmbed}`;
