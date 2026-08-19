import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface SuspensionGuardProps {
  children: React.ReactNode;
}

export const SuspensionGuard: React.FC<SuspensionGuardProps> = ({ children }) => {
  const { tenant } = useTenant();
  const { logout } = useAuth();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (tenant?.status === 'suspended' || tenant?.status === 'pending') {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [tenant]);

  const handleLogout = async () => {
    setShowModal(false);
    await logout();
  };

  if (!tenant || tenant.status === 'active') {
    return <>{children}</>;
  }

  const isSuspended = tenant.status === 'suspended';
  const isPending = tenant.status === 'pending';

  return (
    <>
      {children}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={[styles.modalHeader, isSuspended ? styles.headerSuspended : styles.headerPending]}>
              <View style={styles.headerContent}>
                <View style={styles.headerIcon}>
                  {isSuspended ? (
                    <Ionicons name="shield" size={32} color="white" />
                  ) : (
                    <Ionicons name="time" size={32} color="white" />
                  )}
                </View>
                <Text style={styles.headerTitle}>
                  {isSuspended ? 'Account Suspended' : 'Account Pending'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {isSuspended ? 'Temporarily' : 'Awaiting Approval'}
                </Text>
              </View>
            </View>

            {/* Body */}
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {/* School Name */}
              <View style={styles.schoolInfo}>
                <Ionicons name="business" size={20} color="#6b7280" />
                <Text style={styles.schoolName}>
                  {tenant.schoolName || 'Your School'}
                </Text>
              </View>

              {/* Main Message */}
              <View style={styles.messageBox}>
                <Text style={styles.messageTitle}>Notice</Text>
                {isSuspended && (
                  <Text style={styles.messageText}>
                    Your school account has been suspended. Please contact the system administrator.
                  </Text>
                )}
                {isPending && (
                  <Text style={styles.messageText}>
                    Your school account is pending approval. Please wait for activation.
                  </Text>
                )}
              </View>

              {/* Suspension Reason */}
              {isSuspended && tenant.suspensionReason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Reason</Text>
                  <Text style={styles.reasonText}>{tenant.suspensionReason}</Text>
                </View>
              )}

              {/* Contact Info */}
              <View style={styles.contactContainer}>
                <View style={styles.contactItem}>
                  <Ionicons name="mail" size={20} color="#3b82f6" />
                  <Text style={styles.contactText}>
                    Contact system administrator
                  </Text>
                </View>
                <View style={styles.contactItem}>
                  <Ionicons name="call" size={20} color="#22c55e" />
                  <Text style={styles.contactText}>
                    Call: <Text style={styles.contactPhone}>+252 61 723 1576</Text>
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={handleLogout}
                style={[styles.logoutButton, isSuspended ? styles.logoutButtonSuspended : styles.logoutButtonPending]}
              >
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 24,
  },
  headerSuspended: {
    backgroundColor: '#dc2626',
  },
  headerPending: {
    backgroundColor: '#eab308',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 999,
    marginBottom: 12,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  modalBody: {
    maxHeight: 400,
  },
  modalBodyContent: {
    padding: 24,
  },
  schoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  schoolName: {
    marginLeft: 8,
    color: '#374151',
    fontWeight: '500',
  },
  messageBox: {
    backgroundColor: '#fffbeb',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 16,
    borderRadius: 4,
    marginBottom: 16,
  },
  messageTitle: {
    color: '#d97706',
    fontWeight: '500',
    marginBottom: 4,
  },
  messageText: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  reasonBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  reasonLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  reasonText: {
    color: '#374151',
    fontSize: 14,
  },
  contactContainer: {
    marginBottom: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  contactText: {
    marginLeft: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  contactPhone: {
    color: '#059669',
    fontWeight: '600',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  logoutButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
  },
  logoutButtonSuspended: {
    backgroundColor: '#dc2626',
  },
  logoutButtonPending: {
    backgroundColor: '#eab308',
  },
  logoutButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
});