import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useWallet, WalletTransaction } from '@/hooks/useWallet';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { auth, db } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export default function WalletScreen() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const styles = useStyles(getStyles);
  const {
    balance,
    formattedBalance,
    isLoading,
    transactions,
    depositFunds,
    sendMoney,
    requestMoney,
    refreshBalance
  } = useWallet();

  const currentUid = auth.currentUser?.uid ?? '';

  // Modals visibility
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);

  // Form states
  const [depositAmount, setDepositAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNote, setRequestNote] = useState('');

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Search users for Send/Request Money
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const usersRef = collection(db, 'users');
        // Simple prefix match query (e.g. username >= query and username < query + '\uf8ff')
        const qStr = searchQuery.toLowerCase().trim();
        const q = query(
          usersRef,
          where('username', '>=', qStr),
          where('username', '<=', qStr + '\uf8ff'),
          limit(10)
        );

        const snap = await getDocs(q);
        const list: any[] = [];
        snap.forEach((docSnap) => {
          const u = docSnap.data();
          // Skip searching self
          if (docSnap.id !== currentUid) {
            list.push({ uid: docSnap.id, ...u });
          }
        });
        setSearchResults(list);
      } catch (err) {
        console.warn('[Wallet Screen] User search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, currentUid]);

  // Handle Deposit
  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid deposit amount.');
      return;
    }
    setDepositModalVisible(false);
    setDepositAmount('');
    const success = await depositFunds(amt);
    if (success) {
      Alert.alert('Success 🎉', `Deposited ₹${amt.toFixed(2)} to your wallet!`);
    } else {
      Alert.alert('Failed ❌', 'Deposit was canceled or failed.');
    }
  };

  // Handle Send Money
  const handleSend = async () => {
    const amt = parseFloat(transferAmount);
    if (!selectedUser) {
      Alert.alert('Selection Required', 'Please select a recipient first.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (amt > balance / 100) {
      Alert.alert('Insufficient Balance', 'You do not have enough funds to complete this transfer.');
      return;
    }

    setTransferModalVisible(false);
    const result = await sendMoney(selectedUser.uid, amt);
    
    // Reset fields
    setTransferAmount('');
    setTransferNote('');
    setSelectedUser(null);
    setSearchQuery('');

    Alert.alert(result.success ? 'Success 🎉' : 'Failed ❌', result.message);
  };

  // Handle Request Money
  const handleRequest = async () => {
    const amt = parseFloat(requestAmount);
    if (!selectedUser) {
      Alert.alert('Selection Required', 'Please select a user first.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setRequestModalVisible(false);
    const result = await requestMoney(selectedUser.uid, amt, requestNote);
    
    // Reset fields
    setRequestAmount('');
    setRequestNote('');
    setSelectedUser(null);
    setSearchQuery('');

    Alert.alert(result.success ? 'Success 🎉' : 'Failed ❌', result.message);
  };

  // Render transaction item
  const renderTxItem = ({ item }: { item: WalletTransaction }) => {
    const isCredit = item.amount > 0;
    const formattedAmt = `${isCredit ? '+' : ''}₹${(item.amount / 100).toFixed(2)}`;
    
    let description = '';
    let iconName = '';

    if (item.type === 'ADD_FUNDS') {
      description = 'Deposited Funds';
      iconName = 'account-balance-wallet';
    } else if (item.type === 'SEND_FUNDS') {
      description = `Paid to ${item.counterpartyName || 'Friend'}`;
      iconName = 'payment';
    } else if (item.type === 'RECEIVE_FUNDS') {
      description = `Received from ${item.counterpartyName || 'Friend'}`;
      iconName = 'call-received';
    } else {
      description = 'Transaction';
      iconName = 'attach-money';
    }

    const dateStr = new Date(item.createdAt).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return (
      <View style={styles.txRow}>
        <View style={[styles.txIconBg, isCredit ? styles.txIconBgCredit : styles.txIconBgDebit]}>
          <MaterialIcons name={iconName as any} size={22} color={isCredit ? C.primaryFixedDim : C.secondaryFixed} />
        </View>
        <View style={styles.txMeta}>
          <Text style={styles.txDesc}>{description}</Text>
          <Text style={styles.txDate}>{dateStr}</Text>
        </View>
        <Text style={[styles.txAmount, isCredit ? styles.txAmountCredit : styles.txAmountDebit]}>
          {formattedAmt}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={C.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <MaterialIcons name="arrow-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wallet</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={refreshBalance} activeOpacity={0.75}>
          {isLoading ? (
            <ActivityIndicator size="small" color={C.onSurface} />
          ) : (
            <MaterialIcons name="refresh" size={24} color={C.onSurface} />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Balance Card ── */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
        <Text style={styles.balanceAmount}>{formattedBalance}</Text>
        <View style={styles.cardGlow} />
      </View>

      {/* ── Quick Actions ── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={() => setDepositModalVisible(true)}
        >
          <View style={styles.actionIconBg}>
            <MaterialIcons name="add" size={24} color={C.primaryFixedDim} />
          </View>
          <Text style={styles.actionLabel}>Add</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={() => setTransferModalVisible(true)}
        >
          <View style={styles.actionIconBg}>
            <MaterialIcons name="send" size={24} color={C.primaryFixedDim} />
          </View>
          <Text style={styles.actionLabel}>Pay</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={() => setRequestModalVisible(true)}
        >
          <View style={styles.actionIconBg}>
            <MaterialIcons name="payment" size={24} color={C.primaryFixedDim} />
          </View>
          <Text style={styles.actionLabel}>Request</Text>
        </TouchableOpacity>
      </View>

      {/* ── Transactions History ── */}
      <Text style={styles.sectionTitle}>TRANSACTIONS</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTxItem}
        contentContainerStyle={styles.txList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt" size={48} color="rgba(190,202,185,0.2)" />
            <Text style={styles.emptyStateText}>No transactions brewed yet ☕</Text>
          </View>
        }
      />

      {/* ── Modal: Add Money ── */}
      <Modal visible={depositModalVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDepositModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View 
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}
              {...(Platform.OS === 'web' ? { onClick: (e: any) => e.stopPropagation() } : {})}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Money</Text>
                <TouchableOpacity onPress={() => setDepositModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={C.onSurface} />
                </TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>AMOUNT (INR)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter amount (e.g. 500)"
                placeholderTextColor="rgba(190,202,185,0.4)"
                keyboardType="numeric"
                value={depositAmount}
                onChangeText={setDepositAmount}
                autoFocus
              />
              <TouchableOpacity style={styles.submitBtn} onPress={handleDeposit} activeOpacity={0.8}>
                <Text style={styles.submitBtnText}>PROCEED TO PAY</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: Pay Money ── */}
      <Modal visible={transferModalVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setTransferModalVisible(false);
            setSelectedUser(null);
            setSearchQuery('');
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View 
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}
              {...(Platform.OS === 'web' ? { onClick: (e: any) => e.stopPropagation() } : {})}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Pay Friend</Text>
                <TouchableOpacity onPress={() => setTransferModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={C.onSurface} />
                </TouchableOpacity>
              </View>

              {!selectedUser ? (
                <>
                  <Text style={styles.inputLabel}>SEARCH USERNAME</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Type username..."
                    placeholderTextColor="rgba(190,202,185,0.4)"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoFocus
                  />
                  {isSearching && <ActivityIndicator size="small" color={C.primaryFixedDim} style={{ marginTop: 8 }} />}
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.uid}
                    style={styles.searchList}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.searchItem}
                        onPress={() => setSelectedUser(item)}
                      >
                        <View style={styles.avatarMini}>
                          <Text style={styles.avatarMiniText}>{item.name?.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ marginLeft: 12 }}>
                          <Text style={styles.searchItemName}>{item.name}</Text>
                          <Text style={styles.searchItemUser}>@{item.username}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                </>
              ) : (
                <>
                  <View style={styles.recipientBadge}>
                    <Text style={styles.recipientBadgeText}>Paying {selectedUser.name} (@{selectedUser.username})</Text>
                    <TouchableOpacity onPress={() => setSelectedUser(null)}>
                      <Text style={styles.changeRecipientText}>Change</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.inputLabel}>AMOUNT (INR)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Amount to send"
                    placeholderTextColor="rgba(190,202,185,0.4)"
                    keyboardType="numeric"
                    value={transferAmount}
                    onChangeText={setTransferAmount}
                    autoFocus
                  />

                  <Text style={styles.inputLabel}>NOTE (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="What is this for?"
                    placeholderTextColor="rgba(190,202,185,0.4)"
                    value={transferNote}
                    onChangeText={setTransferNote}
                  />

                  <TouchableOpacity style={styles.submitBtn} onPress={handleSend} activeOpacity={0.8}>
                    <Text style={styles.submitBtnText}>SEND MONEY</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: Request Money ── */}
      <Modal visible={requestModalVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setRequestModalVisible(false);
            setSelectedUser(null);
            setSearchQuery('');
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View 
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}
              {...(Platform.OS === 'web' ? { onClick: (e: any) => e.stopPropagation() } : {})}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request Money</Text>
                <TouchableOpacity onPress={() => setRequestModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={C.onSurface} />
                </TouchableOpacity>
              </View>

              {!selectedUser ? (
                <>
                  <Text style={styles.inputLabel}>SEARCH USERNAME</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Type username..."
                    placeholderTextColor="rgba(190,202,185,0.4)"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoFocus
                  />
                  {isSearching && <ActivityIndicator size="small" color={C.primaryFixedDim} style={{ marginTop: 8 }} />}
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.uid}
                    style={styles.searchList}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.searchItem}
                        onPress={() => setSelectedUser(item)}
                      >
                        <View style={styles.avatarMini}>
                          <Text style={styles.avatarMiniText}>{item.name?.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ marginLeft: 12 }}>
                          <Text style={styles.searchItemName}>{item.name}</Text>
                          <Text style={styles.searchItemUser}>@{item.username}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                </>
              ) : (
                <>
                  <View style={styles.recipientBadge}>
                    <Text style={styles.recipientBadgeText}>Requesting from {selectedUser.name}</Text>
                    <TouchableOpacity onPress={() => setSelectedUser(null)}>
                      <Text style={styles.changeRecipientText}>Change</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.inputLabel}>AMOUNT (INR)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Amount to request"
                    placeholderTextColor="rgba(190,202,185,0.4)"
                    keyboardType="numeric"
                    value={requestAmount}
                    onChangeText={setRequestAmount}
                    autoFocus
                  />

                  <Text style={styles.inputLabel}>NOTE (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="For coffee, rent, etc."
                    placeholderTextColor="rgba(190,202,185,0.4)"
                    value={requestNote}
                    onChangeText={setRequestNote}
                  />

                  <TouchableOpacity style={styles.submitBtn} onPress={handleRequest} activeOpacity={0.8}>
                    <Text style={styles.submitBtnText}>REQUEST MONEY</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (C: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: C.outlineVariant,
    },
    backBtn: {
      padding: 4,
    },
    headerTitle: {
      fontFamily: 'Sora',
      fontSize: 20,
      fontWeight: '700',
      color: C.onSurface,
    },
    refreshBtn: {
      padding: 4,
    },
    balanceCard: {
      margin: 20,
      padding: 24,
      borderRadius: 24,
      backgroundColor: C.surfaceContainer,
      borderWidth: 1,
      borderColor: C.outlineVariant,
      overflow: 'hidden',
    },
    balanceLabel: {
      fontFamily: 'Space Grotesk',
      fontSize: 12,
      fontWeight: '700',
      color: C.onSurfaceVariant,
      letterSpacing: 1.5,
    },
    balanceAmount: {
      fontFamily: 'Sora',
      fontSize: 36,
      fontWeight: '800',
      color: C.primaryFixedDim,
      marginTop: 8,
    },
    cardGlow: {
      position: 'absolute',
      right: -30,
      bottom: -30,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: C.primaryFixedDim,
      opacity: 0.1,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: 10,
      marginBottom: 25,
    },
    actionBtn: {
      alignItems: 'center',
      width: 80,
    },
    actionIconBg: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: C.surfaceContainerHigh,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.outlineVariant,
    },
    actionLabel: {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 14,
      fontWeight: '600',
      color: C.onSurface,
      marginTop: 8,
    },
    sectionTitle: {
      fontFamily: 'Space Grotesk',
      fontSize: 12,
      fontWeight: '700',
      color: C.onSurfaceVariant,
      letterSpacing: 1.5,
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    txList: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.outlineVariant,
    },
    txIconBg: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    txIconBgCredit: {
      backgroundColor: 'rgba(122, 220, 125, 0.12)',
      borderColor: C.primaryFixedDim,
    },
    txIconBgDebit: {
      backgroundColor: 'rgba(255, 181, 156, 0.12)',
      borderColor: C.secondaryFixed,
    },
    txMeta: {
      flex: 1,
      marginLeft: 14,
    },
    txDesc: {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 15,
      fontWeight: '600',
      color: C.onSurface,
    },
    txDate: {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 12,
      color: C.onSurfaceVariant,
      marginTop: 2,
    },
    txAmount: {
      fontFamily: 'Space Grotesk',
      fontSize: 16,
      fontWeight: '700',
    },
    txAmountCredit: {
      color: C.primaryFixedDim,
    },
    txAmountDebit: {
      color: C.secondaryFixedDim,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 50,
    },
    emptyStateText: {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 14,
      color: C.onSurfaceVariant,
      marginTop: 12,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(10, 16, 9, 0.75)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      width: '100%',
    },
    modalContent: {
      backgroundColor: C.surfaceContainer,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      borderWidth: 1,
      borderColor: C.outlineVariant,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontFamily: 'Sora',
      fontSize: 20,
      fontWeight: '700',
      color: C.onSurface,
    },
    inputLabel: {
      fontFamily: 'Space Grotesk',
      fontSize: 11,
      fontWeight: '700',
      color: C.onSurfaceVariant,
      letterSpacing: 1.5,
      marginTop: 16,
      marginBottom: 8,
    },
    textInput: {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 15,
      backgroundColor: C.surfaceContainerHigh,
      color: C.onSurface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.outlineVariant,
    },
    submitBtn: {
      backgroundColor: C.primaryFixedDim,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 24,
    },
    submitBtnText: {
      fontFamily: 'Space Grotesk',
      fontSize: 14,
      fontWeight: '700',
      color: '#00390d',
      letterSpacing: 1,
    },
    searchList: {
      maxHeight: 200,
      marginTop: 8,
    },
    searchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.outlineVariant,
    },
    avatarMini: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.primaryFixedDim,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarMiniText: {
      fontFamily: 'Sora',
      fontSize: 14,
      fontWeight: '700',
      color: '#00390d',
    },
    searchItemName: {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 14,
      fontWeight: '600',
      color: C.onSurface,
    },
    searchItemUser: {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 12,
      color: C.onSurfaceVariant,
    },
    recipientBadge: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'rgba(122, 220, 125, 0.1)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(122, 220, 125, 0.3)',
      marginBottom: 8,
    },
    recipientBadgeText: {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 13,
      fontWeight: '600',
      color: C.primaryFixedDim,
    },
    changeRecipientText: {
      fontFamily: 'Space Grotesk',
      fontSize: 12,
      fontWeight: '700',
      color: C.secondaryFixedDim,
    },
  });
