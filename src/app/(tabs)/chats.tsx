import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useChat } from '@/hooks/useChat';
import { LinearGradient } from 'expo-linear-gradient';

export default function ChatsScreen() {
  const router = useRouter();
  const { chats, fetchMyChats, isLoading, error } = useChat();

  useEffect(() => {
    fetchMyChats();
  }, [fetchMyChats]);

  const renderChatItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.chatCard}
      onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.chat.id } })}
      activeOpacity={0.7}
    >
      <View style={styles.avatarPlaceholder} />
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{item.chat.isGroup ? "Group Chat" : "Direct Message"}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.chat.lastMessageText || "No messages yet"}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#0F2027', '#203A43', '#2C5364']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchMyChats}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading && !chats ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : chats?.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No messages yet.</Text>
          <Text style={styles.emptySubtext}>Find someone to chat with!</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.chat.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 16,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#8aa6b5',
  },
  unreadBadge: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#8aa6b5',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  retryText: {
    color: '#38bdf8',
    fontWeight: '600',
  },
});
