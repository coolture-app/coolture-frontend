import { ParticipationType, ReactionType } from '../common/enums';

/** A post as the viewer left it: their own like and stance, and the counts those move. */
export interface ViewerState {
  myReaction?: ReactionType;
  myParticipation?: ParticipationType;
  positiveReactionCount: number;
  interestedCount: number;
  goingCount: number;
}

/** Only the viewer's part of a card, post or mark. */
export function viewerState(post: ViewerState): ViewerState {
  const { myReaction, myParticipation, positiveReactionCount, interestedCount, goingCount } = post;
  return { myReaction, myParticipation, positiveReactionCount, interestedCount, goingCount };
}

/** A like takes back "Nie dla mnie", as the server does. */
export function withLike(state: ViewerState, liked: boolean): ViewerState {
  if ((state.myReaction === 'LIKE') === liked) {
    return state;
  }
  return {
    ...state,
    myReaction: liked ? 'LIKE' : undefined,
    myParticipation:
      liked && state.myParticipation === 'NOT_INTERESTED' ? undefined : state.myParticipation,
    positiveReactionCount: state.positiveReactionCount + (liked ? 1 : -1),
  };
}

/**
 * One stance at a time: setting one takes the other off its count. "Nie dla mnie" is never counted and takes back
 * the like, as the server does.
 */
export function withStance(state: ViewerState, next: ParticipationType | undefined): ViewerState {
  const was = state.myParticipation;
  const change = (stance: ParticipationType) =>
    (next === stance ? 1 : 0) - (was === stance ? 1 : 0);
  const dropsLike = next === 'NOT_INTERESTED' && state.myReaction === 'LIKE';
  return {
    ...state,
    myParticipation: next,
    myReaction: dropsLike ? undefined : state.myReaction,
    positiveReactionCount: state.positiveReactionCount - (dropsLike ? 1 : 0),
    interestedCount: state.interestedCount + change('INTERESTED'),
    goingCount: state.goingCount + change('TAKES_PART'),
  };
}

/** `participantCount`, which the API counts the same way. */
export function participants(state: ViewerState): number {
  return state.interestedCount + state.goingCount;
}
