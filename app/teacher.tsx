import { AttendanceStatus, Student } from '@/constants/types';
import { attendanceService } from '@/services/attendanceService';
import { storage } from '@/services/storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TeacherDashboard() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const classId = params.classId as string;
    const className = params.className as string;
    const schoolId = params.schoolId as string;
    const schoolName = params.schoolName as string;

    const [selectedDate, setSelectedDate] = useState(new Date());
    const today = useMemo(() => selectedDate.toISOString().slice(0, 10), [selectedDate]);

    // State
    const [students, setStudents] = useState<Student[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [allClasses, setAllClasses] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showSearchView, setShowSearchView] = useState(false);

    // Add state
    const [unsyncedCount, setUnsyncedCount] = useState(0);
    const [isPushing, setIsPushing] = useState(false);

    // Add effect to watch unsynced
    useEffect(() => {
        const updateUnsynced = async () => {
            const count = await attendanceService.getUnsyncedCount();
            setUnsyncedCount(count);
        };
        updateUnsynced();
        const interval = setInterval(updateUnsynced, 5000); // 5 sec
        return () => clearInterval(interval);
    }, []);

    // Fetch students on mount (from SQLite)
    useEffect(() => {
        if (classId && schoolId) {
            attendanceService.getStudents(schoolId, classId)
                .then(setStudents)
                .catch(err => console.error("Failed to fetch students", err));
        }
    }, [classId, schoolId]);

    // Fetch all students of the school
    useEffect(() => {
        if (schoolId) {
            attendanceService.getAllStudents(schoolId)
                .then(setAllStudents)
                .catch(err => console.error("Failed to fetch all students", err));

            attendanceService.getClasses(schoolId)
                .then(setAllClasses)
                .catch(err => console.error("Failed to fetch classes", err));
        }
    }, [schoolId]);

    // Fetch attendance when date or class changes (API + SQLite)
    useEffect(() => {
        if (classId) {
            attendanceService.getAttendance(classId, today)
                .then(setAttendance)
                .catch(err => console.error("Failed to fetch attendance", err));
        }
    }, [classId, today]);

    const markAttendance = async (studentId: string, status: AttendanceStatus) => {
        // Optimistic update
        setAttendance(prev => ({
            ...prev,
            [studentId]: status
        }));

        try {
            await attendanceService.markAttendance(studentId, classId, today, status);
            setToastMessage(`Attendance marked as ${status}`);
        } catch (err) {
            console.error("Failed to mark attendance", err);
            setToastMessage("Failed to save attendance");
        }
    };

    const handleSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setToastMessage("Syncing...");
        try {
            // 1. Push offline attendance to Neon
            const result = await attendanceService.pushOfflineAttendance();
            if (result.success > 0) {
                Alert.alert("Success", `Pushed ${result.success} attendance records!`);
            }

            // 2. (Optional) Pull fresh classes/students if you want latest data
            const school = await storage.getSchool();
            if (school) {
                await attendanceService.downloadSchoolData(school.id);
                Alert.alert("Updated", "Latest classes & students downloaded");
            }

            // Refresh students list
            if (schoolId) {
                const updatedStudents = await attendanceService.getStudents(schoolId, classId);
                setStudents(updatedStudents);

                // Refresh all students list
                const allUpdatedStudents = await attendanceService.getAllStudents(schoolId);
                setAllStudents(allUpdatedStudents);
            }

            // Refresh attendance
            const updatedAttendance = await attendanceService.getAttendance(classId, today);
            setAttendance(updatedAttendance);

            setToastMessage("Sync Complete!");
        } catch (error) {
            console.error("Sync failed", error);
            setToastMessage("Sync Failed. Check internet.");
            Alert.alert("Failed", "Check internet connection");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleStudentUpdate = (updatedStudent: Student) => {
        // Update the students list with the modified student
        setStudents(prevStudents =>
            prevStudents.map(student =>
                student.id === updatedStudent.id ? updatedStudent : student
            )
        );

        // Also update the allStudents list
        setAllStudents(prevAllStudents =>
            prevAllStudents.map(student =>
                student.id === updatedStudent.id ? updatedStudent : student
            )
        );
    };

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const goBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace("/");
        }
    };

    if (!classId) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" />
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Select YOUR Class</Text>
                        <Text style={styles.headerSubtitle}>{schoolName}</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.replace("/")} style={styles.backButton}>
                        <Ionicons name="log-out-outline" size={20} color="#EAEAEA" />
                        <Text style={styles.backButtonText}>Logout</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                    {allClasses.length === 0 ? (
                        <View style={{ marginTop: 50, alignItems: 'center' }}>
                            <Text style={{ color: '#888', marginBottom: 20 }}>Loading classes...</Text>
                            <ActivityIndicator size="large" color="#3A86FF" />
                        </View>
                    ) : (
                        allClasses.map(cls => (
                            <TouchableOpacity
                                key={cls.id}
                                onPress={() => {
                                    router.replace({
                                        pathname: "/teacher",
                                        params: {
                                            schoolId,
                                            schoolName,
                                            classId: cls.id,
                                            className: cls.name,
                                        },
                                    });
                                }}
                                style={[styles.card, { marginBottom: 12, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                            >
                                <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>{cls.name}</Text>
                                <Ionicons name="chevron-forward" size={24} color="#666" />
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Class Dashboard</Text>
                    <Text style={styles.headerSubtitle}>Class: {className}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        onPress={handleSync}
                        style={[styles.backButton, { backgroundColor: isSyncing ? '#2D2D2D' : '#3A86FF', borderColor: '#3A86FF' }]}
                        disabled={isSyncing}
                    >
                        {isSyncing ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Ionicons name="sync" size={20} color="#FFF" />
                        )}
                        <Text style={[styles.backButtonText, { color: '#FFF' }]}>
                            {isSyncing ? 'Syncing...' : 'Push & Pull'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={goBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={20} color="#EAEAEA" />
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                </View>
            </View>



            <ScrollView style={styles.content}>
                {/* Students List */}
                <View style={[styles.card, { marginTop: 20, marginBottom: 40 }]}>
                    <View style={styles.listHeader}>
                        <Text style={styles.listTitle}>
                            Students - {selectedDate.toLocaleDateString()}
                        </Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{students.length} students</Text>
                        </View>
                    </View>

                    {students.length === 0 ? (
                        <Text style={styles.emptyText}>No students assigned.</Text>
                    ) : (
                        <View style={styles.studentList}>
                            {students.map((s, idx) => (
                                <View key={s.id} style={styles.studentItem}>
                                    <View style={styles.studentInfo}>
                                        <View style={styles.avatar}>
                                            <Text style={styles.avatarText}>
                                                {s.name.charAt(0)}
                                            </Text>
                                        </View>
                                        <View>
                                            <Text style={styles.studentName}>{s.name}</Text>
                                            <Text style={styles.studentId}>{s.id}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity
                                            style={[
                                                styles.actionButton,
                                                attendance[s.id] === 'present' && styles.activeActionButton
                                            ]}
                                            onPress={() => markAttendance(s.id, 'present')}
                                        >
                                            <Text
                                                style={[
                                                    styles.actionButtonText,
                                                    attendance[s.id] === 'present' && { color: '#4CAF50' }
                                                ]}
                                            >
                                                Present
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.actionButton,
                                                attendance[s.id] === 'late' && styles.activeActionButton
                                            ]}
                                            onPress={() => markAttendance(s.id, 'late')}
                                        >
                                            <Text
                                                style={[
                                                    styles.actionButtonText,
                                                    attendance[s.id] === 'late' && { color: '#ED6C02' }
                                                ]}
                                            >
                                                Late
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.actionButton,
                                                attendance[s.id] === 'absent' && styles.activeActionButton
                                            ]}
                                            onPress={() => markAttendance(s.id, 'absent')}
                                        >
                                            <Text
                                                style={[
                                                    styles.actionButtonText,
                                                    attendance[s.id] === 'absent' && { color: '#D32F2F' }
                                                ]}
                                            >
                                                Absent
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Toast */}
            {toastMessage && (
                <View style={styles.toast}>
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </View>
            )}
        </View>
    );
}

const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
        case 'present': return '#4CAF50';
        case 'late': return '#ED6C02';
        case 'absent': return '#D32F2F';
        default: return '#EAEAEA';
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#F1F1F1',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#D1D1D1',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    backButtonText: {
        color: '#EAEAEA',
        marginLeft: 4,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },

    selectedDay: {
        backgroundColor: '#3A86FF',
        borderRadius: 8,
    },
    dayText: {
        color: '#EAEAEA',
    },
    selectedDayText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    listTitle: {
        color: '#F1F1F1',
        fontSize: 16,
        fontWeight: 'bold',
    },
    badge: {
        backgroundColor: '#2D2D2D',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        color: '#D1D1D1',
        fontSize: 12,
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        padding: 20,
    },
    studentList: {
        gap: 12,
    },
    studentItem: {
        backgroundColor: '#121212',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    studentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(58, 134, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#3A86FF',
        fontWeight: 'bold',
    },
    studentName: {
        color: '#EAEAEA',
        fontWeight: '600',
        fontSize: 16,
    },
    studentId: {
        color: '#888',
        fontSize: 12,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: '#2D2D2D',
        alignItems: 'center',
    },
    activeActionButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    actionButtonText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    toast: {
        position: 'absolute',
        top: 60,
        right: 20,
        backgroundColor: '#3A86FF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    toastText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    // Add to your styles
    syncContainer: {
        padding: 10,
        backgroundColor: '#f0f0f0',
    },
    pushButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        padding: 12,
        borderRadius: 8,
    },
    pushButtonText: {
        color: 'white',
        marginLeft: 8,
        fontWeight: '600',
    },
    pushing: {
        opacity: 0.7,
    },
});