import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/constants';
import { AdminNavigator } from './AdminNavigator';
import { TeacherNavigator } from './TeacherNavigator';
import { StudentNavigator } from './StudentNavigator';
import { ParentNavigator } from './ParentNavigator';
import { View, Text, StyleSheet } from 'react-native';

export const RoleNavigator: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  switch (user.role) {
    case ROLES.ADMIN:
    case ROLES.SCHOOL_ADMIN:
    case ROLES.BRANCH_ADMIN:
      return <AdminNavigator />;
    case ROLES.TEACHER:
      return <TeacherNavigator />;
    case ROLES.STUDENT:
      return <StudentNavigator />;
    case ROLES.PARENT:
      return <ParentNavigator />;
    default:
      return (
        <View style={styles.container}>
          <Text>Unknown role: {user.role}</Text>
        </View>
      );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});