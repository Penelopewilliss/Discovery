import { Conversation } from '../types';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ProfileSetup: { name: string; username: string; email: string };
};

export type RootStackParamList = {
  MainApp: undefined;
  Chat: { conversation: Conversation };
  OtherUserProfile: { userId: string };
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  Chat: { conversation: Conversation };
};
