import { getUserBotCapabilities } from '@/lib/bot/user-context';
import { createServiceClient } from '@/lib/supabase/server';
import { buildToolsForUser } from './definitions';
import { executeBotTool, type BotToolContext } from './execute';

export { buildToolsForUser, PREVIEW_TOOL_NAMES } from './definitions';
export { executeBotTool, type BotToolContext } from './execute';

export function buildBotToolContext(userId: string): BotToolContext {
  return { userId, supabase: createServiceClient() };
}

export async function buildBotToolsForUser(userId: string) {
  const ctx = buildBotToolContext(userId);
  const caps = await getUserBotCapabilities(ctx.supabase, userId);
  return buildToolsForUser(caps.tiers);
}
