export type PhotoData = {
  id: string;
  title: string;
  description: string;
  authorNickname: string | null;
  small: string;
  large: string;
};

export type GetPhotosResponse = {
  photoData: PhotoData[];
};

export type AuthenticatedUser = {
  sub: string | null;
  email: string | null;
  emailVerified: boolean | null;
};

export type UserProfile = {
  sub: string;
  email: string;
  nickname: string | null;
};
