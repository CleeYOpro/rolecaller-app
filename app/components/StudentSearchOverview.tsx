import type { Class, Student } from '@/constants/types';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
    classId,
    onStudentUpdate,
    refreshData,
}: StudentSearchOverviewProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', grade: '', classId: '' });

    // Filter students based on search query (name or ID)
    const filteredStudents = useMemo(() => {
        if (!searchQuery) return students;

        return students.filter(s =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.id.includes(searchQuery)
        );
    }, [students, searchQuery]);

    // Load attendance data for selected student
    const loadAttendance = async (student: Student) => {
        if (!student.classId) return;

        try {
            const data = await api.getAllAttendance(student.classId);
            // Flatten to { date: status } for this student
            const studentAttendance: Record<string, string> = {};
            Object.keys(data).forEach(date => {
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

    // Handle student selection
    const handleSelectStudent = (student: Student) => {
        setSelectedStudent(student);
        loadAttendance(student);
    };

    // Calculate attendance summary statistics
    const attendanceSummary = useMemo(() => {
        const summary = { present: 0, late: 0, absent: 0 };
        Object.values(attendanceData).forEach(status => {
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

    // Prepare edit form when editing a student
    const startEdit = () => {
        if (!selectedStudent) return;
        setEditForm({
            name: selectedStudent.name,
            grade: selectedStudent.grade || '',
            classId: selectedStudent.classId || classes[0]?.id || '',
        });
        setIsEditModalVisible(true);
    };

    // Save edited student data
    const saveEdit = async () => {
        if (!selectedStudent) return;

        try {
            await api.updateStudent({
                ...selectedStudent,
                name: editForm.name,
                grade: editForm.grade,
                classId: editForm.classId || undefined,
            });

            const updated = {
                ...selectedStudent,
                name: editForm.name,
                grade: editForm.grade,
                classId: editForm.classId || undefined,
            };

            setSelectedStudent(updated);
            onStudentUpdate(updated);
            setIsEditModalVisible(false);

            // Call refreshData if provided
            if (refreshData) {
                await refreshData();
            }

            Alert.alert('Success', 'Student updated successfully');
        } catch (err) {
            Alert.alert('Error', 'Failed to update student');
        }
    };

    // Generate calendar for current month
    const generateCalendar = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const calendar: (number | null)[] = [];
        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            calendar.push(null);
        }
        // Add days of month
        for (let day = 1; day <= daysInMonth; day++) {
            calendar.push(day);
        }

        return { calendar, year, month };
    };

    const { calendar, year, month } = generateCalendar();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Get attendance color for a specific day
    const getAttendanceColor = (day: number | null) => {
        if (!day) return 'transparent';
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const status = attendanceData[dateStr];
        if (status === 'present') return '#4CAF50'; // Green
        if (status === 'late') return '#ED6C02';    // Orange
        if (status === 'absent') return '#D32F2F';  // Red
        return 'transparent';
    };

    // Load attendance when selected student changes
    useEffect(() => {
        if (selectedStudent) {
            loadAttendance(selectedStudent);
        }
    }, [selectedStudent]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Student Search & Attendance Overview</Text>

            <View style={styles.splitPane}>
                {/* Left: Search & List */}
                <View style={styles.leftPane}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or ID..."
                        placeholderTextColor="#888"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />

                    <ScrollView style={styles.studentList}>
                        {classes.map(cls => {
                            const classStudents = filteredStudents.filter(s => s.classId === cls.id);
                            if (classStudents.length === 0) return null;

                            return (
                                <View key={cls.id} style={styles.classSection}>
                                    <Text style={styles.classHeader}>{cls.name}</Text>
                                    {classStudents.map(student => (
                                        <TouchableOpacity
                                            key={student.id}
                                            style={[
                                                styles.studentItem,
                                                selectedStudent?.id === student.id && styles.studentItemSelected
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

                        {/* Handle students with no class assigned */}
                        {(() => {
                            const unassignedStudents = filteredStudents.filter(s => !s.classId || !classes.find(c => c.id === s.classId));
                            if (unassignedStudents.length === 0) return null;

                            return (
                                <View style={styles.classSection}>
                                    <Text style={styles.classHeader}>Unassigned</Text>
                                    {unassignedStudents.map(student => (
                                        <TouchableOpacity
                                            key={student.id}
                                            style={[
                                                styles.studentItem,
                                                selectedStudent?.id === student.id && styles.studentItemSelected
                                            ]}
                                            onPress={() => handleSelectStudent(student)}
                                        >
                                            <Text style={styles.studentName}>{student.name}</Text>
                                            <Text style={styles.studentId}>ID: {student.id}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            );
                        })()}

                        {filteredStudents.length === 0 && searchQuery ? (
                            <Text style={styles.emptyText}>No students found</Text>
                        ) : filteredStudents.length === 0 && !searchQuery ? (
                            <Text style={styles.emptyText}>No students available</Text>
                        ) : null}
                    </ScrollView>
                </View>

                {/* Right: Details & Stats */}
                <View style={styles.rightPane}>
                    {selectedStudent ? (
                        <ScrollView>
                            <View style={styles.detailsHeader}>
                                <View>
                                    <Text style={styles.detailsName}>{selectedStudent.name}</Text>
                                    <Text style={styles.detailsInfo}>
                                        ID: {selectedStudent.id} • Grade: {selectedStudent.grade || 'N/A'}
                                    </Text>
                                    <Text style={styles.detailsInfo}>
                                        Class: {classes.find(c => c.id === selectedStudent.classId)?.name || 'Unassigned'}
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
                                    <View style={styles.chartRow}>
                                        <Text style={[styles.chartLabel, { color: '#4CAF50' }]}>Present</Text>
                                        <View style={styles.chartBarContainer}>
                                            <View
                                                style={[
                                                    styles.chartBar,
                                                    {
                                                        width: `${attendanceSummary.presentPercent}%`,
                                                        backgroundColor: '#4CAF50',
                                                        maxWidth: '100%'
                                                    }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.chartValue}>{attendanceSummary.presentPercent}% ({attendanceSummary.present})</Text>
                                    </View>

                                    <View style={styles.chartRow}>
                                        <Text style={[styles.chartLabel, { color: '#FFC107' }]}>Late</Text>
                                        <View style={styles.chartBarContainer}>
                                            <View
                                                style={[
                                                    styles.chartBar,
                                                    {
                                                        width: `${attendanceSummary.latePercent}%`,
                                                        backgroundColor: '#FFC107',
                                                        maxWidth: '100%'
                                                    }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.chartValue}>{attendanceSummary.latePercent}% ({attendanceSummary.late})</Text>
                                    </View>

                                    <View style={styles.chartRow}>
                                        <Text style={[styles.chartLabel, { color: '#F44336' }]}>Absent</Text>
                                        <View style={styles.chartBarContainer}>
                                            <View
                                                style={[
                                                    styles.chartBar,
                                                    {
                                                        width: `${attendanceSummary.absentPercent}%`,
                                                        backgroundColor: '#F44336',
                                                        maxWidth: '100%'
                                                    }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.chartValue}>{attendanceSummary.absentPercent}% ({attendanceSummary.absent})</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.calendarSection}>
                                <Text style={styles.sectionTitle}>{monthNames[month]} {year}</Text>
                                <View style={styles.calendarHeader}>
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                                        <Text key={index} style={styles.calendarHeaderDay}>{day}</Text>
                                    ))}
                                </View>
                                <View style={styles.calendar}>
                                    {calendar.map((day, idx) => (
                                        <View key={idx} style={[styles.calendarDay, { backgroundColor: getAttendanceColor(day) }]}>
                                            <Text style={styles.calendarDayText}>{day || ''}</Text>
                                        </View>
                                    ))}
                                </View>
                                <View style={styles.legend}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                                        <Text style={styles.legendText}>Present</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#FFC107' }]} />
                                        <Text style={styles.legendText}>Late</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                                        <Text style={styles.legendText}>Absent</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555' }]} />
                                        <Text style={styles.legendText}>No Data</Text>
                                    </View>
                                </View>
                            </View>
                        </ScrollView>
                    ) : (
                        <View style={styles.emptyDetails}>
                            <Ionicons name="person-outline" size={64} color="#555" />
                            <Text style={styles.emptyDetailsText}>Select a student to view details</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Edit Student Modal */}
            <Modal
                visible={isEditModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Student</Text>

                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={styles.input}
                            value={editForm.name}
                            onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                            placeholder="Student name"
                            placeholderTextColor="#888"
                        />

                        <Text style={styles.label}>Grade</Text>
                        <TextInput
                            style={styles.input}
                            value={editForm.grade}
                            onChangeText={(text) => setEditForm({ ...editForm, grade: text })}
                            placeholder="Grade (optional)"
                            placeholderTextColor="#888"
                        />

                        <Text style={styles.label}>Class</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={editForm.classId}
                                style={styles.picker}
                                onValueChange={(itemValue) => setEditForm({ ...editForm, classId: itemValue })}
                                dropdownIconColor="#888"
                            >
                                <Picker.Item label="Select Class" value="" color="#888" />
                                {classes.map((cls) => (
                                    <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
                                ))}
                            </Picker>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setIsEditModalVisible(false)}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={saveEdit}
                            >
                                <Text style={styles.modalButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// Need to import Picker for the modal
import { Picker } from '@react-native-picker/picker';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#F1F1F1',
        marginBottom: 16,
    },
    splitPane: {
        flexDirection: 'row',
        gap: 16,
        minHeight: 500,
        flex: 1,
    },
    leftPane: {
        flex: 1,
    },
    rightPane: {
        flex: 1,
        backgroundColor: '#121212',
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    searchInput: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 12,
        color: '#FFF',
        marginBottom: 12,
    },
    studentList: {
        flex: 1,
    },
    classSection: {
        marginBottom: 16,
    },
    classHeader: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    studentItem: {
        backgroundColor: '#121212',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    studentItemSelected: {
        borderColor: '#3A86FF',
        backgroundColor: '#1a2a4a',
    },
    studentName: {
        color: '#F1F1F1',
        fontSize: 16,
        fontWeight: '600',
    },
    studentId: {
        color: '#BBB',
        fontSize: 14,
        marginTop: 2,
    },
    studentClass: {
        color: '#888',
        fontSize: 14,
        marginTop: 2,
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    },
    detailsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2D2D2D',
    },
    detailsName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#F1F1F1',
    },
    detailsInfo: {
        fontSize: 14,
        color: '#EAEAEA',
        marginTop: 4,
    },
    editButton: {
        backgroundColor: '#3A86FF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    editButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    summarySection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F1F1F1',
        marginBottom: 16,
    },
    chartContainer: {
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    chartRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    chartLabel: {
        width: 60,
        fontWeight: 'bold',
        fontSize: 14,
    },
    chartBarContainer: {
        flex: 1,
        height: 24,
        backgroundColor: '#2D2D2D',
        borderRadius: 4,
        overflow: 'hidden',
        maxWidth: '100%',
    },
    chartBar: {
        height: '100%',
        borderRadius: 4,
    },
    chartValue: {
        width: 80,
        textAlign: 'right',
        color: '#F1F1F1',
        fontSize: 14,
        fontWeight: 'bold',
    },
    calendarSection: {
        marginBottom: 16,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 8,
    },
    calendarHeaderDay: {
        color: '#888',
        fontWeight: 'bold',
        width: '13%',
        textAlign: 'center',
    },
    calendar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    calendarDay: {
        width: '13%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    calendarDayText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
        marginTop: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    legendText: {
        color: '#EAEAEA',
        fontSize: 12,
    },
    emptyDetails: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyDetailsText: {
        color: '#888',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 20,
        textAlign: 'center',
    },
    label: {
        color: '#AAA',
        marginBottom: 4,
        fontSize: 12,
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 12,
        color: '#FFF',
        marginBottom: 16,
    },
    pickerContainer: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        marginBottom: 16,
        justifyContent: 'center',
    },
    picker: {
        color: '#FFF',
        height: 50,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#333',
    },
    saveButton: {
        backgroundColor: '#3A86FF',
    },
    modalButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
});