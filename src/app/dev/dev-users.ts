/** A user of coolture-aws's `db/local-dev-seed.sql` that the dev menu can act as. */
export interface DevUser {
  id: string;
  username: string;
  label: string;
  /** What sets them apart, shown under the name. */
  note: string;
  /** Sent as X-User-Role. Without one the local API treats them as a regular user. */
  role?: string;
}

export const DEV_USERS: readonly DevUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000002',
    username: 'anna_demo',
    label: 'Anna',
    note: 'koncerty, indie, kluby',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    username: 'jan_demo',
    label: 'Jan',
    note: 'teatr, stand-up, kino',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    username: 'ola_demo',
    label: 'Ola',
    note: 'galerie, bieganie, jedzenie',
  },
  {
    id: '00000000-0000-0000-0000-00000000b07a',
    username: 'coolture_bot',
    label: 'Bot',
    note: 'autor wydarzeń z trojmiasto.pl',
  },
  {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'local_dev',
    label: 'local_dev',
    note: 'admin',
    role: 'COOLTURE_ADMIN',
  },
];
