const SICK_LEAVE_ATTACHMENT_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[^/]+$/i;

export function isValidSickLeaveAttachmentPath(path: string, userId: string) {
  if (!SICK_LEAVE_ATTACHMENT_PATH.test(path)) {
    return false;
  }

  return path.toLowerCase().startsWith(`${userId.toLowerCase()}/`);
}
