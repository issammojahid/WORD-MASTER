# Friends, chat, and room invitations

The social API authenticates requests and sockets with the opaque token issued by
`POST /api/online/guest-session`. The server-side guest session ID is the stable
Player ID used for friends and messaging. This is device-scoped guest identity;
the application does not currently provide account sign-in or cross-device
account recovery.

## Database

Review and apply `server/migrations/003_social_features.sql` manually after the
online guest-session schema is present. It only creates social tables and
indexes; it does not delete or rewrite existing rows. It stores guest profiles,
friend requests, friendships, blocks, conversations, messages/read state, room
invitations, and in-app notifications.

Do not run `server/migrations/002_optional_remove_friends.sql` as part of this
feature. That older optional migration drops the legacy `friends` and
`friend_requests` tables and could delete existing relationship records.

## API and real-time events

Persistent operations are under `/api/social`: profiles/privacy, player search,
friend requests, friends, blocks, conversations/messages, notifications, and
pending room invitations. The server verifies each bearer token against the
guest-session table.

Socket events use the authenticated player's `social:<playerId>` room.
`social:message`, `social:typing`, `social:typing-stop`, `social:read`,
`social:game_invite`, and `social:game_invite:respond` are authorized on the
server. Presence is derived from connected sockets and active matches, not
client-supplied status. Private-room invitations expire after 60 seconds and
joining still uses the existing room-code flow.

Private message text is limited to 1,000 characters and rendered as plain text.
Notifications are stored in-app and delivered in real time while connected;
this feature does not implement offline push notifications or end-to-end
encryption.
