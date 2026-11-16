import type { Map as MapLibreMap } from 'maplibre-gl';
import { labelLanguage } from './map-style';

describe('labelLanguage', () => {
  const liberty = [
    'case',
    ['has', 'name:nonlatin'],
    ['concat', ['get', 'name:latin'], '\n', ['get', 'name:nonlatin']],
    ['coalesce', ['get', 'name_en'], ['get', 'name']],
  ];

  function fakeMap(fields: Record<string, unknown>) {
    const map = {
      getStyle: () => ({
        layers: [
          ...Object.keys(fields).map((id) => ({ id, type: 'symbol' })),
          { id: 'water', type: 'fill' },
        ],
      }),
      getLayoutProperty: (id: string) => fields[id],
      setLayoutProperty: jasmine
        .createSpy('setLayoutProperty')
        .and.callFake((id: string, _: string, value: unknown) => (fields[id] = value)),
    };
    return { map, fields };
  }

  it('reads Polish names first in Polish, and Liberty’s again in English', () => {
    const { map, fields } = fakeMap({ water_name: liberty, shield: ['to-string', ['get', 'ref']] });
    labelLanguage(map as unknown as MapLibreMap, 'pl');
    expect(fields['water_name']).toEqual([
      'coalesce',
      ['get', 'name:pl'],
      [...liberty.slice(0, 3), ['coalesce', ['get', 'name'], ['get', 'name']]],
    ]);
    expect(fields['shield']).toEqual(['to-string', ['get', 'ref']]);

    labelLanguage(map as unknown as MapLibreMap, 'en');
    expect(fields['water_name']).toEqual(liberty);
    expect(map.setLayoutProperty).toHaveBeenCalledTimes(2);
  });
});
