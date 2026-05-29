import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useChat } from '@/hooks/useChat';
import { LinearGradient } from 'expo-linear-gradient';

export default function ChatRoomScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const { messages, fetchChatMessages, sendMessage, clearMessages, isLoading, error } = useChat();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (chatId) {
      fetchChatMessages(chatId);
    }
    return () => {
      clearMessages();
    };
  }, [chatId, fetchChatMessages, clearMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || !chatId) return;
    
    // For 1:1 chats, we can resolve the receiver ID or pass a placeholder for now
    const dummyReceiverId = "00000000-0000-0000-0000-000000000000";
    
    const success = await sendMessage(chatId, dummyReceiverId, inputText.trim());
    if (success) {
      setInputText('');
      fetchChatMessages(chatId); // Refresh messages list
    }
  };

  const renderMessageItem = ({ item }: { item: any }) => (
    <View style={[
      styles.messageBubble,
      item.sender.id === chatId ? styles.receiverBubble : styles.senderBubble
    ]}>
      <Text style={styles.messageText}>{item.content}</Text>
    </View>
  );

  return (
    <LinearGradient colors={['#0F2027', '#203A43', '#2C5364']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading && !messages ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messageList}
          inverted
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#8aa6b5"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 20,
    marginBottom: 10,
    maxWidth: '75%',
  },
  senderBubble: {
    backgroundColor: '#38bdf8',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  receiverBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputArea: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#1a2c35',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 12,
  },
  sendBtn: {
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  sendText: {
    color: '#fff',
    fontWeight: '700',
  },
});
