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

/** Each note sums up the persona's kinds and topics in coolture-aws's `db/local-dev-seed.sql`: change them together. */
export const DEV_USERS: readonly DevUser[] = [
  seedUser(
    '00000000-0000-0000-0000-000000000002',
    'anna_demo',
    'Anna',
    'koncerty, imprezy: indie, elektronika, kluby',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000003',
    'jan_demo',
    'Jan',
    'scena, kino: teatr, stand-up, kino autorskie',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000004',
    'ola_demo',
    'Ola',
    'wystawy, kulinaria, sport: galerie, bieganie',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000005',
    'kasia_demo',
    'Kasia',
    'koncerty: rock, metal, jazz',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000006',
    'piotr_demo',
    'Piotr',
    'koncerty, scena: klasyka, opera, balet',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000007',
    'ewa_demo',
    'Ewa',
    'z dziećmi: warsztaty, festyny, rękodzieło',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000008',
    'tomek_demo',
    'Tomek',
    'kino, gry: planszówki, RPG, sci-fi',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000009',
    'zofia_demo',
    'Zofia',
    'wykłady, spacery: historia, architektura',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000010',
    'marek_demo',
    'Marek',
    'wykłady, akcje: technologia, ekologia',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000011',
    'magda_demo',
    'Magda',
    'warsztaty, imprezy: taniec, hip-hop',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000012',
    'bartek_demo',
    'Bartek',
    'tylko rodzaje: sport, spacery',
  ),
  seedUser(
    '00000000-0000-0000-0000-000000000013',
    'iza_demo',
    'Iza',
    'warsztaty, wellness: joga, ceramika, wege',
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
