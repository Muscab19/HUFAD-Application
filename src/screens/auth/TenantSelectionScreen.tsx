import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTenant } from '../../context/TenantContext';
import { Ionicons } from '@expo/vector-icons';

export const TenantSelectionScreen: React.FC = () => {
  const [subdomain, setSubdomain] = useState('');
  const [loading, setLoading] = useState(false);
  const { setTenantBySubdomain } = useTenant();

  const handleSelectTenant = async () => {
    if (!subdomain.trim()) {
      Alert.alert('Error', 'Please enter your school subdomain');
      return;
    }

    try {
      setLoading(true);
      await setTenantBySubdomain(subdomain.trim().toLowerCase());
    } catch (error: any) {
      Alert.alert('Error', error.message || 'School not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>H</Text>
            </View>
            <Text style={styles.title}>
              Welcome to HUFAD
            </Text>
            <Text style={styles.subtitle}>
              Select your school to continue
            </Text>
          </View>

          {/* School Selection */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                School Subdomain
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="school-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., my-school"
                  value={subdomain}
                  onChangeText={setSubdomain}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
              <Text style={styles.inputHelper}>
                Enter your school's subdomain (e.g., myschool.hufaad.com)
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSelectTenant}
              disabled={loading}
              style={[
                styles.submitButton,
                loading && styles.submitButtonDisabled
              ]}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Continue
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Don't know your subdomain? Contact your school administrator.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    backgroundColor: '#059669',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  form: {
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    color: '#1f2937',
  },
  inputHelper: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#059669',
  },
  submitButtonDisabled: {
    backgroundColor: '#34d399',
  },
  submitButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
  },
  infoBox: {
    marginTop: 32,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 16,
  },
  infoText: {
    color: '#1e40af',
    fontSize: 14,
    textAlign: 'center',
  },
});