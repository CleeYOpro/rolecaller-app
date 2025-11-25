import { AttendanceMap, AttendanceStatus, Class, Student } from '@/constants/types';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import StudentSearchOverview from './components/StudentSearchOverview';

export default function Admin() {
    const router = useRouter();
    const [classId, setClassId] = useState<string | null>(null);
    const [selectedClass, setSelectedClass] = useState<Class | null>(null);
    const [classes, setClasses] = useState<Class[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<AttendanceMap>({});

    const [activeTab, setActiveTab] = useState<'view' | 'manage'>('view');
    const [manageSubTab, setManageSubTab] = useState<'classes' | 'students'>('classes');
    const today = new Date().toISOString().slice(0, 10);

    // Class management state
    const [newClassName, setNewClassName] = useState("");

    // Student management state
    const [studentName, setStudentName] = useState("");
    const [studentId, setStudentId] = useState("");
    const [studentGrade, setStudentGrade] = useState("");
    const [studentClass, setStudentClass] = useState("");

    // CSV upload state
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<string | null>(null);

    // Inline editing state
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{
        name: string;
        grade: string;
        classId: string;
    }>({ name: "", grade: "", classId: "" });

    // Fetch data
    const refreshData = async () => {
        try {
            let currentClassId = classId;
            let currentClass: Class | null = selectedClass;

            if (!currentClassId || !currentClass) {
                const schools = await api.getSchools();
                console.log("Fetched schools:", schools);
                if (schools.length > 0) {
                    const schoolId = schools[0].id;
                    const cls = await api.getClasses(schoolId);
                    setClasses(cls);
                    if (cls.length > 0) {
                        currentClass = cls[0];
                        currentClassId = cls[0].id;
                        setClassId(currentClassId);
                        setSelectedClass(currentClass);
                    } else {
                        console.warn("No classes found");
                        Alert.alert(
                            "No Classes Found",
                            "No classes are available. Please create a class first.",
                            [{ text: "OK" }]
                        );
                        return;
                    }
                } else {
                    console.warn("No schools found");
                    Alert.alert(
                        "No Schools Found",
                        "No schools are available. Please make sure the API server is running and the database has been seeded.",
                        [{ text: "OK" }]
                    );
                    return;
                }
            }

            if (!currentClassId || !currentClass) return;

            // Use classId's schoolId for student queries
            const studs = await api.getStudents(currentClass.schoolId, currentClassId);
            setStudents(studs);

            const attMap: AttendanceMap = {};
            for (const c of classes) {
                const att = await api.getAllAttendance(c.id);
                attMap[c.id] = att;
            }
            setAttendance(attMap);
        } catch (err) {
            console.error("Failed to fetch admin data", err);
            Alert.alert(
                "Connection Error",
                `Failed to connect to the server. Please make sure the API server is running.\n\nError: ${err instanceof Error ? err.message : String(err)}`,
                [{ text: "OK" }]
            );
        }
    };

    React.useEffect(() => {
        refreshData();
    }, []); // Run once on mount, refreshData handles the rest

    // Daily attendance summary
    const dailyAttendanceSummary = React.useMemo(() => {
        const summary: Record<AttendanceStatus, number> = {
            present: 0,
            absent: 0,
            late: 0,
        };
        classes.forEach((cls) => {
            const map = attendance[cls.id]?.[today] ?? {};
            Object.values(map).forEach((status) => {
                if (status === "present" || status === "absent" || status === "late") {
                    summary[status] += 1;
                }
            });
        });
        return summary;
    }, [attendance, classes, today]);

    const handleSignOut = () => {
        router.replace('/');
    };

    const addClass = async () => {
        const name = newClassName.trim();
        if (!name) return;

        try {
            const schools = await api.getSchools();
            if (schools.length === 0) {
                Alert.alert("Error", "No school found");
                return;
            }
            // Get schoolId from selected class, or use first school
            const schoolId = selectedClass?.schoolId || schools[0].id;
            await api.addClass(name, schoolId);
            setNewClassName("");
            Alert.alert("Success", "Class added successfully");
            refreshData();
        } catch (err) {
            Alert.alert("Error", "Failed to add class");
        }
    };

    const deleteClass = (classId: string) => {
        console.log("Attempting to delete class:", classId);
        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete this class?")) {
                (async () => {
                    try {
                        console.log("Confirm delete class:", classId);
                        await api.deleteClass(classId);
                        console.log("Class deleted successfully");
                        refreshData();
                    } catch (err) {
                        console.error("Failed to delete class:", err);
                        alert("Failed to delete class");
                    }
                })();
            }
            return;
        }

        Alert.alert(
            "Delete Class",
            "Are you sure you want to delete this class?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            console.log("Confirm delete class:", classId);
                            await api.deleteClass(classId);
                            console.log("Class deleted successfully");
                            refreshData();
                        } catch (err) {
                            console.error("Failed to delete class:", err);
                            Alert.alert("Error", "Failed to delete class");
                        }
                    }
                }
            ]
        );
    };

    const addStudent = async () => {
        const name = studentName.trim();
        const id = studentId.trim();
        const grade = studentGrade.trim();

        if (!name || !id) {
            Alert.alert("Error", "Name and ID are required");
            return;
        }

        const cls = classes.find(c => c.name === studentClass);
        const classId = cls?.id;

        try {
            if (!classId || !selectedClass) return;
            await api.addStudent({
                id,
                name,
                grade,
                classId,
                schoolId: selectedClass.schoolId,
            });

            setStudentName("");
            setStudentId("");
            setStudentGrade("");
            setStudentClass("");
            Alert.alert("Success", "Student added successfully");
            refreshData();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to add student");
        }
    };

    const deleteStudent = (sid: string) => {
        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete this student?")) {
                (async () => {
                    try {
                        await api.deleteStudent(sid);
                        refreshData();
                    } catch (err) {
                        alert("Failed to delete student");
                    }
                })();
            }
            return;
        }

        Alert.alert(
            "Delete Student",
            "Are you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.deleteStudent(sid);
                            refreshData();
                        } catch (err) {
                            Alert.alert("Error", "Failed to delete student");
                        }
                    }
                }
            ]
        );
    };
    const handleUploadCSV = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'application/vnd.ms-excel', 'text/comma-separated-values', '*/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            setUploading(true);
            setUploadMessage(null);

            const file = result.assets[0];
            const content = await fetch(file.uri).then(r => r.text());

            const lines = content.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            if (!selectedClass) {
                setUploadMessage("❌ No class selected");
                setUploading(false);
                return;
            }

            const studentsToUpload = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const values = line.split(',').map(v => v.trim());
                if (values.length < 2) continue;

                const student: any = { schoolId: selectedClass.schoolId };
                headers.forEach((h, idx) => {
                    if (values[idx]) {
                        if (h === 'number') {
                            student.id = values[idx];
                        } else {
                            student[h] = values[idx];
                        }
                    }
                });

                if (student.name && student.id) {
                    studentsToUpload.push(student);
                }
            }

            if (studentsToUpload.length > 0) {
                await api.uploadStudents(studentsToUpload);
                setUploadMessage(`✅ Success! Uploaded ${studentsToUpload.length} students`);
                refreshData();
            } else {
                setUploadMessage("❌ No valid students found in CSV");
            }

        } catch (err) {
            console.error("CSV Upload Error", err);
            setUploadMessage("❌ Failed to upload CSV file");
        } finally {
            setUploading(false);
        }
    };

    const startEdit = (student: Student) => {
        setEditingStudentId(student.id);
        setEditForm({
            name: student.name,
            grade: student.grade || "",
            classId: student.classId || "",
        });
    };

    const cancelEdit = () => {
        setEditingStudentId(null);
        setEditForm({ name: "", grade: "", classId: "" });
    };

    const saveEdit = async (studentId: string) => {
        try {
            if (!classId || !selectedClass) return;
            await api.updateStudent({
                id: studentId,
                name: editForm.name,
                grade: editForm.grade,
                classId: editForm.classId || undefined,
                schoolId: selectedClass.schoolId,
            });

            refreshData();
            cancelEdit();
            Alert.alert("Success", "Student updated successfully");
        } catch (err) {
            Alert.alert("Error", "Failed to update student");
        }
    };

    if (!classId) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color="#3A86FF" style={{ marginTop: 100 }} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <View style={styles.mainWrapper}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Admin Dashboard</Text>
                        <Text style={styles.headerSubtitle}>
                            {selectedClass ? `Class: ${selectedClass.name} (ID: ${selectedClass.id})` : 'Manage classes, students, and attendance'}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'view' && styles.activeTab]}
                        onPress={() => setActiveTab('view')}
                    >
                        <Text style={[styles.tabText, activeTab === 'view' && styles.activeTabText]}>View Records</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'manage' && styles.activeTab]}
                        onPress={() => setActiveTab('manage')}
                    >
                        <Text style={[styles.tabText, activeTab === 'manage' && styles.activeTabText]}>Manage</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                    {activeTab === 'view' && (
                        <View style={styles.section}>
                            {/* Summary Cards */}
                            <Text style={styles.sectionTitle}>Today&apos;s Attendance Summary</Text>
                            <View style={styles.statsGrid}>
                                <View style={styles.statCard}>
                                    <Text style={[styles.statValue, { color: '#4CAF50' }]}>{dailyAttendanceSummary.present}</Text>
                                    <Text style={styles.statLabel}>Present</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={[styles.statValue, { color: '#ED6C02' }]}>{dailyAttendanceSummary.late}</Text>
                                    <Text style={styles.statLabel}>Late</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={[styles.statValue, { color: '#D32F2F' }]}>{dailyAttendanceSummary.absent}</Text>
                                    <Text style={styles.statLabel}>Absent</Text>
                                </View>
                            </View>

                            {/* Student Search & Attendance Overview */}
                            <StudentSearchOverview
                                students={students}
                                classes={classes}
                                classId={classId || ''}
                                onStudentUpdate={(updatedStudent) => {
                                    setStudents((prev) => prev.map((s) => s.id === updatedStudent.id ? updatedStudent : s));
                                }}
                            />
                        </View>
                    )}

                    {activeTab === 'manage' && (
                        <View style={styles.section}>
                            <View style={styles.subTabContainer}>
                                <TouchableOpacity
                                    style={[styles.subTab, manageSubTab === 'classes' && styles.activeSubTab]}
                                    onPress={() => setManageSubTab('classes')}
                                >
                                    <Text style={styles.subTabText}>Manage Classes</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.subTab, manageSubTab === 'students' && styles.activeSubTab]}
                                    onPress={() => setManageSubTab('students')}
                                >
                                    <Text style={styles.subTabText}>Manage Students</Text>
                                </TouchableOpacity>
                            </View>

                            {manageSubTab === 'classes' ? (
                                <View>
                                    <View style={styles.formCard}>
                                        <Text style={styles.formTitle}>Add New Class</Text>
                                        <View style={styles.row}>
                                            <TextInput
                                                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                                placeholder="Class name (e.g., Grade 5A)"
                                                placeholderTextColor="#888"
                                                value={newClassName}
                                                onChangeText={setNewClassName}
                                            />
                                            <TouchableOpacity style={styles.addButton} onPress={addClass}>
                                                <Text style={styles.addButtonText}>Add Class</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.listContainer}>
                                        {classes.map(cls => (
                                            <View key={cls.id} style={styles.listItem}>
                                                <View>
                                                    <Text style={styles.listItemTitle}>{cls.name}</Text>
                                                    <Text style={styles.listItemSubtitle}>{students.filter(s => s.classId === cls.id).length} students</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => deleteClass(cls.id)}>
                                                    <Ionicons name="trash-outline" size={20} color="#D32F2F" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ) : (
                                <View>
                                    {/* CSV Upload Section */}
                                    <View style={styles.formCard}>
                                        <Text style={styles.formTitle}>Upload Students via CSV</Text>
                                        <Text style={styles.helperText}>
                                            CSV must contain columns: name, number (5 digits), grade, class
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.uploadButton}
                                            onPress={handleUploadCSV}
                                            disabled={uploading}
                                        >
                                            {uploading ? (
                                                <ActivityIndicator color="#FFF" />
                                            ) : (
                                                <>
                                                    <Ionicons name="cloud-upload-outline" size={24} color="#FFF" style={{ marginRight: 8 }} />
                                                    <Text style={styles.addButtonText}>Upload CSV</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                        {uploadMessage && (
                                            <View style={[styles.uploadMessageContainer, uploadMessage.startsWith('✅') ? styles.successMessage : styles.errorMessage]}>
                                                <Text style={styles.uploadMessageText}>{uploadMessage}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Add Student Form */}
                                    <View style={styles.formCard}>
                                        <Text style={styles.formTitle}>Add New Student</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Student name"
                                            placeholderTextColor="#888"
                                            value={studentName}
                                            onChangeText={setStudentName}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="5-digit ID"
                                            placeholderTextColor="#888"
                                            value={studentId}
                                            onChangeText={setStudentId}
                                            keyboardType="numeric"
                                            maxLength={5}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Grade (optional)"
                                            placeholderTextColor="#888"
                                            value={studentGrade}
                                            onChangeText={setStudentGrade}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Class name (optional)"
                                            placeholderTextColor="#888"
                                            value={studentClass}
                                            onChangeText={setStudentClass}
                                        />
                                        <TouchableOpacity style={styles.addButtonFull} onPress={addStudent}>
                                            <Text style={styles.addButtonText}>Add Student</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Editable Students Table */}
                                    <View style={styles.tableContainer}>
                                        <Text style={styles.formTitle}>All Students ({students.length})</Text>
                                        <View style={styles.tableHeader}>
                                            <Text style={[styles.tableHeaderText, { flex: 1 }]}>ID</Text>
                                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
                                            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Grade</Text>
                                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Class</Text>
                                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Actions</Text>
                                        </View>
                                        {students.map((student) => {
                                            const isEditing = editingStudentId === student.id;
                                            const studentClass = classes.find(c => c.id === student.classId);

                                            return (
                                                <View key={student.id} style={styles.tableRow}>
                                                    <Text style={[styles.tableCell, { flex: 1 }]}>{student.id}</Text>
                                                    <View style={{ flex: 2 }}>
                                                        {isEditing ? (
                                                            <TextInput
                                                                style={styles.tableInput}
                                                                value={editForm.name}
                                                                onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                                                            />
                                                        ) : (
                                                            <Text style={styles.tableCell}>{student.name}</Text>
                                                        )}
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        {isEditing ? (
                                                            <TextInput
                                                                style={styles.tableInput}
                                                                value={editForm.grade}
                                                                onChangeText={(text) => setEditForm({ ...editForm, grade: text })}
                                                            />
                                                        ) : (
                                                            <Text style={styles.tableCell}>{student.grade || '-'}</Text>
                                                        )}
                                                    </View>
                                                    <View style={{ flex: 2 }}>
                                                        {isEditing ? (
                                                            <View style={styles.pickerContainer}>
                                                                <Picker
                                                                    selectedValue={editForm.classId}
                                                                    onValueChange={(itemValue) => setEditForm({ ...editForm, classId: itemValue })}
                                                                    style={styles.picker}
                                                                >
                                                                    <Picker.Item label="Select Class" value="" />
                                                                    {classes.map((cls) => (
                                                                        <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
                                                                    ))}
                                                                </Picker>
                                                            </View>
                                                        ) : (
                                                            <Text style={styles.tableCell}>{studentClass?.name || 'Unassigned'}</Text>
                                                        )}
                                                    </View>
                                                    <View style={[styles.actionButtons, { flex: 2 }]}>
                                                        {isEditing ? (
                                                            <>
                                                                <TouchableOpacity
                                                                    style={styles.saveButton}
                                                                    onPress={() => saveEdit(student.id)}
                                                                >
                                                                    <Text style={styles.buttonText}>Save</Text>
                                                                </TouchableOpacity>
                                                                <TouchableOpacity
                                                                    style={styles.cancelButton}
                                                                    onPress={cancelEdit}
                                                                >
                                                                    <Text style={styles.buttonText}>Cancel</Text>
                                                                </TouchableOpacity>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <TouchableOpacity
                                                                    style={styles.editButton}
                                                                    onPress={() => startEdit(student)}
                                                                >
                                                                    <Text style={styles.buttonText}>Edit</Text>
                                                                </TouchableOpacity>
                                                                <TouchableOpacity
                                                                    style={styles.deleteButton}
                                                                    onPress={() => deleteStudent(student.id)}
                                                                >
                                                                    <Text style={styles.buttonText}>Delete</Text>
                                                                </TouchableOpacity>
                                                            </>
                                                        )}
                                                    </View>
                                                </View>
                                            );
                                        })}
                                        {students.length === 0 && (
                                            <Text style={styles.emptyText}>
                                                No students found. Add students manually or upload a CSV file.
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        paddingTop: 50,
    },
    mainWrapper: {
        flex: 1,
        width: '100%',
        maxWidth: 1200,
        alignSelf: 'center',
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
    signOutButton: {
        backgroundColor: '#1E1E1E',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    signOutText: {
        color: '#EAEAEA',
        fontWeight: '600',
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: '#2D2D2D',
        alignItems: 'center',
    },
    activeTab: {
        backgroundColor: '#3A86FF',
        borderColor: '#3A86FF',
    },
    tabText: {
        color: '#888',
        fontWeight: '600',
    },
    activeTabText: {
        color: '#FFF',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F1F1F1',
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2D2D2D',
        alignItems: 'center',
    },
    statValue: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statLabel: {
        color: '#888',
        fontSize: 12,
    },
    subTabContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    subTab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: '#2D2D2D',
        alignItems: 'center',
    },
    activeSubTab: {
        backgroundColor: '#2D2D2D',
        borderColor: '#3A86FF',
    },
    subTabText: {
        color: '#EAEAEA',
        fontWeight: '600',
    },
    formCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2D2D2D',
        marginBottom: 16,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#F1F1F1',
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    input: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#2D2D2D',
        borderRadius: 8,
        padding: 12,
        color: '#EAEAEA',
        marginBottom: 12,
    },
    addButton: {
        backgroundColor: '#3A86FF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
    },
    addButtonFull: {
        backgroundColor: '#3A86FF',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    addButtonText: {
        color: '#FFF',
        fontWeight: '600',
    },
    listContainer: {
        gap: 8,
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#121212',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    listItemTitle: {
        color: '#EAEAEA',
        fontWeight: '600',
        fontSize: 16,
    },
    listItemSubtitle: {
        color: '#888',
        fontSize: 12,
    },
    helperText: {
        color: '#888',
        fontSize: 12,
        marginBottom: 12,
    },
    uploadButton: {
        backgroundColor: '#3A86FF',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    uploadMessageContainer: {
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
    },
    successMessage: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    errorMessage: {
        backgroundColor: 'rgba(211, 47, 47, 0.1)',
        borderWidth: 1,
        borderColor: '#D32F2F',
    },
    uploadMessageText: {
        color: '#EAEAEA',
    },
    tableContainer: {
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#2D2D2D',
        paddingBottom: 8,
        marginBottom: 8,
    },
    tableHeaderText: {
        color: '#888',
        fontWeight: 'bold',
        fontSize: 12,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2D2D2D',
        alignItems: 'center',
    },
    tableCell: {
        color: '#EAEAEA',
        fontSize: 14,
    },
    tableInput: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#3A86FF',
        borderRadius: 6,
        padding: 8,
        color: '#EAEAEA',
        fontSize: 14,
    },
    pickerContainer: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#3A86FF',
        borderRadius: 6,
        height: 40,
        justifyContent: 'center',
    },
    picker: {
        color: '#EAEAEA',
        height: 40,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    editButton: {
        backgroundColor: '#3A86FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    deleteButton: {
        backgroundColor: '#D32F2F',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    saveButton: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    cancelButton: {
        backgroundColor: '#888',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        padding: 20,
    },
});

