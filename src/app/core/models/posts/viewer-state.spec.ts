import { ViewerState, withLike, withStance } from './viewer-state';

describe('viewer state', () => {
  const state: ViewerState = { positiveReactionCount: 3, interestedCount: 2, goingCount: 1 };

  it('a like takes back "Nie dla mnie"', () => {
    const hidden: ViewerState = { ...state, myParticipation: 'NOT_INTERESTED' };

    expect(withLike(hidden, true)).toEqual({
      ...state,
      myReaction: 'LIKE',
      myParticipation: undefined,
      positiveReactionCount: 4,
    });
  });

  it('"Nie dla mnie" takes back the like and is never counted', () => {
    const liked: ViewerState = { ...state, myReaction: 'LIKE' };

    expect(withStance(liked, 'NOT_INTERESTED')).toEqual({
      ...state,
      myReaction: undefined,
      myParticipation: 'NOT_INTERESTED',
      positiveReactionCount: 2,
    });
  });

  it('moves a stance from one count to the other', () => {
    const interested: ViewerState = { ...state, myParticipation: 'INTERESTED' };

    expect(withStance(interested, 'TAKES_PART')).toEqual(
      jasmine.objectContaining({
        myParticipation: 'TAKES_PART',
        interestedCount: 1,
        goingCount: 2,
      }),
    );
  });
});
