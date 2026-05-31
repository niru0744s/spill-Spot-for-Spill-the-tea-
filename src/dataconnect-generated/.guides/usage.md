# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createUser, sendMessage, createChat, addChatParticipants, updateLastSeen, getMyChats, findExistingChat, getChatMessages, getUserProfile, searchUsersByUsername } from '@dataconnect/generated';


// Operation CreateUser:  For variables, look at type CreateUserVars in ../index.d.ts
const { data } = await CreateUser(dataConnect, createUserVars);

// Operation SendMessage:  For variables, look at type SendMessageVars in ../index.d.ts
const { data } = await SendMessage(dataConnect, sendMessageVars);

// Operation CreateChat:  For variables, look at type CreateChatVars in ../index.d.ts
const { data } = await CreateChat(dataConnect, createChatVars);

// Operation AddChatParticipants:  For variables, look at type AddChatParticipantsVars in ../index.d.ts
const { data } = await AddChatParticipants(dataConnect, addChatParticipantsVars);

// Operation UpdateLastSeen:  For variables, look at type UpdateLastSeenVars in ../index.d.ts
const { data } = await UpdateLastSeen(dataConnect, updateLastSeenVars);

// Operation GetMyChats: 
const { data } = await GetMyChats(dataConnect);

// Operation FindExistingChat:  For variables, look at type FindExistingChatVars in ../index.d.ts
const { data } = await FindExistingChat(dataConnect, findExistingChatVars);

// Operation GetChatMessages:  For variables, look at type GetChatMessagesVars in ../index.d.ts
const { data } = await GetChatMessages(dataConnect, getChatMessagesVars);

// Operation GetUserProfile:  For variables, look at type GetUserProfileVars in ../index.d.ts
const { data } = await GetUserProfile(dataConnect, getUserProfileVars);

// Operation SearchUsersByUsername:  For variables, look at type SearchUsersByUsernameVars in ../index.d.ts
const { data } = await SearchUsersByUsername(dataConnect, searchUsersByUsernameVars);


```