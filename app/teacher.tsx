import { AttendanceStatus, Student } from '@/constants/types';
import { attendanceService } from '@/services/attendanceService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TeacherDashboard() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const classId = params.classId as string;
    const className = params.className as string;
    const schoolId = params.schoolId as string;

    const [selectedDate, setSelectedDate] = useState(new Date());
    const today = useMemo(() => selectedDate.toISOString().slice(0, 10), [selectedDate]);

    // State
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Fetch students on mount (from SQLite)
    useEffect(() => {
        if (classId && schoolId) {
            attendanceService.getStudents(schoolId, classId)
                .then(setStudents)
                .catch(err => console.error("Failed to fetch students", err));
        }
    }, [classId, schoolId]);

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
            // 1. Push local changes
            await attendanceService.syncAttendanceToNeon();
            // 2. Pull latest data
            if (schoolId) {
                await attendanceService.syncDataFromNeon(schoolId);
                // Refresh students list
                const updatedStudents = await attendanceService.getStudents(schoolId, classId);
                setStudents(updatedStudents);
            }
            // Refresh attendance
            const updatedAttendance = await attendanceService.getAttendance(classId, today);
            setAttendance(updatedAttendance);

            setToastMessage("Sync Complete!");
        } catch (error) {
            console.error("Sync failed", error);
            setToastMessage("Sync Failed. Check internet.");
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const goBack = () => {
        router.back();
    };

    // Calendar Logic
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    const changeMonth = (delta: number) => {
        setSelectedDate(new Date(currentYear, currentMonth + delta, 1));
    };

    const renderCalendar = () => {
        const days = [];
        // Empty slots for start of month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
        }
        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(currentYear, currentMonth, d);
            const isSelected = date.toDateString() === selectedDate.toDateString();
            days.push(
                <TouchableOpacity
                    key={d}
                    style={[styles.calendarDay, isSelected && styles.selectedDay]}
                    onPress={() => setSelectedDate(date)}
                >
                    <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>{d}</Text>
                </TouchableOpacity>
            );
        }

        return (
            <View style={styles.calendarGrid}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <Text key={d} style={styles.weekDayText}>{d}</Text>
                ))}
                {days}
            </View>
        );
    };

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
                        <Text style={[styles.backButtonText, { color: '#FFF' }]}>Sync</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={goBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={20} color="#EAEAEA" />
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content}>
                {/* Calendar Section */}
                <View style={styles.card}>
                    <View style={styles.calendarHeader}>
                        <TouchableOpacity onPress={() => changeMonth(-1)}>
                            <Ionicons name="chevron-back" size={24} color="#EAEAEA" />
                        </TouchableOpacity>
                        <Text style={styles.monthTitle}>
                            {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </Text>
                        <TouchableOpacity onPress={() => changeMonth(1)}>
                            <Ionicons name="chevron-forward" size={24} color="#EAEAEA" />
                        </TouchableOpacity>
                    </View>
                    {renderCalendar()}
                </View>

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
                            {students.map((s, idx) => {
                                const currentStatus = attendance[s.id];
                                return (
                                    <View key={s.id} style={styles.studentItem}>
                                        <View style={styles.studentInfo}>
                                            <View style={styles.avatar}>
                                                <Text style={styles.avatarText}>{idx + 1}</Text>
                                            </View>
                                            <View>
                                                <Text style={styles.studentName}>{s.name}</Text>
                                                <Text style={styles.studentId}>ID: {s.id}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.actionButtons}>
                                            {(['present', 'late', 'absent'] as const).map((status) => (
                                                <TouchableOpacity
                                                    key={status}
                                                    style={[
                                                        styles.actionButton,
                                                        currentStatus === status && styles.activeActionButton,
                                                        currentStatus === status && { borderColor: getStatusColor(status) }
                                                    ]}
                                                    onPress={() => markAttendance(s.id, status)}
                                                >
                                                    <Text style={[
                                                        styles.actionButtonText,
                                                        currentStatus === status && { color: getStatusColor(status) }
                                                    ]}>
                                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })}
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
    monthTitle: {
        color: '#EAEAEA',
        fontSize: 16,
        fontWeight: '600',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    weekDayText: {
        width: '14.28%',
        textAlign: 'center',
        color: '#888',
        marginBottom: 8,
        fontSize: 12,
        fontWeight: 'bold',
    },
    calendarDay: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
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
});
