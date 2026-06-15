/**
 * app/transactions.tsx
 * --------------------
 * Premium Transaction History screen matching the Stitch and Tea Brand guidelines.
 * Displays a complete log of deposits, transfers, and receipts.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useWallet, WalletTransaction } from '@/hooks/useWallet';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';
import { useFonts, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { PlusJakartaSans_500Medium, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';

const { width } = Dimensions.get('window');

type FilterType = 'ALL' | 'SENT' | 'RECEIVED' | 'DEPOSIT';

export default function TransactionsScreen() {
  const [fontsLoaded] = useFonts({
    Sora_700Bold,
    Sora_800ExtraBold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    SpaceGrotesk_700Bold,
  });

  const { colors: C } = useTheme();
  const styles = useStyles(getStyles, fontsLoaded);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { transactions, isLoading } = useWallet();

  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  // Filter logic
  const filteredTransactions = transactions.filter((tx) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'SENT') return tx.type === 'SEND_FUNDS';
    if (activeFilter === 'RECEIVED') return tx.type === 'RECEIVE_FUNDS';
    if (activeFilter === 'DEPOSIT') return tx.type === 'ADD_FUNDS';
    return true;
  });

  const formatAmount = (amountInPaise: number) => {
    return `₹${(amountInPaise / 100).toFixed(2)}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTxDetails = (tx: WalletTransaction) => {
    switch (tx.type) {
      case 'ADD_FUNDS':
        return {
          icon: 'add-circle-outline',
          iconColor: C.primaryFixed,
          iconBg: 'rgba(150,249,150,0.08)',
          title: 'Added Funds',
          subtitle: `Ref: ${tx.reference || 'N/A'}`,
          amountPrefix: '+',
          amountColor: C.primaryFixed,
        };
      case 'SEND_FUNDS':
        return {
          icon: 'arrow-upward',
          iconColor: C.secondary,
          iconBg: 'rgba(255,181,156,0.08)',
          title: `To: ${tx.counterpartyName || 'Tea Friend'}`,
          subtitle: `Ref: ${tx.reference || 'N/A'}`,
          amountPrefix: '-',
          amountColor: C.secondary,
        };
      case 'RECEIVE_FUNDS':
        return {
          icon: 'arrow-downward',
          iconColor: C.primaryFixed,
          iconBg: 'rgba(150,249,150,0.08)',
          title: `From: ${tx.counterpartyName || 'Tea Friend'}`,
          subtitle: `Ref: ${tx.reference || 'N/A'}`,
          amountPrefix: '+',
          amountColor: C.primaryFixed,
        };
      default:
        return {
          icon: 'swap-horiz',
          iconColor: C.onSurfaceVariant,
          iconBg: C.surfaceContainerHigh,
          title: 'Transaction',
          subtitle: `Ref: ${tx.reference || 'N/A'}`,
          amountPrefix: '',
          amountColor: C.onSurface,
        };
    }
  };

  const renderTxItem = ({ item }: { item: WalletTransaction }) => {
    const details = getTxDetails(item);
    const isFailed = item.status === 'FAILED';

    return (
      <View style={styles.txRow}>
        <View style={[styles.iconContainer, { backgroundColor: details.iconBg }]}>
          <MaterialIcons name={details.icon as any} size={20} color={isFailed ? C.errorColor : details.iconColor} />
        </View>

        <View style={styles.midContent}>
          <Text style={styles.txTitle} numberOfLines={1} ellipsizeMode="tail">
            {details.title}
          </Text>
          <Text style={styles.txDate}>{formatDate(item.createdAt)}</Text>
          <Text style={styles.txSubtitle} numberOfLines={1}>
            {details.subtitle}
          </Text>
        </View>

        <View style={styles.rightContent}>
          <Text style={[
            styles.txAmount,
            { color: isFailed ? C.onSurfaceVariant : details.amountColor },
            isFailed && styles.failedTextLineThrough
          ]}>
            {isFailed ? '' : details.amountPrefix} {formatAmount(item.amount)}
          </Text>
          {isFailed ? (
            <View style={styles.failedBadge}>
              <Text style={styles.failedBadgeText}>FAILED</Text>
            </View>
          ) : (
            <Text style={styles.successText}>SUCCESS</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['ALL', 'SENT', 'RECEIVED', 'DEPOSIT'] as const).map((filter) => {
          const active = activeFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primaryFixedDim} />
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="receipt-long" size={48} color={C.onSurfaceVariant} style={{ opacity: 0.4 }} />
          <Text style={styles.emptyText}>No transaction records spilled yet... 💸</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTxItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

/* Styles */
function getStyles(C: ThemeColors, isDark: boolean, fontsLoaded: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: C.background,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(137,148,133,0.1)',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: fontsLoaded ? 'Sora_800ExtraBold' : undefined,
      color: C.onSurface,
      letterSpacing: -0.5,
    },

    /* Filters */
    filterContainer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 8,
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
    },
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: C.surfaceContainerHigh,
      borderWidth: 1,
      borderColor: C.cardBorder,
    },
    filterPillActive: {
      backgroundColor: C.primaryFixed,
      borderColor: C.primaryFixed,
    },
    filterText: {
      fontSize: 11,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_700Bold' : undefined,
      color: C.onSurfaceVariant,
    },
    filterTextActive: {
      color: C.onPrimaryFixed,
    },

    /* List */
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurfaceVariant,
      textAlign: 'center',
      opacity: 0.7,
    },

    /* Row Item */
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(137,148,133,0.08)',
      gap: 14,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    midContent: {
      flex: 1,
      gap: 3,
    },
    txTitle: {
      fontSize: 15,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_700Bold' : undefined,
      color: C.onSurface,
    },
    txDate: {
      fontSize: 11,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurfaceVariant,
      opacity: 0.65,
    },
    txSubtitle: {
      fontSize: 10,
      fontFamily: fontsLoaded ? 'SpaceGrotesk_700Bold' : undefined,
      color: C.onSurfaceVariant,
      opacity: 0.5,
    },
    rightContent: {
      alignItems: 'flex-end',
      gap: 4,
    },
    txAmount: {
      fontSize: 16,
      fontFamily: fontsLoaded ? 'Sora_700Bold' : undefined,
    },
    failedTextLineThrough: {
      textDecorationLine: 'line-through',
      opacity: 0.5,
    },
    successText: {
      fontSize: 9,
      fontFamily: fontsLoaded ? 'SpaceGrotesk_700Bold' : undefined,
      color: C.primaryFixedDim,
      letterSpacing: 0.5,
    },
    failedBadge: {
      backgroundColor: 'rgba(255,100,100,0.1)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    failedBadgeText: {
      fontSize: 8,
      fontFamily: fontsLoaded ? 'SpaceGrotesk_700Bold' : undefined,
      color: C.errorColor,
      letterSpacing: 0.5,
    },
  });
}
