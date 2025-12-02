import type { Class, Student } from '@/constants/types';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;

interface StudentSearchOverviewProps {
    students: Student[];
    classes: Class[];
    classId: string;
    onStudentUpdate: (student: Student) => void;
    refreshData: () => Promise<void>;
}

export default function StudentSearchOverview({
    students,
    classes,
    onStudentUpdate,
    refreshData,
}: StudentSearchOverviewProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', grade: '', classId: '' });
    const [showListView, setShowListView] = useState(false);

    // Bottom sheet animation
    const slideAnim = useRef(new Animated.Value(height)).current;

    const openSheet = () => {
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeSheet = () => {
        Animated.timing(slideAnim, {
            toValue: height,
            duration: 300,
            useNativeDriver: true,
        }).start(() => setSelectedStudent(null));
    };

    useEffect(() => {
        if (selectedStudent && isMobile) {
            openSheet();
        }
    }, [selectedStudent]);

    // Filter students
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const query = searchQuery.toLowerCase();
        return students.filter(
            (s) =>
                s.name.toLowerCase().includes(query) ||
                s.id.toLowerCase().includes(query)
        );
    }, [students, searchQuery]);

    // Load attendance
    const loadAttendance = async (student: Student) => {
        if (!student.classId) return;
        try {
            const data = await api.getAllAttendance(student.classId);
            const studentAttendance: Record<string, string> = {};
            Object.keys(data).forEach((date) => {
                if (data[date][student.id]) {
                    studentAttendance[date] = data[date][student.id];
                }
            });
            setAttendanceData(studentAttendance);
        } catch (err) {
            console.error('Failed to load attendance', err);
            Alert.alert('Error', 'Failed to load attendance data');
        }
    };

    const handleSelectStudent = (student: Student) => {
        setSelectedStudent(student);
        loadAttendance(student);
    };

    // Attendance summary
    const attendanceSummary = useMemo(() => {
        const summary = { present: 0, late: 0, absent: 0 };
        Object.values(attendanceData).forEach((status) => {
            if (status === 'present') summary.present++;
            else if (status === 'late') summary.late++;
            else if (status === 'absent') summary.absent++;
        });
        const total = summary.present + summary.late + summary.absent;
        return {
            ...summary,
            total,
            presentPercent: total > 0 ? Math.round((summary.present / total) * 100) : 0,
            latePercent: total > 0 ? Math.round((summary.late / total) * 100) : 0,
            absentPercent: total > 0 ? Math.round((summary.absent / total) * 100) : 0,
        };
    }, [attendanceData]);

    const startEdit = () => {
        if (!selectedStudent) return;
        setEditForm({
            name: selectedStudent.name,
            grade: selectedStudent.grade || '',
            classId: selectedStudent.classId || classes[0]?.id || '',
        });
        setIsEditModalVisible(true);
    };

    const saveEdit = async () => {
        if (!selectedStudent) return;
        try {
            await api.updateStudent({
                ...selectedStudent,
                name: editForm.name.trim(),
                grade: editForm.grade.trim(),
                classId: editForm.classId || undefined,
            });

            const updated = {
                ...selectedStudent,
                name: editForm.name.trim(),
                grade: editForm.grade.trim(),
                classId: editForm.classId || undefined,
            };

            setSelectedStudent(updated);
            onStudentUpdate(updated);
            setIsEditModalVisible(false);
            if (refreshData) await refreshData();
            Alert.alert('Success', 'Student updated successfully');
        } catch (err) {
            Alert.alert('Error', 'Failed to update student');
        }
    };

    // Calendar generation
    const generateCalendar = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const calendar: (number | null)[] = [];
        for (let i = 0; i < startingDayOfWeek; i++) calendar.push(null);
        for (let day = 1; day <= daysInMonth; day++) calendar.push(day);

        return { calendar, year, month, daysInMonth };
    };

    const { calendar, year, month } = generateCalendar();
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const getAttendanceColor = (day: number | null) => {
        if (!day) return 'transparent';
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const status = attendanceData[dateStr];
        if (status === 'present') return '#4CAF50';
        if (status === 'late') return '#ED6C02';
        if (status === 'absent') return '#D32F2F';
        return 'transparent';
    };

    const getAttendanceStatus = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const status = attendanceData[dateStr];
        if (status === 'present') return { text: 'Present', color: '#4CAF50' };
        if (status === 'late') return { text: 'Late', color: '#ED6C02' };
        if (status === 'absent') return { text: 'Absent', color: '#D32F2F' };
        return { text: 'No Data', color: '#666' };
    };

    useEffect(() => {
        if (selectedStudent) loadAttendance(selectedStudent);
    }, [selectedStudent]);

    // Shared Details Content
    const DetailsContent = () => (
        <>
            <View style={styles.detailsHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.detailsName}>{selectedStudent?.name}</Text>
                    <Text style={styles.detailsInfo}>
                        ID: {selectedStudent?.id} • Grade: {selectedStudent?.grade || 'N/A'}
                    </Text>
                    <Text style={styles.detailsInfo}>
                        Class: {classes.find(c => c.id === selectedStudent?.classId)?.name || 'Unassigned'}
                    </Text>
                </View>
                <TouchableOpacity style={styles.editButton} onPress={startEdit}>
                    <Ionicons name="pencil" size={20} color="#FFF" />
                    <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>Attendance Summary</Text>
                <View style={styles.chartContainer}>
                    {[
                        { label: 'Present', percent: attendanceSummary.presentPercent, count: attendanceSummary.present, color: '#4CAF50' },
                        { label: 'Late', percent: attendanceSummary.latePercent, count: attendanceSummary.late, color: '#ED6C02' },
                        { label: 'Absent', percent: attendanceSummary.absentPercent, count: attendanceSummary.absent, color: '#D32F2F' },
                    ].map((item) => (
                        <View key={item.label} style={styles.chartRow}>
                            <Text style={[styles.chartLabel, { color: item.color }]}>{item.label}</Text>
                            <View style={styles.chartBarContainer}>
                                <View style={[styles.chartBar, { width: `${item.percent}%`, backgroundColor: item.color }]} />
                            </View>
                            <Text style={styles.chartValue}>{item.percent}% ({item.count})</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.calendarSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={styles.sectionTitle}>{monthNames[month]} {year}</Text>
                    {isMobile && (
                        <TouchableOpacity onPress={() => setShowListView(v => !v)}>
                            <Text style={{ color: '#3A86FF', fontWeight: '600' }}>
                                {showListView ? 'Grid' : 'List'} View
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {!showListView ? (
                    <>
                        <View style={styles.calendarHeader}>
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                <Text key={i} style={styles.calendarHeaderDay}>{d}</Text>
                            ))}
                        </View>
                        <View style={styles.calendarGrid}>
                            {calendar.map((day, idx) => (
                                <View
                                    key={idx}
                                    style={[
                                        styles.calendarDay,
                                        { backgroundColor: getAttendanceColor(day) },
                                        day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
                                            ? styles.todayHighlight
                                            : null,
                                    ]}
                                >
                                    <Text style={styles.calendarDayText}>{day || ''}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                ) : (
                    <ScrollView style={{ maxHeight: 500 }}>
                        {Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1).map((day) => {
                            const { text, color } = getAttendanceStatus(day);
                            return (
                                <View key={day} style={styles.listDayItem}>
                                    <Text style={styles.listDayText}>{day} {monthNames[month]}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={[styles.statusDot, { backgroundColor: color }]} />
                                        <Text style={[styles.listStatusText, { color }]}>{text}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                )}

                <View style={styles.legend}>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} /><Text style={styles.legendText}>Present</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ED6C02' }]} /><Text style={styles.legendText}>Late</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#D32F2F' }]} /><Text style={styles.legendText}>Absent</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555' }]} /><Text style={styles.legendText}>No Data</Text></View>
                </View>
            </View>
        </>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Student Search & Attendance</Text>

            {isMobile ? (
                <>
                    {/* Mobile: Sticky Search + List */}
                    <View style={styles.mobileSearchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or ID..."
                            placeholderTextColor="#888"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    <ScrollView style={{ flex: 1 }}>
                        <View style={{ paddingHorizontal: 16 }}>
                            {classes.map((cls) => {
                                const classStudents = filteredStudents.filter(s => s.classId === cls.id);
                                if (classStudents.length === 0) return null;

                                return (
                                    <View key={cls.id} style={styles.classSection}>
                                        <Text style={styles.classHeader}>{cls.name}</Text>
                                        {classStudents.map((student) => (
                                            <TouchableOpacity
                                                key={student.id}
                                                style={[
                                                    styles.mobileStudentItem,
                                                    selectedStudent?.id === student.id && styles.mobileStudentItemSelected,
                                                ]}
                                                onPress={() => handleSelectStudent(student)}
                                            >
                                                <View>
                                                    <Text style={styles.mobileStudentName}>{student.name}</Text>
                                                    <Text style={styles.mobileStudentId}>ID: {student.id}</Text>
                                                </View>
                                                <Ionicons name="chevron-forward" size={24} color="#888" />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                );
                            })}

                            {/* Unassigned */}
                            {(() => {
                                const unassigned = filteredStudents.filter(s => !s.classId || !classes.find(c => c.id === s.classId));
                                if (unassigned.length === 0) return null;
                                return (
                                    <View style={styles.classSection}>
                                        <Text style={styles.classHeader}>Unassigned</Text>
                                        {unassigned.map((student) => (
                                            <TouchableOpacity
                                                key={student.id}
                                                style={[
                                                    styles.mobileStudentItem,
                                                    selectedStudent?.id === student.id && styles.mobileStudentItemSelected,
                                                ]}
                                                onPress={() => handleSelectStudent(student)}
                                            >
                                                <View>
                                                    <Text style={styles.mobileStudentName}>{student.name}</Text>
                                                    <Text style={styles.mobileStudentId}>ID: {student.id}</Text>
                                                </View>
                                                <Ionicons name="chevron-forward" size={24} color="#888" />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                );
                            })()}
                        </View>
                    </ScrollView>

                    {/* Mobile Bottom Sheet */}
                    <Modal visible={!!selectedStudent && isMobile} transparent animationType="none">
                        <Pressable style={styles.sheetOverlay} onPress={closeSheet}>
                            <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
                                <Pressable onPress={(e) => e.stopPropagation()}>
                                    <View style={styles.sheetHandle} />
                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16 }}>
                                        <TouchableOpacity onPress={closeSheet}>
                                            <Ionicons name="close" size={28} color="#AAA" />
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
                                        <DetailsContent />
                                    </ScrollView>
                                </Pressable>
                            </Animated.View>
                        </Pressable>
                    </Modal>
                </>
            ) : (
                /* Desktop Layout */
                <View style={styles.splitPane}>
                    <View style={styles.leftPane}>
                        <TextInput style={styles.searchInput} placeholder="Search by name or ID..." value={searchQuery} onChangeText={setSearchQuery} />
                        <ScrollView>
                            {/* Desktop list */}
                            {classes.map((cls) => {
                                const classStudents = filteredStudents.filter(s => s.classId === cls.id);
                                if (classStudents.length === 0) return null;
                                return (
                                    <View key={cls.id} style={styles.classSection}>
                                        <Text style={styles.classHeader}>{cls.name}</Text>
                                        {classStudents.map((student) => (
                                            <TouchableOpacity
                                                key={student.id}
                                                style={[
                                                    styles.studentItem,
                                                    selectedStudent?.id === student.id && styles.studentItemSelected,
                                                ]}
                                                onPress={() => handleSelectStudent(student)}
                                            >
                                                <Text style={styles.studentName}>{student.name}</Text>
                                                <Text style={styles.studentId}>ID: {student.id}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <View style={styles.rightPane}>
                        {selectedStudent ? (
                            <ScrollView>
                                <DetailsContent />
                            </ScrollView>
                        ) : (
                            <View style={styles.emptyDetails}>
                                <Ionicons name="person-outline" size={80} color="#555" />
                                <Text style={styles.emptyDetailsText}>Select a student to view details</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* Edit Modal */}
            <Modal visible={isEditModalVisible} animationType={isMobile ? "slide" : "fade"} transparent>
                <View style={isMobile ? styles.fullScreenModalOverlay : styles.modalOverlay}>
                    <View style={isMobile ? styles.fullScreenModalContent : styles.modalContent}>
                        {isMobile && <View style={styles.sheetHandle} />}
                        <Text style={styles.modalTitle}>Edit Student</Text>

                        <Text style={styles.label}>Name</Text>
                        <TextInput style={styles.input} value={editForm.name} onChangeText={(t) => setEditForm({ ...editForm, name: t })} />

                        <Text style={styles.label}>Grade</Text>
                        <TextInput style={styles.input} value={editForm.grade} onChangeText={(t) => setEditForm({ ...editForm, grade: t })} />

                        <Text style={styles.label}>Class</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={editForm.classId} onValueChange={(v) => setEditForm({ ...editForm, classId: v })}>
                                <Picker.Item label="Unassigned" value="" />
                                {classes.map((c) => (
                                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                                ))}
                            </Picker>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsEditModalVisible(false)}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveEdit}>
                                <Text style={styles.modalButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// Styles (only mobile-specific + fixes)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1E1E1E', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2D2D2D' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#F1F1F1', marginBottom: 16 },
    searchInput: { backgroundColor: '#121212', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 14, color: '#FFF', fontSize: 16 },
    splitPane: { flexDirection: 'row', gap: 16, flex: 1 },
    leftPane: { flex: 1 },
    rightPane: { flex: 1, backgroundColor: '#121212', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#2D2D2D' },

    // Mobile
    mobileSearchContainer: { backgroundColor: '#1E1E1E', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
    mobileStudentItem: {
        backgroundColor: '#121212',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2D2D2D',
        minHeight: 72,
    },
    mobileStudentItemSelected: { borderColor: '#3A86FF', backgroundColor: '#1a2a4a' },
    mobileStudentName: { color: '#F1F1F1', fontSize: 18, fontWeight: '600' },
    mobileStudentId: { color: '#BBB', fontSize: 14, marginTop: 2 },

    // Bottom Sheet
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    bottomSheet: { height: height * 0.92, backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    sheetHandle: { width: 40, height: 5, backgroundColor: '#555', borderRadius: 3, alignSelf: 'center', marginVertical: 10 },

    // Calendar & List
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 16 },
    calendarDay: { width: '13%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#2D2D2D' },
    calendarDayText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
    todayHighlight: { borderWidth: 2, borderColor: '#3A86FF' },
    listDayItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#333' },
    listDayText: { color: '#F1F1F1', fontSize: 16 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    listStatusText: { fontSize: 15, fontWeight: '600' },

    // Modals
    fullScreenModalOverlay: { flex: 1, backgroundColor: '#1E1E1E', justifyContent: 'flex-end' },
    fullScreenModalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: height * 0.9 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#333' },

    // Additional styles that were missing
    detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    detailsName: { fontSize: 24, fontWeight: 'bold', color: '#F1F1F1', marginBottom: 4 },
    detailsInfo: { fontSize: 16, color: '#BBB', marginBottom: 2 },
    editButton: { backgroundColor: '#3A86FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    editButtonText: { color: '#FFF', fontWeight: '600', marginLeft: 8 },
    summarySection: { marginBottom: 30 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#F1F1F1', marginBottom: 16 },
    chartContainer: { paddingHorizontal: 8 },
    chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    chartLabel: { width: 70, fontSize: 14, fontWeight: '600' },
    chartBarContainer: { flex: 1, height: 20, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden', marginHorizontal: 10 },
    chartBar: { height: '100%' },
    chartValue: { width: 80, fontSize: 14, color: '#F1F1F1', textAlign: 'right' },
    calendarSection: { marginBottom: 30 },
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    calendarHeaderDay: { width: '13%', textAlign: 'center', color: '#BBB', fontWeight: '600' },
    legend: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
    legendText: { color: '#F1F1F1', fontSize: 14 },
    classSection: { marginBottom: 20 },
    classHeader: { fontSize: 18, fontWeight: 'bold', color: '#F1F1F1', marginBottom: 10, paddingLeft: 8 },
    studentItem: {
        backgroundColor: '#121212',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    studentItemSelected: { borderColor: '#3A86FF', backgroundColor: '#1a2a4a' },
    studentName: { color: '#F1F1F1', fontSize: 16, fontWeight: '600' },
    studentId: { color: '#BBB', fontSize: 14, marginTop: 4 },
    emptyDetails: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    emptyDetailsText: { color: '#BBB', fontSize: 18, marginTop: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#F1F1F1', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 16, color: '#F1F1F1', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: '#121212', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 12, color: '#FFF', fontSize: 16 },
    pickerContainer: { backgroundColor: '#121212', borderWidth: 1, borderColor: '#333', borderRadius: 8, overflow: 'hidden' },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
    modalButton: { flex: 1, padding: 16, borderRadius: 8, alignItems: 'center' },
    cancelButton: { backgroundColor: '#333', marginRight: 8 },
    saveButton: { backgroundColor: '#3A86FF', marginLeft: 8 },
    modalButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
});