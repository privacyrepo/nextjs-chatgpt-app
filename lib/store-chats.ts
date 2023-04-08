import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { v4 as uuidv4 } from 'uuid';

import { LocaleId, defaultLocaleId, ChatModelId, defaultChatModelId, defaultSystemPurposeId, SystemPurposeId } from '@/lib/data';
import { updateTokenCount } from '@/lib/tokens';


/// Conversations Store

export interface ChatStore {
  conversations: DConversation[];
  activeConversationId: string | null;

  // store setters
  addConversation: (conversation: DConversation) => void;
  deleteConversation: (conversationId: string) => void;
  setActiveConversationId: (conversationId: string) => void;

  // within a conversation
  setMessages: (conversationId: string, messages: DMessage[]) => void;
  appendMessage: (conversationId: string, message: DMessage) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, touch: boolean) => void;
  setChatModelId: (conversationId: string, chatModelId: ChatModelId) => void;
  setLocaleId:(conversationId: string, localeId: LocaleId) => void;
  setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) => void;

  // utility function
  _editConversation: (conversationId: string, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) => void;
}

/**
 * Message, sent or received, by humans or bots
 *
 * Other ideas:
 * - attachments?: {type: string; url: string; thumbnailUrl?: string; size?: number}[];
 * - isPinned?: boolean;
 * - reactions?: {type: string; count: number; users: string[]}[];
 * - status: 'sent' | 'delivered' | 'read' | 'failed';
 */
export interface DMessage {
  id: string;
  text: string;
  sender: 'You' | 'Bot' | string;   // pretty name
  avatar: string | null;            // null, or image url
  typing: boolean;
  role: 'assistant' | 'system' | 'user';

  purposeId?: SystemPurposeId;      // only assistant/system
  originLLM?: string;               // only assistant - model that generated this message, goes beyond known models

  tokenCount: number;               // cache for token count, using the current Conversation model (0 = not yet calculated)

  created: number;                  // created timestamp
  updated: number | null;           // updated timestamp
}

export const createDMessage = (role: DMessage['role'], text: string): DMessage =>
  ({
    id: uuidv4(),
    text,
    sender: role === 'user' ? 'You' : 'Bot',
    avatar: null,
    typing: false,
    role: role,
    tokenCount: 0,
    created: Date.now(),
    updated: null,
  });


/**
 * Conversation, a list of messages between humans and bots
 * Future:
 * - draftUserMessage?: { text: string; attachments: any[] };
 * - isMuted: boolean; isArchived: boolean; isStarred: boolean; participants: string[];
 */
export interface DConversation {
  id: string;
  name: string;
  messages: DMessage[];
  systemPurposeId: SystemPurposeId;
  chatModelId: ChatModelId;
  localeId: LocaleId;
  userTitle?: string;
  autoTitle?: string;
  tokenCount: number;        // f(messages, chatModelId)
  created: number;            // created timestamp
  updated: number | null;     // updated timestamp
}

const createConversation = (id: string, name: string, systemPurposeId: SystemPurposeId, chatModelId: ChatModelId, localeId: LocaleId): DConversation =>
  ({ id, name, messages: [], systemPurposeId, chatModelId,localeId, tokenCount: 0, localeId,created: Date.now(), updated: Date.now() });

const defaultConversations: DConversation[] = [createConversation(uuidv4(), 'Conversation', defaultSystemPurposeId, defaultChatModelId, defaultLocaleId)];

const errorConversation: DConversation = createConversation('error-missing', 'Missing Conversation', defaultSystemPurposeId, defaultChatModelId, defaultLocaleId);


export const useChatStore = create<ChatStore>()(devtools(
  persist(
    (set, get) => ({
      // default state
      conversations: defaultConversations,
      activeConversationId: defaultConversations[0].id,


      addConversation: (conversation: DConversation) =>
        set(state => (
          {
            conversations: [
              conversation,
              ...state.conversations.slice(0, 19),
            ],
          }
        )),

      deleteConversation: (conversationId: string) =>
        set(state => (
          {
            conversations: state.conversations.filter((conversation: DConversation): boolean => conversation.id !== conversationId),
          }
        )),

      setActiveConversationId: (conversationId: string) =>
        set({ activeConversationId: conversationId }),


      // within a conversation

      setMessages: (conversationId: string, newMessages: DMessage[]) =>
        get()._editConversation(conversationId, conversation => {
          return ({
            messages: newMessages,
            tokenCount: newMessages.reduce((sum, message) => sum + updateTokenCount(message, conversation.chatModelId, false, 'setMessages'), 0),
            updated: Date.now(),
          });
        }),

      appendMessage: (conversationId: string, message: DMessage) =>
        get()._editConversation(conversationId, conversation => {

          if (!message.typing)
            updateTokenCount(message, conversation.chatModelId, true, 'appendMessage');

          const messages = [...conversation.messages, message];

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + message.tokenCount || 0, 0),
            updated: Date.now(),
          };
        }),

      deleteMessage: (conversationId: string, messageId: string) =>
        get()._editConversation(conversationId, conversation => {

          const messages = conversation.messages.filter(message => message.id !== messageId);

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + message.tokenCount || 0, 0),
            updated: Date.now(),
          };
        }),

      editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, setUpdated: boolean) =>
        get()._editConversation(conversationId, conversation => {

          const messages = conversation.messages.map((message: DMessage): DMessage =>
            message.id === messageId
              ? {
                ...message,
                ...updatedMessage,
                ...(setUpdated && { updated: Date.now() }),
                ...(((updatedMessage.typing === false || !message.typing) && { tokenCount: updateTokenCount(message, conversation.chatModelId, true, 'editMessage(typing=false)') })),
              }
              : message);

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + message.tokenCount || 0, 0),
            ...(setUpdated && { updated: Date.now() }),
          };
        }),

        setLocaleId: (conversationId: string, localeId: LocaleId) =>
        get()._editConversation(conversationId,
          {
            localeId,
          }),

      setChatModelId: (conversationId: string, chatModelId: ChatModelId) =>
        get()._editConversation(conversationId, conversation => {
          return {
            chatModelId,
            tokenCount: conversation.messages.reduce((sum, message) => sum + updateTokenCount(message, chatModelId, true, 'setChatModelId'), 0),
          };
        }),

      setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) =>
        get()._editConversation(conversationId,
          {
            systemPurposeId,
          }),


      _editConversation: (conversationId: string, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) =>
        set(state => ({
          conversations: state.conversations.map((conversation: DConversation): DConversation =>
            conversation.id === conversationId
              ? {
                ...conversation,
                ...(typeof update === 'function' ? update(conversation) : update),
              }
              : conversation),
        })),

    }),
    {
      name: 'app-chats',
    }),
  {
    name: 'AppChats',
    enabled: false,
  }),
);


// WARNING: this will re-render at high frequency (e.g. token received in any message therein)
//          only use this for UI that renders messages
export function useActiveConversation(): DConversation {
  const activeConversationId = useChatStore(state => state.activeConversationId);
  return useChatStore(state => state.conversations.find(conversation => conversation.id === activeConversationId) || errorConversation);
}

export function useActiveConfiguration() {
  const { conversationId, localeId, setLocaleId, chatModelId, setChatModelId, systemPurposeId, setSystemPurposeId, tokenCount } = useChatStore(state => {
    const _activeConversationId = state.activeConversationId;
    const conversation = state.conversations.find(conversation => conversation.id === _activeConversationId) || errorConversation;
    return {
      conversationId: conversation.id,
      localeId: conversation.localeId,
      setLocaleId: state.setLocaleId,
      chatModelId: conversation.chatModelId,
      setChatModelId: state.setChatModelId,
      systemPurposeId: conversation.systemPurposeId,
      setSystemPurposeId: state.setSystemPurposeId,
      tokenCount: conversation.tokenCount,
    };
  }, shallow);

  return {
    conversationId,
    localeId,
    setLocaleId:(localeId: LocaleId) => setLocaleId(conversationId, localeId),
    chatModelId,
    setChatModelId: (chatModelId: ChatModelId) => setChatModelId(conversationId, chatModelId),
    systemPurposeId,
    setSystemPurposeId: (systemPurposeId: SystemPurposeId) => setSystemPurposeId(conversationId, systemPurposeId),
    tokenCount,
  };
}

export const useConversationNames = (): { id: string, name: string, systemPurposeId: SystemPurposeId }[] =>
  useChatStore(
    state => state.conversations.map((conversation) => ({ id: conversation.id, name: conversation.name, systemPurposeId: conversation.systemPurposeId })),
    shallow,
  );


/**
 * Download a conversation as a JSON file, for backup and future restore
 * Not the best place to have this function, but we want it close to the (re)store function
 */
export const downloadConversationJson = (conversation: DConversation) => {
  if (typeof window === 'undefined') return;

  // payload to be downloaded
  const json = JSON.stringify(conversation, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `conversation-${conversation.id}.json`;

  // link to begin the download
  const tempUrl = URL.createObjectURL(blob);
  const tempLink = document.createElement('a');
  tempLink.href = tempUrl;
  tempLink.download = filename;
  tempLink.style.display = 'none';
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
  URL.revokeObjectURL(tempUrl);
};