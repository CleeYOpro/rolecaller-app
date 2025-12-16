import { generateUuid, localDb, teachersLocal } from '@/database/localdb';
import { eq } from 'drizzle-orm';  // Added missing import
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface TeacherNameInputProps {
  schoolId: string;
  onNameSaved: () => void;
}

export default function TeacherNameInput({ schoolId, onNameSaved }: TeacherNameInputProps) {
  const [teacherName, setTeacherName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [existingTeacherId, setExistingTeacherId] = useState<string | null>(null);
  const router = useRouter();

  // Load existing teacher name if available
  useEffect(() => {
    const loadExistingTeacherName = async () => {
      try {
        const existingTeachers = await localDb
          .select()
          .from(teachersLocal)
          .limit(1);

        if (existingTeachers.length > 0) {
          setTeacherName(existingTeachers[0].name);
          setExistingTeacherId(existingTeachers[0].id);
        }
      } catch (error) {
        console.error('Error loading existing teacher name:', error);
      }
    };

    loadExistingTeacherName();
  }, []);

  const handleSaveName = async () => {
    if (!teacherName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      if (existingTeacherId) {
        // Update existing teacher name
        await localDb.update(teachersLocal)
          .set({ name: teacherName.trim() })
          .where(eq(teachersLocal.id, existingTeacherId));
          
        console.log(`Teacher name updated to "${teacherName.trim()}"`);
      } else {
        // Save new teacher name
        const teacherId = generateUuid();
        await localDb.insert(teachersLocal).values({
          id: teacherId,
          schoolId: schoolId,
          name: teacherName.trim(),
          createdAt: new Date().toISOString(),
        });

        console.log(`Teacher name "${teacherName.trim()}" saved with ID ${teacherId}`);
      }
      
      onNameSaved();
    } catch (error) {
      console.error('Error saving teacher name:', error);
      Alert.alert('Error', 'Failed to save teacher name. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Welcome Teacher!</Text>
          <Text style={styles.subtitle}>Please enter your name to continue</Text>

          <TextInput
            style={styles.input}
            placeholder="Your Name"
            placeholderTextColor="#888"
            value={teacherName}
            onChangeText={setTeacherName}
            autoCapitalize="words"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.disabledButton]}
            onPress={handleSaveName}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Saving...' : existingTeacherId ? 'Update Name' : 'Continue'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#AAAAAA',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2D2D2D',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    color: '#FFFFFF',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3A86FF',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#3A86FF',
    fontSize: 16,
  },
});