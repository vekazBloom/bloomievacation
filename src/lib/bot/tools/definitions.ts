import type { ToolTier } from '@/lib/bot/user-context';

export type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolDefinition = OpenAITool & { tier: ToolTier };

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'get_my_profile',
      description: 'Profil korisnika: ime, email, telefon, system admin status.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'list_my_notifications',
      description: 'Zadnjih 20 in-app notifikacija korisnika.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'list_my_projects',
      description: 'Lista projekata na kojima je korisnik član, s ulogom.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'get_leave_balance',
      description: 'Preostali dani godišnjeg, bolovanja i vjerskog odmora.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'list_my_requests',
      description: 'Nedavni zahtjevi za odsustvo korisnika.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'list_national_holidays',
      description: 'Državni praznici u sustavu.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'list_religious_holidays',
      description: 'Dostupni vjerski praznici iz pool-a.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'get_my_religious_selections',
      description: 'Korisnikovi odabrani vjerski praznici za godinu.',
      parameters: {
        type: 'object',
        properties: { year: { type: 'number' } },
        required: ['year'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'get_carry_over_decisions',
      description: 'Carry-over odluke korisnika (opcionalno po projektu).',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'list_annual_fund_definitions',
      description: 'Globalni šabloni godišnjih fondova.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    tier: 'team',
    type: 'function',
    function: {
      name: 'get_project_details',
      description: 'Detalji projekta: naziv, prag godišnjeg, carry-over politika.',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: ['projectId'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'team',
    type: 'function',
    function: {
      name: 'get_project_members',
      description: 'Članovi projekta s ulogama.',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: ['projectId'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'team',
    type: 'function',
    function: {
      name: 'get_project_overview',
      description: 'Pregled projekta: broj zahtjeva po statusu, away this week.',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: ['projectId'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'team',
    type: 'function',
    function: {
      name: 'list_project_requests',
      description: 'Zahtjevi za odsustvo u projektu.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled'] },
          limit: { type: 'number' },
        },
        required: ['projectId'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'team',
    type: 'function',
    function: {
      name: 'get_team_on_leave',
      description: 'Tko je na odmoru u timu u zadanom periodu.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          includePending: { type: 'boolean' },
          types: {
            type: 'array',
            items: { type: 'string', enum: ['annual', 'sick', 'religious'] },
          },
        },
        required: ['projectId', 'startDate', 'endDate'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'team',
    type: 'function',
    function: {
      name: 'get_team_on_leave_today',
      description: 'Tko je danas na odmoru u timu.',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' }, includePending: { type: 'boolean' } },
        required: ['projectId'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'team',
    type: 'function',
    function: {
      name: 'get_team_on_leave_this_week',
      description: 'Tko je na odmoru ovaj tjedan u timu.',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' }, includePending: { type: 'boolean' } },
        required: ['projectId'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'team',
    type: 'function',
    function: {
      name: 'get_vacation_overlap',
      description: 'Postotak preklapanja godišnjeg u timu.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
        required: ['projectId', 'startDate', 'endDate'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'lead',
    type: 'function',
    function: {
      name: 'list_pending_team_requests',
      description: 'Pending zahtjevi koji čekaju odobrenje (lead/admin).',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' }, limit: { type: 'number' } },
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'admin',
    type: 'function',
    function: {
      name: 'list_project_invitations',
      description: 'Pending pozivnice za projekat (admin).',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: ['projectId'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'admin',
    type: 'function',
    function: {
      name: 'list_sent_invitations',
      description: 'Pozivnice koje je korisnik poslao.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'admin',
    type: 'function',
    function: {
      name: 'search_users_for_invite',
      description: 'Pretraži korisnike za dodavanje u projekat (admin).',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' }, query: { type: 'string' } },
        required: ['projectId', 'query'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'system',
    type: 'function',
    function: {
      name: 'get_jira_config',
      description: 'Jira konfiguracija (system admin).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    tier: 'system',
    type: 'function',
    function: {
      name: 'list_jira_sprints',
      description: 'Lista Jira sprintova (system admin).',
      parameters: {
        type: 'object',
        properties: { boardId: { type: 'number' } },
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'system',
    type: 'function',
    function: {
      name: 'get_jira_sprint_analytics',
      description: 'Analitika Jira sprinta (system admin).',
      parameters: {
        type: 'object',
        properties: {
          sprintId: { type: 'number' },
          boardId: { type: 'number' },
        },
        required: ['sprintId'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'preview_leave_request',
      description: 'Pripremi zahtjev za odsustvo (potvrda dugmetom).',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          type: { type: 'string', enum: ['annual', 'sick', 'religious'] },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['projectId', 'type', 'startDate', 'endDate'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'lead',
    type: 'function',
    function: {
      name: 'preview_review_leave_request',
      description: 'Pripremi odobrenje/odbijanje zahtjeva (potvrda dugmetom).',
      parameters: {
        type: 'object',
        properties: {
          requestId: { type: 'string' },
          action: { type: 'string', enum: ['approve', 'reject'] },
          decisionNote: { type: 'string' },
        },
        required: ['requestId', 'action'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'preview_cancel_leave_request',
      description: 'Pripremi otkazivanje vlastitog pending/approved zahtjeva.',
      parameters: {
        type: 'object',
        properties: { requestId: { type: 'string' } },
        required: ['requestId'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'preview_mark_notifications_read',
      description: 'Označi sve notifikacije kao pročitane.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'preview_religious_selection',
      description: 'Postavi vjerske praznike za godinu (potvrda dugmetom).',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number' },
          holidayIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['year', 'holidayIds'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'base',
    type: 'function',
    function: {
      name: 'preview_carry_over_decision',
      description: 'Carry-over odluka za godinu (prenesi ili izgubi).',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          year: { type: 'number' },
          decision: { type: 'string', enum: ['transferred', 'lost'] },
        },
        required: ['projectId', 'year', 'decision'],
        additionalProperties: false,
      },
    },
  },
  {
    tier: 'admin',
    type: 'function',
    function: {
      name: 'preview_invite_user',
      description: 'Pošalji pozivnicu korisniku na email (admin, potvrda dugmetom).',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'lead', 'employee'] },
        },
        required: ['projectId', 'email'],
        additionalProperties: false,
      },
    },
  },
];

const TIER_ORDER: ToolTier[] = ['base', 'team', 'lead', 'admin', 'system'];

export function buildToolsForUser(tiers: Set<ToolTier>): OpenAITool[] {
  const allowed = new Set<ToolTier>();
  for (const tier of TIER_ORDER) {
    if (tiers.has(tier)) allowed.add(tier);
  }
  return TOOL_DEFINITIONS.filter((t) => allowed.has(t.tier)).map(({ tier: _t, ...tool }) => tool);
}

export const PREVIEW_TOOL_NAMES = new Set([
  'preview_leave_request',
  'preview_review_leave_request',
  'preview_cancel_leave_request',
  'preview_mark_notifications_read',
  'preview_religious_selection',
  'preview_carry_over_decision',
  'preview_invite_user',
]);
