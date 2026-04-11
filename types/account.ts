export interface AccountProfile {
  id: string;
  displayName: string;
  email: string;
  phoneNumber: string | null;
  profileImageUrl: string | null;
}

export interface AccountProfileResponse {
  account: AccountProfile;
}

export interface UpdateAccountProfileInput {
  displayName: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  profileImageUrl?: string | null;
}
