import { toMark } from './map-focus';
import { PostCard } from '../../models/posts/post-card.model';

describe('toMark', () => {
  const card = {
    id: 'a',
    title: 'Koncert',
    startsAt: '2026-12-01T18:00:00Z',
    description: 'Jazz\n\nw hali',
    positiveReactionCount: 3,
    participantCount: 3,
    interestedCount: 2,
    goingCount: 1,
    type: 'OFFLINE',
    location: { city: 'Gdańsk', coordinates: { latitude: 54.35, longitude: 18.6 } },
    myParticipation: 'INTERESTED',
  } as PostCard;

  it("keeps the card's counts and stance, so its mini view shows them", () => {
    expect(toMark(card)).toEqual(
      jasmine.objectContaining({
        positiveReactionCount: 3,
        interestedCount: 2,
        goingCount: 1,
        myParticipation: 'INTERESTED',
        excerpt: 'Jazz\n\nw hali',
        city: 'Gdańsk',
      }),
    );
  });

  it('gives nothing for a post with no point', () => {
    expect(toMark({ ...card, type: 'ONLINE' })).toBeNull();
  });
});
