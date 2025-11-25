import { Class, School } from '@/constants/types';
import { api } from '@/services/api';
import { attendanceService } from '@/services/attendanceService';
import { storage } from '@/services/storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginPage() {
    const router = useRouter();
    const [role, setRole] = useState<"admin" | "teacher" | null>(null);
    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [schoolEmail, setSchoolEmail] = useState("");
    const [schoolPassword, setSchoolPassword] = useState("password");
    const [error, setError] = useState("");
    const [showSchoolPicker, setShowSchoolPicker] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

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
        // Initialize SQLite on mount to be ready
        attendanceService.init().catch(console.error);
    }, []);

    const goBack = () => {
        setRole(null);
        setSelectedSchool(null);
        setSchoolEmail("");
        setSchoolPassword("password");
        setError("");
        setSelectedClass(null);
        setAvailableClasses([]);
    };

    const handleTeacherLogin = async () => {
        setIsLoading(true);
        try {
            // Ensure DB is initialized before checking local data
            await attendanceService.init();

            // 1. Check if we have any local data (implies we are "locked" to a school)
            const localSchoolId = await attendanceService.getLocalSchoolId();

            if (localSchoolId) {
                console.log("Found local school ID:", localSchoolId);
                // 2. Check if we have local data for this school
                const classes = await attendanceService.getClasses(localSchoolId);
                if (classes.length > 0) {
                    console.log("Found local classes, skipping login");
                    // We don't have the school name easily available without querying API or storing it separately.
                    // For now, we can use a placeholder or just the ID. 
                    // Ideally, we should store school name in SQLite too, but schema change is restricted.
                    // We can fetch it from storage if available, or just use "Your School".
                    const savedSchool = await storage.getSchool();
                    const schoolName = savedSchool?.id === localSchoolId ? savedSchool.name : "Your School";

                    setSelectedSchool({ id: localSchoolId, name: schoolName } as School);
                    setAvailableClasses(classes);
                    setRole("teacher");
                    setIsLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.error("Error checking local data", e);
        }

        // If no local data, proceed to normal role selection (which shows login form)
        setRole("teacher");
        setIsLoading(false);
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

            // Initialize SQLite and Sync
            try {
                await attendanceService.init();
                await attendanceService.syncDataFromNeon(selectedSchool.id);
                // Save school to storage on successful sync/login
                await storage.saveSchool(selectedSchool.id, selectedSchool.name);
            } catch (syncErr) {
                console.warn("Sync/Init failed, proceeding with local data if available", syncErr);
            }

            if (role === "admin") {
                router.push({
                    pathname: "/admin" as any,
                    params: { schoolId: selectedSchool.id, schoolName: selectedSchool.name }
                });
            } else {
                // For teacher, fetch classes from SQLite (with API fallback)
                try {
                    const classes = await attendanceService.getClasses(selectedSchool.id);
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
            pathname: "/teacher" as any,
            params: {
                schoolId: selectedSchool!.id,
                classId: cls.id,
                className: cls.name
            }
        });
    };

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
                    <Text style={styles.cardTitle}>Select Your Class</Text>
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
        <View style={styles.container}>
            <StatusBar style="light" />
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

                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#888"
                    value={schoolPassword}
                    onChangeText={setSchoolPassword}
                    secureTextEntry
                />

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
        </View>
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
        backgroundColor: '#3A86FF',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    teacherButton: {
        backgroundColor: '#181F2A',
    },
    roleButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 32,
        gap: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    cardTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 16,
        color: '#EAEAEA',
    },
    input: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 12,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 16,
    },
    inputText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    placeholderText: {
        color: '#888',
    },
    loginButton: {
        backgroundColor: '#3A86FF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: {
        backgroundColor: '#181F2A',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#3A86FF',
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    errorText: {
        color: '#ff4d4f',
        backgroundColor: '#451A1A',
        padding: 12,
        borderRadius: 8,
        overflow: 'hidden',
    },
    classList: {
        maxHeight: 300,
        width: '100%',
    },
    classButton: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    classButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 350,
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 20,
        maxHeight: '60%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalItem: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2D2D2D',
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
        color: '#3A86FF',
        fontSize: 16,
        fontWeight: '600',
    },
    disabledButton: {
        opacity: 0.7,
    },
});
