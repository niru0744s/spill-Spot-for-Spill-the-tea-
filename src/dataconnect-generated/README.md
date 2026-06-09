# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `default-connector`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetMyChats*](#getmychats)
  - [*GetChatDetails*](#getchatdetails)
  - [*GetDiscoverGroups*](#getdiscovergroups)
  - [*FindExistingChat*](#findexistingchat)
  - [*GetChatMessages*](#getchatmessages)
  - [*GetUserProfile*](#getuserprofile)
  - [*SearchUsersByUsername*](#searchusersbyusername)
- [**Mutations**](#mutations)
  - [*CreateUser*](#createuser)
  - [*SendMessage*](#sendmessage)
  - [*CreateChat*](#createchat)
  - [*AddChatParticipants*](#addchatparticipants)
  - [*CreateGroupChat*](#creategroupchat)
  - [*AddGroupParticipant*](#addgroupparticipant)
  - [*UpdateGroupParticipant*](#updategroupparticipant)
  - [*RemoveGroupParticipant*](#removegroupparticipant)
  - [*UpdateGroupMetadata*](#updategroupmetadata)
  - [*UpdateLastSeen*](#updatelastseen)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `default-connector`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default-connector` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetMyChats
You can execute the `GetMyChats` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyChats(options?: ExecuteQueryOptions): QueryPromise<GetMyChatsData, undefined>;

interface GetMyChatsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyChatsData, undefined>;
}
export const getMyChatsRef: GetMyChatsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyChats(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyChatsData, undefined>;

interface GetMyChatsRef {
  ...
  (dc: DataConnect): QueryRef<GetMyChatsData, undefined>;
}
export const getMyChatsRef: GetMyChatsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyChatsRef:
```typescript
const name = getMyChatsRef.operationName;
console.log(name);
```

### Variables
The `GetMyChats` query has no variables.
### Return Type
Recall that executing the `GetMyChats` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyChatsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyChatsData {
  chatParticipants: ({
    chat: {
      id: UUIDString;
      isGroup: boolean;
      lastMessageText?: string | null;
      lastMessageAt?: TimestampString | null;
      groupName?: string | null;
      groupImageUrl?: string | null;
      groupDescription?: string | null;
    } & Chat_Key;
    unreadCount: number;
    isAdmin?: boolean | null;
    status?: string | null;
  })[];
}
```
### Using `GetMyChats`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyChats } from '@dataconnect/generated';


// Call the `getMyChats()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyChats();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyChats(dataConnect);

console.log(data.chatParticipants);

// Or, you can use the `Promise` API.
getMyChats().then((response) => {
  const data = response.data;
  console.log(data.chatParticipants);
});
```

### Using `GetMyChats`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyChatsRef } from '@dataconnect/generated';


// Call the `getMyChatsRef()` function to get a reference to the query.
const ref = getMyChatsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyChatsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.chatParticipants);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.chatParticipants);
});
```

## GetChatDetails
You can execute the `GetChatDetails` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getChatDetails(vars: GetChatDetailsVariables, options?: ExecuteQueryOptions): QueryPromise<GetChatDetailsData, GetChatDetailsVariables>;

interface GetChatDetailsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetChatDetailsVariables): QueryRef<GetChatDetailsData, GetChatDetailsVariables>;
}
export const getChatDetailsRef: GetChatDetailsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getChatDetails(dc: DataConnect, vars: GetChatDetailsVariables, options?: ExecuteQueryOptions): QueryPromise<GetChatDetailsData, GetChatDetailsVariables>;

interface GetChatDetailsRef {
  ...
  (dc: DataConnect, vars: GetChatDetailsVariables): QueryRef<GetChatDetailsData, GetChatDetailsVariables>;
}
export const getChatDetailsRef: GetChatDetailsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getChatDetailsRef:
```typescript
const name = getChatDetailsRef.operationName;
console.log(name);
```

### Variables
The `GetChatDetails` query requires an argument of type `GetChatDetailsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetChatDetailsVariables {
  chatId: UUIDString;
}
```
### Return Type
Recall that executing the `GetChatDetails` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetChatDetailsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetChatDetailsData {
  chat?: {
    id: UUIDString;
    isGroup: boolean;
    groupName?: string | null;
    groupImageUrl?: string | null;
    groupDescription?: string | null;
    createdAt: TimestampString;
    chatParticipants_on_chat: ({
      user: {
        id: UUIDString;
        username: string;
        name: string;
        profilePictureUrl?: string | null;
        bio?: string | null;
        lastOnlineAt?: TimestampString | null;
      } & User_Key;
      joinedAt: TimestampString;
      unreadCount: number;
      isAdmin?: boolean | null;
      status?: string | null;
    })[];
  } & Chat_Key;
}
```
### Using `GetChatDetails`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getChatDetails, GetChatDetailsVariables } from '@dataconnect/generated';

// The `GetChatDetails` query requires an argument of type `GetChatDetailsVariables`:
const getChatDetailsVars: GetChatDetailsVariables = {
  chatId: ..., 
};

// Call the `getChatDetails()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getChatDetails(getChatDetailsVars);
// Variables can be defined inline as well.
const { data } = await getChatDetails({ chatId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getChatDetails(dataConnect, getChatDetailsVars);

console.log(data.chat);

// Or, you can use the `Promise` API.
getChatDetails(getChatDetailsVars).then((response) => {
  const data = response.data;
  console.log(data.chat);
});
```

### Using `GetChatDetails`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getChatDetailsRef, GetChatDetailsVariables } from '@dataconnect/generated';

// The `GetChatDetails` query requires an argument of type `GetChatDetailsVariables`:
const getChatDetailsVars: GetChatDetailsVariables = {
  chatId: ..., 
};

// Call the `getChatDetailsRef()` function to get a reference to the query.
const ref = getChatDetailsRef(getChatDetailsVars);
// Variables can be defined inline as well.
const ref = getChatDetailsRef({ chatId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getChatDetailsRef(dataConnect, getChatDetailsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.chat);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.chat);
});
```

## GetDiscoverGroups
You can execute the `GetDiscoverGroups` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getDiscoverGroups(options?: ExecuteQueryOptions): QueryPromise<GetDiscoverGroupsData, undefined>;

interface GetDiscoverGroupsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetDiscoverGroupsData, undefined>;
}
export const getDiscoverGroupsRef: GetDiscoverGroupsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getDiscoverGroups(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetDiscoverGroupsData, undefined>;

interface GetDiscoverGroupsRef {
  ...
  (dc: DataConnect): QueryRef<GetDiscoverGroupsData, undefined>;
}
export const getDiscoverGroupsRef: GetDiscoverGroupsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getDiscoverGroupsRef:
```typescript
const name = getDiscoverGroupsRef.operationName;
console.log(name);
```

### Variables
The `GetDiscoverGroups` query has no variables.
### Return Type
Recall that executing the `GetDiscoverGroups` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetDiscoverGroupsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetDiscoverGroupsData {
  chats: ({
    id: UUIDString;
    groupName?: string | null;
    groupImageUrl?: string | null;
    groupDescription?: string | null;
    createdAt: TimestampString;
    chatParticipants_on_chat: ({
      user: {
        id: UUIDString;
      } & User_Key;
    })[];
  } & Chat_Key)[];
}
```
### Using `GetDiscoverGroups`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getDiscoverGroups } from '@dataconnect/generated';


// Call the `getDiscoverGroups()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getDiscoverGroups();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getDiscoverGroups(dataConnect);

console.log(data.chats);

// Or, you can use the `Promise` API.
getDiscoverGroups().then((response) => {
  const data = response.data;
  console.log(data.chats);
});
```

### Using `GetDiscoverGroups`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getDiscoverGroupsRef } from '@dataconnect/generated';


// Call the `getDiscoverGroupsRef()` function to get a reference to the query.
const ref = getDiscoverGroupsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getDiscoverGroupsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.chats);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.chats);
});
```

## FindExistingChat
You can execute the `FindExistingChat` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
findExistingChat(vars: FindExistingChatVariables, options?: ExecuteQueryOptions): QueryPromise<FindExistingChatData, FindExistingChatVariables>;

interface FindExistingChatRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: FindExistingChatVariables): QueryRef<FindExistingChatData, FindExistingChatVariables>;
}
export const findExistingChatRef: FindExistingChatRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
findExistingChat(dc: DataConnect, vars: FindExistingChatVariables, options?: ExecuteQueryOptions): QueryPromise<FindExistingChatData, FindExistingChatVariables>;

interface FindExistingChatRef {
  ...
  (dc: DataConnect, vars: FindExistingChatVariables): QueryRef<FindExistingChatData, FindExistingChatVariables>;
}
export const findExistingChatRef: FindExistingChatRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the findExistingChatRef:
```typescript
const name = findExistingChatRef.operationName;
console.log(name);
```

### Variables
The `FindExistingChat` query requires an argument of type `FindExistingChatVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface FindExistingChatVariables {
  otherUserId: UUIDString;
}
```
### Return Type
Recall that executing the `FindExistingChat` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `FindExistingChatData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface FindExistingChatData {
  chatParticipants: ({
    chat: {
      id: UUIDString;
    } & Chat_Key;
  })[];
}
```
### Using `FindExistingChat`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, findExistingChat, FindExistingChatVariables } from '@dataconnect/generated';

// The `FindExistingChat` query requires an argument of type `FindExistingChatVariables`:
const findExistingChatVars: FindExistingChatVariables = {
  otherUserId: ..., 
};

// Call the `findExistingChat()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await findExistingChat(findExistingChatVars);
// Variables can be defined inline as well.
const { data } = await findExistingChat({ otherUserId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await findExistingChat(dataConnect, findExistingChatVars);

console.log(data.chatParticipants);

// Or, you can use the `Promise` API.
findExistingChat(findExistingChatVars).then((response) => {
  const data = response.data;
  console.log(data.chatParticipants);
});
```

### Using `FindExistingChat`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, findExistingChatRef, FindExistingChatVariables } from '@dataconnect/generated';

// The `FindExistingChat` query requires an argument of type `FindExistingChatVariables`:
const findExistingChatVars: FindExistingChatVariables = {
  otherUserId: ..., 
};

// Call the `findExistingChatRef()` function to get a reference to the query.
const ref = findExistingChatRef(findExistingChatVars);
// Variables can be defined inline as well.
const ref = findExistingChatRef({ otherUserId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = findExistingChatRef(dataConnect, findExistingChatVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.chatParticipants);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.chatParticipants);
});
```

## GetChatMessages
You can execute the `GetChatMessages` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getChatMessages(vars: GetChatMessagesVariables, options?: ExecuteQueryOptions): QueryPromise<GetChatMessagesData, GetChatMessagesVariables>;

interface GetChatMessagesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetChatMessagesVariables): QueryRef<GetChatMessagesData, GetChatMessagesVariables>;
}
export const getChatMessagesRef: GetChatMessagesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getChatMessages(dc: DataConnect, vars: GetChatMessagesVariables, options?: ExecuteQueryOptions): QueryPromise<GetChatMessagesData, GetChatMessagesVariables>;

interface GetChatMessagesRef {
  ...
  (dc: DataConnect, vars: GetChatMessagesVariables): QueryRef<GetChatMessagesData, GetChatMessagesVariables>;
}
export const getChatMessagesRef: GetChatMessagesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getChatMessagesRef:
```typescript
const name = getChatMessagesRef.operationName;
console.log(name);
```

### Variables
The `GetChatMessages` query requires an argument of type `GetChatMessagesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetChatMessagesVariables {
  chatId: UUIDString;
}
```
### Return Type
Recall that executing the `GetChatMessages` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetChatMessagesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetChatMessages`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getChatMessages, GetChatMessagesVariables } from '@dataconnect/generated';

// The `GetChatMessages` query requires an argument of type `GetChatMessagesVariables`:
const getChatMessagesVars: GetChatMessagesVariables = {
  chatId: ..., 
};

// Call the `getChatMessages()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getChatMessages(getChatMessagesVars);
// Variables can be defined inline as well.
const { data } = await getChatMessages({ chatId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getChatMessages(dataConnect, getChatMessagesVars);

console.log(data.messages);

// Or, you can use the `Promise` API.
getChatMessages(getChatMessagesVars).then((response) => {
  const data = response.data;
  console.log(data.messages);
});
```

### Using `GetChatMessages`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getChatMessagesRef, GetChatMessagesVariables } from '@dataconnect/generated';

// The `GetChatMessages` query requires an argument of type `GetChatMessagesVariables`:
const getChatMessagesVars: GetChatMessagesVariables = {
  chatId: ..., 
};

// Call the `getChatMessagesRef()` function to get a reference to the query.
const ref = getChatMessagesRef(getChatMessagesVars);
// Variables can be defined inline as well.
const ref = getChatMessagesRef({ chatId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getChatMessagesRef(dataConnect, getChatMessagesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.messages);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.messages);
});
```

## GetUserProfile
You can execute the `GetUserProfile` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserProfile(vars: GetUserProfileVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserProfileData, GetUserProfileVariables>;

interface GetUserProfileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserProfileVariables): QueryRef<GetUserProfileData, GetUserProfileVariables>;
}
export const getUserProfileRef: GetUserProfileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserProfile(dc: DataConnect, vars: GetUserProfileVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserProfileData, GetUserProfileVariables>;

interface GetUserProfileRef {
  ...
  (dc: DataConnect, vars: GetUserProfileVariables): QueryRef<GetUserProfileData, GetUserProfileVariables>;
}
export const getUserProfileRef: GetUserProfileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserProfileRef:
```typescript
const name = getUserProfileRef.operationName;
console.log(name);
```

### Variables
The `GetUserProfile` query requires an argument of type `GetUserProfileVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserProfileVariables {
  userId: UUIDString;
}
```
### Return Type
Recall that executing the `GetUserProfile` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserProfileData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetUserProfile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserProfile, GetUserProfileVariables } from '@dataconnect/generated';

// The `GetUserProfile` query requires an argument of type `GetUserProfileVariables`:
const getUserProfileVars: GetUserProfileVariables = {
  userId: ..., 
};

// Call the `getUserProfile()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserProfile(getUserProfileVars);
// Variables can be defined inline as well.
const { data } = await getUserProfile({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserProfile(dataConnect, getUserProfileVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserProfile(getUserProfileVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserProfile`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserProfileRef, GetUserProfileVariables } from '@dataconnect/generated';

// The `GetUserProfile` query requires an argument of type `GetUserProfileVariables`:
const getUserProfileVars: GetUserProfileVariables = {
  userId: ..., 
};

// Call the `getUserProfileRef()` function to get a reference to the query.
const ref = getUserProfileRef(getUserProfileVars);
// Variables can be defined inline as well.
const ref = getUserProfileRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserProfileRef(dataConnect, getUserProfileVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## SearchUsersByUsername
You can execute the `SearchUsersByUsername` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
searchUsersByUsername(vars: SearchUsersByUsernameVariables, options?: ExecuteQueryOptions): QueryPromise<SearchUsersByUsernameData, SearchUsersByUsernameVariables>;

interface SearchUsersByUsernameRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: SearchUsersByUsernameVariables): QueryRef<SearchUsersByUsernameData, SearchUsersByUsernameVariables>;
}
export const searchUsersByUsernameRef: SearchUsersByUsernameRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
searchUsersByUsername(dc: DataConnect, vars: SearchUsersByUsernameVariables, options?: ExecuteQueryOptions): QueryPromise<SearchUsersByUsernameData, SearchUsersByUsernameVariables>;

interface SearchUsersByUsernameRef {
  ...
  (dc: DataConnect, vars: SearchUsersByUsernameVariables): QueryRef<SearchUsersByUsernameData, SearchUsersByUsernameVariables>;
}
export const searchUsersByUsernameRef: SearchUsersByUsernameRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the searchUsersByUsernameRef:
```typescript
const name = searchUsersByUsernameRef.operationName;
console.log(name);
```

### Variables
The `SearchUsersByUsername` query requires an argument of type `SearchUsersByUsernameVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface SearchUsersByUsernameVariables {
  query: string;
}
```
### Return Type
Recall that executing the `SearchUsersByUsername` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `SearchUsersByUsernameData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `SearchUsersByUsername`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, searchUsersByUsername, SearchUsersByUsernameVariables } from '@dataconnect/generated';

// The `SearchUsersByUsername` query requires an argument of type `SearchUsersByUsernameVariables`:
const searchUsersByUsernameVars: SearchUsersByUsernameVariables = {
  query: ..., 
};

// Call the `searchUsersByUsername()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await searchUsersByUsername(searchUsersByUsernameVars);
// Variables can be defined inline as well.
const { data } = await searchUsersByUsername({ query: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await searchUsersByUsername(dataConnect, searchUsersByUsernameVars);

console.log(data.users);

// Or, you can use the `Promise` API.
searchUsersByUsername(searchUsersByUsernameVars).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `SearchUsersByUsername`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, searchUsersByUsernameRef, SearchUsersByUsernameVariables } from '@dataconnect/generated';

// The `SearchUsersByUsername` query requires an argument of type `SearchUsersByUsernameVariables`:
const searchUsersByUsernameVars: SearchUsersByUsernameVariables = {
  query: ..., 
};

// Call the `searchUsersByUsernameRef()` function to get a reference to the query.
const ref = searchUsersByUsernameRef(searchUsersByUsernameVars);
// Variables can be defined inline as well.
const ref = searchUsersByUsernameRef({ query: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = searchUsersByUsernameRef(dataConnect, searchUsersByUsernameVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default-connector` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation requires an argument of type `CreateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserVariables {
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_insert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  username: ..., 
  name: ..., 
  email: ..., 
  passwordHash: ..., 
  now: ..., 
};

// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser(createUserVars);
// Variables can be defined inline as well.
const { data } = await createUser({ username: ..., name: ..., email: ..., passwordHash: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect, createUserVars);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
createUser(createUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  username: ..., 
  name: ..., 
  email: ..., 
  passwordHash: ..., 
  now: ..., 
};

// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef(createUserVars);
// Variables can be defined inline as well.
const ref = createUserRef({ username: ..., name: ..., email: ..., passwordHash: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect, createUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## SendMessage
You can execute the `SendMessage` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
sendMessage(vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;

interface SendMessageRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
}
export const sendMessageRef: SendMessageRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
sendMessage(dc: DataConnect, vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;

interface SendMessageRef {
  ...
  (dc: DataConnect, vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
}
export const sendMessageRef: SendMessageRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the sendMessageRef:
```typescript
const name = sendMessageRef.operationName;
console.log(name);
```

### Variables
The `SendMessage` mutation requires an argument of type `SendMessageVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface SendMessageVariables {
  chatId: UUIDString;
  senderId: UUIDString;
  receiverId?: UUIDString | null;
  content: string;
  messageType: string;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `SendMessage` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `SendMessageData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface SendMessageData {
  message_insert: Message_Key;
}
```
### Using `SendMessage`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, sendMessage, SendMessageVariables } from '@dataconnect/generated';

// The `SendMessage` mutation requires an argument of type `SendMessageVariables`:
const sendMessageVars: SendMessageVariables = {
  chatId: ..., 
  senderId: ..., 
  receiverId: ..., // optional
  content: ..., 
  messageType: ..., 
  now: ..., 
};

// Call the `sendMessage()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await sendMessage(sendMessageVars);
// Variables can be defined inline as well.
const { data } = await sendMessage({ chatId: ..., senderId: ..., receiverId: ..., content: ..., messageType: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await sendMessage(dataConnect, sendMessageVars);

console.log(data.message_insert);

// Or, you can use the `Promise` API.
sendMessage(sendMessageVars).then((response) => {
  const data = response.data;
  console.log(data.message_insert);
});
```

### Using `SendMessage`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, sendMessageRef, SendMessageVariables } from '@dataconnect/generated';

// The `SendMessage` mutation requires an argument of type `SendMessageVariables`:
const sendMessageVars: SendMessageVariables = {
  chatId: ..., 
  senderId: ..., 
  receiverId: ..., // optional
  content: ..., 
  messageType: ..., 
  now: ..., 
};

// Call the `sendMessageRef()` function to get a reference to the mutation.
const ref = sendMessageRef(sendMessageVars);
// Variables can be defined inline as well.
const ref = sendMessageRef({ chatId: ..., senderId: ..., receiverId: ..., content: ..., messageType: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = sendMessageRef(dataConnect, sendMessageVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.message_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.message_insert);
});
```

## CreateChat
You can execute the `CreateChat` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createChat(vars: CreateChatVariables): MutationPromise<CreateChatData, CreateChatVariables>;

interface CreateChatRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateChatVariables): MutationRef<CreateChatData, CreateChatVariables>;
}
export const createChatRef: CreateChatRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createChat(dc: DataConnect, vars: CreateChatVariables): MutationPromise<CreateChatData, CreateChatVariables>;

interface CreateChatRef {
  ...
  (dc: DataConnect, vars: CreateChatVariables): MutationRef<CreateChatData, CreateChatVariables>;
}
export const createChatRef: CreateChatRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createChatRef:
```typescript
const name = createChatRef.operationName;
console.log(name);
```

### Variables
The `CreateChat` mutation requires an argument of type `CreateChatVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateChatVariables {
  now: TimestampString;
}
```
### Return Type
Recall that executing the `CreateChat` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateChatData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateChatData {
  chat_insert: Chat_Key;
}
```
### Using `CreateChat`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createChat, CreateChatVariables } from '@dataconnect/generated';

// The `CreateChat` mutation requires an argument of type `CreateChatVariables`:
const createChatVars: CreateChatVariables = {
  now: ..., 
};

// Call the `createChat()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createChat(createChatVars);
// Variables can be defined inline as well.
const { data } = await createChat({ now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createChat(dataConnect, createChatVars);

console.log(data.chat_insert);

// Or, you can use the `Promise` API.
createChat(createChatVars).then((response) => {
  const data = response.data;
  console.log(data.chat_insert);
});
```

### Using `CreateChat`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createChatRef, CreateChatVariables } from '@dataconnect/generated';

// The `CreateChat` mutation requires an argument of type `CreateChatVariables`:
const createChatVars: CreateChatVariables = {
  now: ..., 
};

// Call the `createChatRef()` function to get a reference to the mutation.
const ref = createChatRef(createChatVars);
// Variables can be defined inline as well.
const ref = createChatRef({ now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createChatRef(dataConnect, createChatVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.chat_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.chat_insert);
});
```

## AddChatParticipants
You can execute the `AddChatParticipants` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addChatParticipants(vars: AddChatParticipantsVariables): MutationPromise<AddChatParticipantsData, AddChatParticipantsVariables>;

interface AddChatParticipantsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddChatParticipantsVariables): MutationRef<AddChatParticipantsData, AddChatParticipantsVariables>;
}
export const addChatParticipantsRef: AddChatParticipantsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addChatParticipants(dc: DataConnect, vars: AddChatParticipantsVariables): MutationPromise<AddChatParticipantsData, AddChatParticipantsVariables>;

interface AddChatParticipantsRef {
  ...
  (dc: DataConnect, vars: AddChatParticipantsVariables): MutationRef<AddChatParticipantsData, AddChatParticipantsVariables>;
}
export const addChatParticipantsRef: AddChatParticipantsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addChatParticipantsRef:
```typescript
const name = addChatParticipantsRef.operationName;
console.log(name);
```

### Variables
The `AddChatParticipants` mutation requires an argument of type `AddChatParticipantsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddChatParticipantsVariables {
  chatId: UUIDString;
  userAId: UUIDString;
  userBId: UUIDString;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `AddChatParticipants` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddChatParticipantsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddChatParticipantsData {
  participantA: ChatParticipant_Key;
  participantB: ChatParticipant_Key;
}
```
### Using `AddChatParticipants`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addChatParticipants, AddChatParticipantsVariables } from '@dataconnect/generated';

// The `AddChatParticipants` mutation requires an argument of type `AddChatParticipantsVariables`:
const addChatParticipantsVars: AddChatParticipantsVariables = {
  chatId: ..., 
  userAId: ..., 
  userBId: ..., 
  now: ..., 
};

// Call the `addChatParticipants()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addChatParticipants(addChatParticipantsVars);
// Variables can be defined inline as well.
const { data } = await addChatParticipants({ chatId: ..., userAId: ..., userBId: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addChatParticipants(dataConnect, addChatParticipantsVars);

console.log(data.participantA);
console.log(data.participantB);

// Or, you can use the `Promise` API.
addChatParticipants(addChatParticipantsVars).then((response) => {
  const data = response.data;
  console.log(data.participantA);
  console.log(data.participantB);
});
```

### Using `AddChatParticipants`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addChatParticipantsRef, AddChatParticipantsVariables } from '@dataconnect/generated';

// The `AddChatParticipants` mutation requires an argument of type `AddChatParticipantsVariables`:
const addChatParticipantsVars: AddChatParticipantsVariables = {
  chatId: ..., 
  userAId: ..., 
  userBId: ..., 
  now: ..., 
};

// Call the `addChatParticipantsRef()` function to get a reference to the mutation.
const ref = addChatParticipantsRef(addChatParticipantsVars);
// Variables can be defined inline as well.
const ref = addChatParticipantsRef({ chatId: ..., userAId: ..., userBId: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addChatParticipantsRef(dataConnect, addChatParticipantsVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.participantA);
console.log(data.participantB);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.participantA);
  console.log(data.participantB);
});
```

## CreateGroupChat
You can execute the `CreateGroupChat` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createGroupChat(vars: CreateGroupChatVariables): MutationPromise<CreateGroupChatData, CreateGroupChatVariables>;

interface CreateGroupChatRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGroupChatVariables): MutationRef<CreateGroupChatData, CreateGroupChatVariables>;
}
export const createGroupChatRef: CreateGroupChatRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createGroupChat(dc: DataConnect, vars: CreateGroupChatVariables): MutationPromise<CreateGroupChatData, CreateGroupChatVariables>;

interface CreateGroupChatRef {
  ...
  (dc: DataConnect, vars: CreateGroupChatVariables): MutationRef<CreateGroupChatData, CreateGroupChatVariables>;
}
export const createGroupChatRef: CreateGroupChatRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createGroupChatRef:
```typescript
const name = createGroupChatRef.operationName;
console.log(name);
```

### Variables
The `CreateGroupChat` mutation requires an argument of type `CreateGroupChatVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateGroupChatVariables {
  groupName: string;
  groupImageUrl?: string | null;
  groupDescription?: string | null;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `CreateGroupChat` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateGroupChatData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateGroupChatData {
  chat_insert: Chat_Key;
}
```
### Using `CreateGroupChat`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createGroupChat, CreateGroupChatVariables } from '@dataconnect/generated';

// The `CreateGroupChat` mutation requires an argument of type `CreateGroupChatVariables`:
const createGroupChatVars: CreateGroupChatVariables = {
  groupName: ..., 
  groupImageUrl: ..., // optional
  groupDescription: ..., // optional
  now: ..., 
};

// Call the `createGroupChat()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createGroupChat(createGroupChatVars);
// Variables can be defined inline as well.
const { data } = await createGroupChat({ groupName: ..., groupImageUrl: ..., groupDescription: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createGroupChat(dataConnect, createGroupChatVars);

console.log(data.chat_insert);

// Or, you can use the `Promise` API.
createGroupChat(createGroupChatVars).then((response) => {
  const data = response.data;
  console.log(data.chat_insert);
});
```

### Using `CreateGroupChat`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createGroupChatRef, CreateGroupChatVariables } from '@dataconnect/generated';

// The `CreateGroupChat` mutation requires an argument of type `CreateGroupChatVariables`:
const createGroupChatVars: CreateGroupChatVariables = {
  groupName: ..., 
  groupImageUrl: ..., // optional
  groupDescription: ..., // optional
  now: ..., 
};

// Call the `createGroupChatRef()` function to get a reference to the mutation.
const ref = createGroupChatRef(createGroupChatVars);
// Variables can be defined inline as well.
const ref = createGroupChatRef({ groupName: ..., groupImageUrl: ..., groupDescription: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createGroupChatRef(dataConnect, createGroupChatVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.chat_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.chat_insert);
});
```

## AddGroupParticipant
You can execute the `AddGroupParticipant` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addGroupParticipant(vars: AddGroupParticipantVariables): MutationPromise<AddGroupParticipantData, AddGroupParticipantVariables>;

interface AddGroupParticipantRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddGroupParticipantVariables): MutationRef<AddGroupParticipantData, AddGroupParticipantVariables>;
}
export const addGroupParticipantRef: AddGroupParticipantRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addGroupParticipant(dc: DataConnect, vars: AddGroupParticipantVariables): MutationPromise<AddGroupParticipantData, AddGroupParticipantVariables>;

interface AddGroupParticipantRef {
  ...
  (dc: DataConnect, vars: AddGroupParticipantVariables): MutationRef<AddGroupParticipantData, AddGroupParticipantVariables>;
}
export const addGroupParticipantRef: AddGroupParticipantRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addGroupParticipantRef:
```typescript
const name = addGroupParticipantRef.operationName;
console.log(name);
```

### Variables
The `AddGroupParticipant` mutation requires an argument of type `AddGroupParticipantVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddGroupParticipantVariables {
  chatId: UUIDString;
  userId: UUIDString;
  isAdmin: boolean;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `AddGroupParticipant` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddGroupParticipantData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddGroupParticipantData {
  chatParticipant_insert: ChatParticipant_Key;
}
```
### Using `AddGroupParticipant`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addGroupParticipant, AddGroupParticipantVariables } from '@dataconnect/generated';

// The `AddGroupParticipant` mutation requires an argument of type `AddGroupParticipantVariables`:
const addGroupParticipantVars: AddGroupParticipantVariables = {
  chatId: ..., 
  userId: ..., 
  isAdmin: ..., 
  now: ..., 
};

// Call the `addGroupParticipant()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addGroupParticipant(addGroupParticipantVars);
// Variables can be defined inline as well.
const { data } = await addGroupParticipant({ chatId: ..., userId: ..., isAdmin: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addGroupParticipant(dataConnect, addGroupParticipantVars);

console.log(data.chatParticipant_insert);

// Or, you can use the `Promise` API.
addGroupParticipant(addGroupParticipantVars).then((response) => {
  const data = response.data;
  console.log(data.chatParticipant_insert);
});
```

### Using `AddGroupParticipant`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addGroupParticipantRef, AddGroupParticipantVariables } from '@dataconnect/generated';

// The `AddGroupParticipant` mutation requires an argument of type `AddGroupParticipantVariables`:
const addGroupParticipantVars: AddGroupParticipantVariables = {
  chatId: ..., 
  userId: ..., 
  isAdmin: ..., 
  now: ..., 
};

// Call the `addGroupParticipantRef()` function to get a reference to the mutation.
const ref = addGroupParticipantRef(addGroupParticipantVars);
// Variables can be defined inline as well.
const ref = addGroupParticipantRef({ chatId: ..., userId: ..., isAdmin: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addGroupParticipantRef(dataConnect, addGroupParticipantVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.chatParticipant_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.chatParticipant_insert);
});
```

## UpdateGroupParticipant
You can execute the `UpdateGroupParticipant` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateGroupParticipant(vars: UpdateGroupParticipantVariables): MutationPromise<UpdateGroupParticipantData, UpdateGroupParticipantVariables>;

interface UpdateGroupParticipantRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGroupParticipantVariables): MutationRef<UpdateGroupParticipantData, UpdateGroupParticipantVariables>;
}
export const updateGroupParticipantRef: UpdateGroupParticipantRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateGroupParticipant(dc: DataConnect, vars: UpdateGroupParticipantVariables): MutationPromise<UpdateGroupParticipantData, UpdateGroupParticipantVariables>;

interface UpdateGroupParticipantRef {
  ...
  (dc: DataConnect, vars: UpdateGroupParticipantVariables): MutationRef<UpdateGroupParticipantData, UpdateGroupParticipantVariables>;
}
export const updateGroupParticipantRef: UpdateGroupParticipantRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateGroupParticipantRef:
```typescript
const name = updateGroupParticipantRef.operationName;
console.log(name);
```

### Variables
The `UpdateGroupParticipant` mutation requires an argument of type `UpdateGroupParticipantVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateGroupParticipantVariables {
  chatId: UUIDString;
  userId: UUIDString;
  isAdmin?: boolean | null;
  status?: string | null;
}
```
### Return Type
Recall that executing the `UpdateGroupParticipant` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateGroupParticipantData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateGroupParticipantData {
  chatParticipant_update?: ChatParticipant_Key | null;
}
```
### Using `UpdateGroupParticipant`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateGroupParticipant, UpdateGroupParticipantVariables } from '@dataconnect/generated';

// The `UpdateGroupParticipant` mutation requires an argument of type `UpdateGroupParticipantVariables`:
const updateGroupParticipantVars: UpdateGroupParticipantVariables = {
  chatId: ..., 
  userId: ..., 
  isAdmin: ..., // optional
  status: ..., // optional
};

// Call the `updateGroupParticipant()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateGroupParticipant(updateGroupParticipantVars);
// Variables can be defined inline as well.
const { data } = await updateGroupParticipant({ chatId: ..., userId: ..., isAdmin: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateGroupParticipant(dataConnect, updateGroupParticipantVars);

console.log(data.chatParticipant_update);

// Or, you can use the `Promise` API.
updateGroupParticipant(updateGroupParticipantVars).then((response) => {
  const data = response.data;
  console.log(data.chatParticipant_update);
});
```

### Using `UpdateGroupParticipant`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateGroupParticipantRef, UpdateGroupParticipantVariables } from '@dataconnect/generated';

// The `UpdateGroupParticipant` mutation requires an argument of type `UpdateGroupParticipantVariables`:
const updateGroupParticipantVars: UpdateGroupParticipantVariables = {
  chatId: ..., 
  userId: ..., 
  isAdmin: ..., // optional
  status: ..., // optional
};

// Call the `updateGroupParticipantRef()` function to get a reference to the mutation.
const ref = updateGroupParticipantRef(updateGroupParticipantVars);
// Variables can be defined inline as well.
const ref = updateGroupParticipantRef({ chatId: ..., userId: ..., isAdmin: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateGroupParticipantRef(dataConnect, updateGroupParticipantVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.chatParticipant_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.chatParticipant_update);
});
```

## RemoveGroupParticipant
You can execute the `RemoveGroupParticipant` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
removeGroupParticipant(vars: RemoveGroupParticipantVariables): MutationPromise<RemoveGroupParticipantData, RemoveGroupParticipantVariables>;

interface RemoveGroupParticipantRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveGroupParticipantVariables): MutationRef<RemoveGroupParticipantData, RemoveGroupParticipantVariables>;
}
export const removeGroupParticipantRef: RemoveGroupParticipantRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
removeGroupParticipant(dc: DataConnect, vars: RemoveGroupParticipantVariables): MutationPromise<RemoveGroupParticipantData, RemoveGroupParticipantVariables>;

interface RemoveGroupParticipantRef {
  ...
  (dc: DataConnect, vars: RemoveGroupParticipantVariables): MutationRef<RemoveGroupParticipantData, RemoveGroupParticipantVariables>;
}
export const removeGroupParticipantRef: RemoveGroupParticipantRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the removeGroupParticipantRef:
```typescript
const name = removeGroupParticipantRef.operationName;
console.log(name);
```

### Variables
The `RemoveGroupParticipant` mutation requires an argument of type `RemoveGroupParticipantVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RemoveGroupParticipantVariables {
  chatId: UUIDString;
  userId: UUIDString;
}
```
### Return Type
Recall that executing the `RemoveGroupParticipant` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RemoveGroupParticipantData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RemoveGroupParticipantData {
  chatParticipant_delete?: ChatParticipant_Key | null;
}
```
### Using `RemoveGroupParticipant`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, removeGroupParticipant, RemoveGroupParticipantVariables } from '@dataconnect/generated';

// The `RemoveGroupParticipant` mutation requires an argument of type `RemoveGroupParticipantVariables`:
const removeGroupParticipantVars: RemoveGroupParticipantVariables = {
  chatId: ..., 
  userId: ..., 
};

// Call the `removeGroupParticipant()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await removeGroupParticipant(removeGroupParticipantVars);
// Variables can be defined inline as well.
const { data } = await removeGroupParticipant({ chatId: ..., userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await removeGroupParticipant(dataConnect, removeGroupParticipantVars);

console.log(data.chatParticipant_delete);

// Or, you can use the `Promise` API.
removeGroupParticipant(removeGroupParticipantVars).then((response) => {
  const data = response.data;
  console.log(data.chatParticipant_delete);
});
```

### Using `RemoveGroupParticipant`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, removeGroupParticipantRef, RemoveGroupParticipantVariables } from '@dataconnect/generated';

// The `RemoveGroupParticipant` mutation requires an argument of type `RemoveGroupParticipantVariables`:
const removeGroupParticipantVars: RemoveGroupParticipantVariables = {
  chatId: ..., 
  userId: ..., 
};

// Call the `removeGroupParticipantRef()` function to get a reference to the mutation.
const ref = removeGroupParticipantRef(removeGroupParticipantVars);
// Variables can be defined inline as well.
const ref = removeGroupParticipantRef({ chatId: ..., userId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = removeGroupParticipantRef(dataConnect, removeGroupParticipantVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.chatParticipant_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.chatParticipant_delete);
});
```

## UpdateGroupMetadata
You can execute the `UpdateGroupMetadata` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateGroupMetadata(vars: UpdateGroupMetadataVariables): MutationPromise<UpdateGroupMetadataData, UpdateGroupMetadataVariables>;

interface UpdateGroupMetadataRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGroupMetadataVariables): MutationRef<UpdateGroupMetadataData, UpdateGroupMetadataVariables>;
}
export const updateGroupMetadataRef: UpdateGroupMetadataRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateGroupMetadata(dc: DataConnect, vars: UpdateGroupMetadataVariables): MutationPromise<UpdateGroupMetadataData, UpdateGroupMetadataVariables>;

interface UpdateGroupMetadataRef {
  ...
  (dc: DataConnect, vars: UpdateGroupMetadataVariables): MutationRef<UpdateGroupMetadataData, UpdateGroupMetadataVariables>;
}
export const updateGroupMetadataRef: UpdateGroupMetadataRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateGroupMetadataRef:
```typescript
const name = updateGroupMetadataRef.operationName;
console.log(name);
```

### Variables
The `UpdateGroupMetadata` mutation requires an argument of type `UpdateGroupMetadataVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateGroupMetadataVariables {
  chatId: UUIDString;
  groupName?: string | null;
  groupImageUrl?: string | null;
  groupDescription?: string | null;
}
```
### Return Type
Recall that executing the `UpdateGroupMetadata` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateGroupMetadataData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateGroupMetadataData {
  chat_update?: Chat_Key | null;
}
```
### Using `UpdateGroupMetadata`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateGroupMetadata, UpdateGroupMetadataVariables } from '@dataconnect/generated';

// The `UpdateGroupMetadata` mutation requires an argument of type `UpdateGroupMetadataVariables`:
const updateGroupMetadataVars: UpdateGroupMetadataVariables = {
  chatId: ..., 
  groupName: ..., // optional
  groupImageUrl: ..., // optional
  groupDescription: ..., // optional
};

// Call the `updateGroupMetadata()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateGroupMetadata(updateGroupMetadataVars);
// Variables can be defined inline as well.
const { data } = await updateGroupMetadata({ chatId: ..., groupName: ..., groupImageUrl: ..., groupDescription: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateGroupMetadata(dataConnect, updateGroupMetadataVars);

console.log(data.chat_update);

// Or, you can use the `Promise` API.
updateGroupMetadata(updateGroupMetadataVars).then((response) => {
  const data = response.data;
  console.log(data.chat_update);
});
```

### Using `UpdateGroupMetadata`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateGroupMetadataRef, UpdateGroupMetadataVariables } from '@dataconnect/generated';

// The `UpdateGroupMetadata` mutation requires an argument of type `UpdateGroupMetadataVariables`:
const updateGroupMetadataVars: UpdateGroupMetadataVariables = {
  chatId: ..., 
  groupName: ..., // optional
  groupImageUrl: ..., // optional
  groupDescription: ..., // optional
};

// Call the `updateGroupMetadataRef()` function to get a reference to the mutation.
const ref = updateGroupMetadataRef(updateGroupMetadataVars);
// Variables can be defined inline as well.
const ref = updateGroupMetadataRef({ chatId: ..., groupName: ..., groupImageUrl: ..., groupDescription: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateGroupMetadataRef(dataConnect, updateGroupMetadataVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.chat_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.chat_update);
});
```

## UpdateLastSeen
You can execute the `UpdateLastSeen` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateLastSeen(vars: UpdateLastSeenVariables): MutationPromise<UpdateLastSeenData, UpdateLastSeenVariables>;

interface UpdateLastSeenRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateLastSeenVariables): MutationRef<UpdateLastSeenData, UpdateLastSeenVariables>;
}
export const updateLastSeenRef: UpdateLastSeenRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateLastSeen(dc: DataConnect, vars: UpdateLastSeenVariables): MutationPromise<UpdateLastSeenData, UpdateLastSeenVariables>;

interface UpdateLastSeenRef {
  ...
  (dc: DataConnect, vars: UpdateLastSeenVariables): MutationRef<UpdateLastSeenData, UpdateLastSeenVariables>;
}
export const updateLastSeenRef: UpdateLastSeenRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateLastSeenRef:
```typescript
const name = updateLastSeenRef.operationName;
console.log(name);
```

### Variables
The `UpdateLastSeen` mutation requires an argument of type `UpdateLastSeenVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateLastSeenVariables {
  userId: UUIDString;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `UpdateLastSeen` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateLastSeenData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateLastSeenData {
  user_update?: User_Key | null;
}
```
### Using `UpdateLastSeen`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateLastSeen, UpdateLastSeenVariables } from '@dataconnect/generated';

// The `UpdateLastSeen` mutation requires an argument of type `UpdateLastSeenVariables`:
const updateLastSeenVars: UpdateLastSeenVariables = {
  userId: ..., 
  now: ..., 
};

// Call the `updateLastSeen()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateLastSeen(updateLastSeenVars);
// Variables can be defined inline as well.
const { data } = await updateLastSeen({ userId: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateLastSeen(dataConnect, updateLastSeenVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateLastSeen(updateLastSeenVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateLastSeen`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateLastSeenRef, UpdateLastSeenVariables } from '@dataconnect/generated';

// The `UpdateLastSeen` mutation requires an argument of type `UpdateLastSeenVariables`:
const updateLastSeenVars: UpdateLastSeenVariables = {
  userId: ..., 
  now: ..., 
};

// Call the `updateLastSeenRef()` function to get a reference to the mutation.
const ref = updateLastSeenRef(updateLastSeenVars);
// Variables can be defined inline as well.
const ref = updateLastSeenRef({ userId: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateLastSeenRef(dataConnect, updateLastSeenVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

