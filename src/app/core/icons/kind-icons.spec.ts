import { KIND_KEYS, kindIcon } from './kind-icons';

describe('kind icons', () => {
  // The map's pins draw these with `svgShapes`, which only knows these tags: any other would draw in part.
  it('hold only the tags the map draws', () => {
    for (const key of [...KIND_KEYS, 'no_such_kind']) {
      const tags = [...kindIcon(key).matchAll(/<(\w+)/g)].map(([, tag]) => tag);

      expect(tags.length).withContext(key).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(['svg', 'path', 'circle', 'line', 'rect'])
          .withContext(`${key}: <${tag}>`)
          .toContain(tag);
      }
    }
  });
});
