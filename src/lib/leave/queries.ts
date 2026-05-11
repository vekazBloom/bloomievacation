export const leaveRequestUserEmbed = 'users!leave_requests_user_id_fkey';

export const leaveRequestWithUserSelect = `*, ${leaveRequestUserEmbed}(name, email)`;

export const leaveRequestWithUserAvatarSelect = `*, ${leaveRequestUserEmbed}(name, email, avatar_url)`;
