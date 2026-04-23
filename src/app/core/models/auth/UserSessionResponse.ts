import { UserRole } from './role';

// this interface is used for getting a response from auth service in checkSession()
export interface UserSessionResponse {
  role: UserRole;
  userId: string;
}
