import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AddChatParticipantsData {
  participantA: ChatParticipant_Key;
  participantB: ChatParticipant_Key;
}

export interface AddChatParticipantsVariables {
  chatId: UUIDString;
  userAId: UUIDString;
  userBId: UUIDString;
  now: TimestampString;
}

export interface ChatParticipant_Key {
  chatId: UUIDString;
  userId: UUIDString;
  __typename?: 'ChatParticipant_Key';
}

export interface Chat_Key {
  id: UUIDString;
  __typename?: 'Chat_Key';
}

export interface Contact_Key {
  ownerId: UUIDString;
  contactId: UUIDString;
  __typename?: 'Contact_Key';
}

export interface CreateChatData {
  chat_insert: Chat_Key;
}

export interface CreateChatVariables {
  now: TimestampString;
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface CreateUserVariables {
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  now: TimestampString;
}

export interface FindExistingChatData {
  chatParticipants: ({
    chat: {
      id: UUIDString;
    } & Chat_Key;
  })[];
}

export interface FindExistingChatVariables {
  otherUserId: UUIDString;
}

export interface GetChatMessagesData {
  messages: ({
    id: UUIDString;
    content: string;
    messageType: string;
    status: string;
    createdAt: TimestampString;
    sender: {
      id: UUIDString;
      username: string;
      profilePictureUrl?: string | null;
    } & User_Key;
  } & Message_Key)[];
}

export interface GetChatMessagesVariables {
  chatId: UUIDString;
}

export interface GetMyChatsData {
  chatParticipants: ({
    chat: {
      id: UUIDString;
      isGroup: boolean;
      lastMessageText?: string | null;
      lastMessageAt?: TimestampString | null;
    } & Chat_Key;
      unreadCount: number;
  })[];
}

export interface GetUserProfileData {
  user?: {
    id: UUIDString;
    username: string;
    name: string;
    profilePictureUrl?: string | null;
    bio?: string | null;
    lastOnlineAt?: TimestampString | null;
  } & User_Key;
}

export interface GetUserProfileVariables {
  userId: UUIDString;
}

export interface Message_Key {
  id: UUIDString;
  __typename?: 'Message_Key';
}

export interface SearchUsersByUsernameData {
  users: ({
    id: UUIDString;
    username: string;
    name: string;
    profilePictureUrl?: string | null;
    bio?: string | null;
    lastOnlineAt?: TimestampString | null;
  } & User_Key)[];
}

export interface SearchUsersByUsernameVariables {
  query: string;
}

export interface SendMessageData {
  message_insert: Message_Key;
}

export interface SendMessageVariables {
  chatId: UUIDString;
  senderId: UUIDString;
  receiverId: UUIDString;
  content: string;
  messageType: string;
  now: TimestampString;
}

export interface Status_Key {
  id: UUIDString;
  __typename?: 'Status_Key';
}

export interface UpdateLastSeenData {
  user_update?: User_Key | null;
}

export interface UpdateLastSeenVariables {
  userId: UUIDString;
  now: TimestampString;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface SendMessageRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
  operationName: string;
}
export const sendMessageRef: SendMessageRef;

export function sendMessage(vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;
export function sendMessage(dc: DataConnect, vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;

interface CreateChatRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateChatVariables): MutationRef<CreateChatData, CreateChatVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateChatVariables): MutationRef<CreateChatData, CreateChatVariables>;
  operationName: string;
}
export const createChatRef: CreateChatRef;

export function createChat(vars: CreateChatVariables): MutationPromise<CreateChatData, CreateChatVariables>;
export function createChat(dc: DataConnect, vars: CreateChatVariables): MutationPromise<CreateChatData, CreateChatVariables>;

interface AddChatParticipantsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddChatParticipantsVariables): MutationRef<AddChatParticipantsData, AddChatParticipantsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddChatParticipantsVariables): MutationRef<AddChatParticipantsData, AddChatParticipantsVariables>;
  operationName: string;
}
export const addChatParticipantsRef: AddChatParticipantsRef;

export function addChatParticipants(vars: AddChatParticipantsVariables): MutationPromise<AddChatParticipantsData, AddChatParticipantsVariables>;
export function addChatParticipants(dc: DataConnect, vars: AddChatParticipantsVariables): MutationPromise<AddChatParticipantsData, AddChatParticipantsVariables>;

interface UpdateLastSeenRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateLastSeenVariables): MutationRef<UpdateLastSeenData, UpdateLastSeenVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateLastSeenVariables): MutationRef<UpdateLastSeenData, UpdateLastSeenVariables>;
  operationName: string;
}
export const updateLastSeenRef: UpdateLastSeenRef;

export function updateLastSeen(vars: UpdateLastSeenVariables): MutationPromise<UpdateLastSeenData, UpdateLastSeenVariables>;
export function updateLastSeen(dc: DataConnect, vars: UpdateLastSeenVariables): MutationPromise<UpdateLastSeenData, UpdateLastSeenVariables>;

interface GetMyChatsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyChatsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyChatsData, undefined>;
  operationName: string;
}
export const getMyChatsRef: GetMyChatsRef;

export function getMyChats(options?: ExecuteQueryOptions): QueryPromise<GetMyChatsData, undefined>;
export function getMyChats(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyChatsData, undefined>;

interface FindExistingChatRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: FindExistingChatVariables): QueryRef<FindExistingChatData, FindExistingChatVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: FindExistingChatVariables): QueryRef<FindExistingChatData, FindExistingChatVariables>;
  operationName: string;
}
export const findExistingChatRef: FindExistingChatRef;

export function findExistingChat(vars: FindExistingChatVariables, options?: ExecuteQueryOptions): QueryPromise<FindExistingChatData, FindExistingChatVariables>;
export function findExistingChat(dc: DataConnect, vars: FindExistingChatVariables, options?: ExecuteQueryOptions): QueryPromise<FindExistingChatData, FindExistingChatVariables>;

interface GetChatMessagesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetChatMessagesVariables): QueryRef<GetChatMessagesData, GetChatMessagesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetChatMessagesVariables): QueryRef<GetChatMessagesData, GetChatMessagesVariables>;
  operationName: string;
}
export const getChatMessagesRef: GetChatMessagesRef;

export function getChatMessages(vars: GetChatMessagesVariables, options?: ExecuteQueryOptions): QueryPromise<GetChatMessagesData, GetChatMessagesVariables>;
export function getChatMessages(dc: DataConnect, vars: GetChatMessagesVariables, options?: ExecuteQueryOptions): QueryPromise<GetChatMessagesData, GetChatMessagesVariables>;

interface GetUserProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserProfileVariables): QueryRef<GetUserProfileData, GetUserProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserProfileVariables): QueryRef<GetUserProfileData, GetUserProfileVariables>;
  operationName: string;
}
export const getUserProfileRef: GetUserProfileRef;

export function getUserProfile(vars: GetUserProfileVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserProfileData, GetUserProfileVariables>;
export function getUserProfile(dc: DataConnect, vars: GetUserProfileVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserProfileData, GetUserProfileVariables>;

interface SearchUsersByUsernameRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SearchUsersByUsernameVariables): QueryRef<SearchUsersByUsernameData, SearchUsersByUsernameVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SearchUsersByUsernameVariables): QueryRef<SearchUsersByUsernameData, SearchUsersByUsernameVariables>;
  operationName: string;
}
export const searchUsersByUsernameRef: SearchUsersByUsernameRef;

export function searchUsersByUsername(vars: SearchUsersByUsernameVariables, options?: ExecuteQueryOptions): QueryPromise<SearchUsersByUsernameData, SearchUsersByUsernameVariables>;
export function searchUsersByUsername(dc: DataConnect, vars: SearchUsersByUsernameVariables, options?: ExecuteQueryOptions): QueryPromise<SearchUsersByUsernameData, SearchUsersByUsernameVariables>;

