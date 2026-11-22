import { ParticipationType } from './enums';

/** Why a guest is asked to sign in: a page that needs it, or something they tapped. */
export type SignInReason =
  | 'addPost'
  | 'editPost'
  | 'plans'
  | 'profile'
  | 'user'
  | 'people'
  | 'settings'
  | 'interests'
  | 'like'
  | 'interested'
  | 'takesPart'
  | 'notForMe'
  | 'comment';

export const STANCE_SIGN_IN_REASONS: Record<ParticipationType, SignInReason> = {
  INTERESTED: 'interested',
  TAKES_PART: 'takesPart',
  NOT_INTERESTED: 'notForMe',
};
