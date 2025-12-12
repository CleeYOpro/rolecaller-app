import { Class, School } from '@/constants/types';
import { api } from '@/services/api';
import { storage } from '@/services/storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// app/index.tsx - CORRECT imports
import { localDb, teachersLocal } from '@/database/localdb';
import { attendanceService } from '@/services/attendanceService';
import { eq } from 'drizzle-orm';
import TeacherNameInput from './components/TeacherNameInput';

export default function LoginPage() {
    const router = useRouter();
    const [role, setRole] = useState<"admin" | "teacher" | null>(null);
    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [schoolEmail, setSchoolEmail] = useState("");
    const [schoolPassword, setSchoolPassword] = useState("");
    const [error, setError] = useState("");
    const [showSchoolPicker, setShowSchoolPicker] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [needsNameInput, setNeedsNameInput] = useState(false);
    const [showPassword, setShowPassword] = useState(false); // New state for password visibility

    // Teacher specific
    const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
    const [selectedClass, setSelectedClass] = useState<Class | null>(null);

    // Fetch schools on mount
    const fetchSchools = () => {
        setError("");
        api.getSchools()
            .then((schools) => {
                console.log("Fetched schools:", schools);
                setSchools(schools);
                if (schools.length === 0) {
                    setError("No schools found. Please make sure the API server is running.");
                }
            })
            .catch(err => {
                console.error("Failed to fetch schools", err);
                setError(`Failed to connect to server: ${err.message}`);
            });
    };

    React.useEffect(() => {
        fetchSchools();
    }, []);

    const goBack = () => {
        setRole(null);
        setSelectedSchool(null);
        setSchoolEmail("");
        setSchoolPassword("");
        setError("");
        setSelectedClass(null);
        setAvailableClasses([]);
        setNeedsNameInput(false);
    };

    const handleTeacherLogin = async () => {
        setRole("teacher");

        const hasData = await attendanceService.hasOfflineData();

        if (hasData) {
            const savedSchool = await storage.getSchool();

            if (!savedSchool) {
                Alert.alert("Error", "Offline data found but school not saved. Please log in online once.");
                setShowSchoolPicker(true);
                return;
            }

            // Pre-select the saved school but require password entry
            const schools = await api.getSchools();
            const school = schools.find(s => s.id === savedSchool.id);

            if (school) {
                setSelectedSchool(school);
                setSchoolEmail(school.email);
                setSchoolPassword(""); // Explicitly clear password field for security
                setShowSchoolPicker(true);
            } else {
                // If school not found in API, show picker to select manually
                setSchoolPassword(""); // Explicitly clear password field for security
                setShowSchoolPicker(true);
            }
        } else {
            // First time ever → show school picker
            setSchoolPassword(""); // Explicitly clear password field for security
            setShowSchoolPicker(true);
        }
    };

    const checkTeacherName = async (schoolId: string) => {
        try {
            // Check if teacher name already exists for this school
            const existingTeachers = await localDb
                .select()
                .from(teachersLocal)
                .where(eq(teachersLocal.schoolId, schoolId))
                .limit(1);

            if (existingTeachers.length === 0) {
                // No teacher name found, need to input name
                setNeedsNameInput(true);
            } else {
                // Teacher name exists, continue to class selection
                try {
                    const classes = await api.getClasses(schoolId);
                    if (classes.length === 0) {
                        Alert.alert("No Classes", "There are no classes set up for this school yet.");
                    } else {
                        setAvailableClasses(classes);
                    }
                } catch (err) {
                    console.error("Failed to fetch classes", err);
                    Alert.alert("Error", "Failed to load classes");
                }
            }
        } catch (error) {
            console.error("Error checking teacher name:", error);
            // In case of error, continue to class selection
            try {
                const classes = await api.getClasses(schoolId);
                if (classes.length === 0) {
                    Alert.alert("No Classes", "There are no classes set up for this school yet.");
                } else {
                    setAvailableClasses(classes);
                }
            } catch (err) {
                console.error("Failed to fetch classes", err);
                Alert.alert("Error", "Failed to load classes");
            }
        }
    };

    const handleLogin = async () => {
        if (!selectedSchool) {
            setError("Please select a school");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            // Verify credentials via API
            await api.login(schoolEmail, schoolPassword);

            // Save school to storage on successful login
            await storage.saveSchool(selectedSchool.id, selectedSchool.name);

            if (role === "admin") {
                router.push({
                    pathname: "/admin",
                    params: { schoolId: selectedSchool.id, schoolName: selectedSchool.name }
                });
            } else if (role === "teacher") {
                // Ask to download data only on first login
                const hasData = await attendanceService.hasOfflineData();
                if (!hasData) {
                    Alert.alert(
                        "Download for Offline Use",
                        "Download your school data now to work without internet?",
                        [
                            { text: "Later", style: "cancel" },
                            {
                                text: "Download", onPress: async () => {
                                    try {
                                        await attendanceService.downloadSchoolData(selectedSchool.id);
                                        Alert.alert("Success", "You can now work offline!");
                                        // After downloading data, check if teacher name is needed
                                        await checkTeacherName(selectedSchool.id);
                                    } catch (err: any) {
                                        Alert.alert("Failed", err.message || "Check internet");
                                    }
                                }
                            }
                        ]
                    );
                } else {
                    // Already has data, check if teacher name is needed
                    await checkTeacherName(selectedSchool.id);
                }
            }
        } catch (err: any) {
            console.error("Login error:", err);
            setError(err.message || "Invalid credentials or connection error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClassSelect = (cls: Class) => {
        setSelectedClass(cls);
        router.push({
            pathname: "/teacher",
            params: {
                schoolId: selectedSchool!.id,
                classId: cls.id,
                className: cls.name
            }
        });
    };

    // Render Teacher Name Input Screen
    if (role === "teacher" && needsNameInput) {
        return (
            <TeacherNameInput
                schoolId={selectedSchool!.id}
                onNameSaved={() => {
                    setNeedsNameInput(false);
                    // After saving name, fetch classes
                    api.getClasses(selectedSchool!.id)
                        .then(classes => {
                            if (classes.length === 0) {
                                Alert.alert("No Classes", "There are no classes set up for this school yet.");
                            } else {
                                setAvailableClasses(classes);
                            }
                        })
                        .catch(err => {
                            console.error("Failed to fetch classes", err);
                            Alert.alert("Error", "Failed to load classes");
                        });
                }}
            />
        );
    }

    // Render Role Selection
    if (!role) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" />
                <View style={styles.contentContainer}>
                    <Text style={styles.title}>
                        Hi, welcome to <Text style={styles.highlight}>rolecaller!</Text>
                    </Text>

                    <View style={styles.buttonGroup}>
                        <TouchableOpacity
                            style={styles.roleButton}
                            onPress={() => setRole("admin")}
                        >
                            <Text style={styles.roleButtonText}>Sign in as Admin</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.roleButton, styles.teacherButton]}
                            onPress={handleTeacherLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.roleButtonText}>Sign in as Teacher</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    // Render Class Selection for Teacher
    if (role === "teacher" && availableClasses.length > 0) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" />
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Select ya Class</Text>
                    <Text style={styles.cardSubtitle}>Choose a class to take attendance</Text>

                    <ScrollView style={styles.classList}>
                        {availableClasses.map((cls) => (
                            <TouchableOpacity
                                key={cls.id}
                                style={styles.classButton}
                                onPress={() => handleClassSelect(cls)}
                            >
                                <Text style={styles.classButtonText}>{cls.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <TouchableOpacity style={styles.backButton} onPress={goBack}>
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Render Login Form
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        {role === "admin" ? "Admin Login" : "Teacher Login"}
                    </Text>
                    <Text style={styles.cardSubtitle}>Login with school credentials</Text>

                    {/* School Picker Trigger */}
                    <TouchableOpacity
                        style={styles.input}
                        onPress={() => setShowSchoolPicker(true)}
                    >
                        <Text style={[styles.inputText, !selectedSchool && styles.placeholderText]}>
                            {selectedSchool ? selectedSchool.name : "Select a school"}
                        </Text>
                    </TouchableOpacity>

                    {schools.length === 0 && (
                        <TouchableOpacity onPress={fetchSchools} style={{ marginBottom: 16 }}>
                            <Text style={{ color: '#3A86FF', textAlign: 'center' }}>
                                No schools found. Tap to retry connection.
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TextInput
                        style={styles.input}
                        placeholder="School email"
                        placeholderTextColor="#888"
                        value={schoolEmail}
                        onChangeText={setSchoolEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="Password"
                            placeholderTextColor="#888"
                            value={schoolPassword}
                            onChangeText={setSchoolPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <Text style={styles.eyeIconText}>
                                {showPassword ? '👁️' : '👁️‍🗨️'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        style={[styles.loginButton, isLoading && styles.disabledButton]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.loginButtonText}>Login</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.backButton} onPress={goBack}>
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* School Picker Modal */}
            <Modal
                visible={showSchoolPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowSchoolPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select School</Text>
                        <FlatList
                            data={schools}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => {
                                        setSelectedSchool(item);
                                        setSchoolEmail(item.email);
                                        setShowSchoolPicker(false);
                                    }}
                                >
                                    <Text style={styles.modalItemText}>{item.name}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowSchoolPicker(false)}
                        >
                            <Text style={styles.modalCloseButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    contentContainer: {
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        gap: 48,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    highlight: {
        color: '#3A86FF',
    },
    buttonGroup: {
        width: '100%',
        gap: 16,
    },
    roleButton: {
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    teacherButton: {
        backgroundColor: '#3A86FF',
        borderColor: '#3A86FF',
    },
    roleButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    cardSubtitle: {
        fontSize: 16,
        color: '#AAAAAA',
        marginBottom: 24,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#2D2D2D',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        width: '100%',
        color: '#FFFFFF',
        fontSize: 16,
    },
    inputText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    placeholderText: {
        color: '#888888',
    },
    loginButton: {
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
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    backButton: {
        padding: 8,
    },
    backButtonText: {
        color: '#3A86FF',
        fontSize: 16,
    },
    errorText: {
        color: '#FF6B6B',
        marginBottom: 16,
        textAlign: 'center',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2D2D2D',
        borderRadius: 8,
        marginBottom: 16,
        width: '100%',
    },
    passwordInput: {
        flex: 1,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 16,
    },
    eyeIcon: {
        padding: 16,
    },
    eyeIconText: {
        fontSize: 18,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    modalItemText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    modalCloseButton: {
        marginTop: 16,
        padding: 12,
        alignItems: 'center',
    },
    modalCloseButtonText: {
        color: '#FF6B6B',
        fontSize: 16,
        fontWeight: '600',
    },
    classList: {
        maxHeight: 300,
        width: '100%',
        marginBottom: 24,
    },
    classButton: {
        backgroundColor: '#2D2D2D',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
    },
    classButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
    },
});
