/** Someone the DEV pill can act as: a user of coolture-aws's `db/local-dev-seed.sql`, or the guest. */
export interface DevUser {
  id: string;
  label: string;
  /** What sets them apart, shown under the name. */
  note: string;
  headers: Record<string, string>;
}

const seedUser = (
  id: string,
  username: string,
  label: string,
  note: string,
  extraHeaders: Record<string, string> = {},
): DevUser => ({
  id,
  label,
  note,
  headers: { 'X-User-Id': id, 'X-User-Name': username, ...extraHeaders },
});

/** No header at all means local_dev to the local API, so a guest says it out loud. */
export const GUEST: DevUser = {
  id: 'guest',
  label: 'Gość',
  note: 'niezalogowany',
  headers: { 'X-Anonymous': 'true' },
};

export const DEV_USERS: readonly DevUser[] = [
  seedUser('00000000-0000-0000-0000-000000000002', 'anna_demo', 'Anna', 'koncerty, indie, kluby'),
  seedUser('00000000-0000-0000-0000-000000000003', 'jan_demo', 'Jan', 'teatr, stand-up, kino'),
  seedUser(
    '00000000-0000-0000-0000-000000000004',
    'ola_demo',
    'Ola',
    'galerie, bieganie, jedzenie',
  ),
  seedUser(
    '00000000-0000-0000-0000-00000000b07a',
    'coolture_bot',
    'Bot',
    'autor wydarzeń z trojmiasto.pl',
  ),
  seedUser('00000000-0000-0000-0000-000000000001', 'local_dev', 'local_dev', 'admin', {
    'X-User-Role': 'COOLTURE_ADMIN',
  }),
  GUEST,
];
