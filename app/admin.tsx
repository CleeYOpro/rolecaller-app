import { AttendanceMap, AttendanceStatus, Class, Student } from '@/constants/types';
import { api } from '@/services/api';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import StudentSearchOverview from './components/StudentSearchOverview';

export default function Admin() {
    const router = useRouter();
    const [classId, setClassId] = useState<string | null>(null);
    const [selectedClass, setSelectedClass] = useState<Class | null>(null);
    const [classes, setClasses] = useState<Class[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<AttendanceMap>({});
    const [schoolName, setSchoolName] = useState<string>("");

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
                    setSchoolName(schools[0].name);
                    const cls = await api.getClasses(schoolId);
                    setClasses(cls);
                    if (cls.length > 0) {
                        currentClass = cls[0];
                        currentClassId = cls[0].id;
                        setClassId(currentClassId);
                        setSelectedClass(currentClass);
                    } else {
                        // Instead of showing an alert and returning, we'll just set empty classes
                        // This allows the admin to access the portal and create classes
                        console.warn("No classes found");
                        setClassId(null);
                        setSelectedClass(null);
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

            // Only fetch students and attendance if we have a valid class
            if (currentClassId && currentClass) {
                // Use classId's schoolId for student queries
                // FETCH ALL STUDENTS for the school, not just for one class
                const studs = await api.getStudents(currentClass.schoolId);
                setStudents(studs);

                // Get attendance for all classes (including any new ones)
                const attMap: AttendanceMap = {};
                for (const c of classes) {
                    const att = await api.getAllAttendance(c.id);
                    attMap[c.id] = att;
                }
                setAttendance(attMap);
            }
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

        const cls = classes.find(c => c.id === studentClass);
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
            const classNames = new Set<string>(); // To track unique class names from CSV

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const values = line.split(',').map(v => v.trim());
                if (values.length < 2) continue;

                const student: any = {
                    schoolId: selectedClass.schoolId,
                };

                headers.forEach((h, idx) => {
                    if (values[idx]) {
                        if (h === 'number') {
                            student.id = values[idx];
                        } else {
                            student[h] = values[idx];
                        }
                    }
                });

                // Track class names for automatic creation
                if (student.class) {
                    classNames.add(student.class);
                }

                if (student.name && student.id) {
                    studentsToUpload.push(student);
                }
            }

            if (studentsToUpload.length > 0) {
                // Create a mapping of class names to class IDs
                const classMapping: Record<string, string> = {};

                // Create classes that don't exist yet
                for (const className of Array.from(classNames)) {
                    const existingClass = classes.find(c => c.name.toLowerCase() === className.toLowerCase());
                    if (existingClass) {
                        classMapping[className] = existingClass.id;
                    } else {
                        // Create new class
                        try {
                            const newClass = await api.addClass(className, selectedClass.schoolId);
                            classMapping[className] = newClass.id;
                        } catch (err) {
                            console.error(`Failed to create class: ${className}`, err);
                        }
                    }
                }

                // Assign class IDs to students
                for (const student of studentsToUpload) {
                    if (student.class && classMapping[student.class]) {
                        student.classId = classMapping[student.class];
                    } else {
                        // Default to selected class if no class specified or creation failed
                        student.classId = selectedClass.id;
                    }
                }

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

    return (
        <View style={styles.container}>
            <View style={styles.mainWrapper}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Admin Dashboard</Text>
                        {schoolName ? <Text style={styles.headerSubtitle}>{schoolName}</Text> : null}
                    </View>
                    <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'view' && styles.activeTab]}
                        onPress={() => setActiveTab('view')}
                    >
                        <Text style={[styles.tabText, activeTab === 'view' && styles.activeTabText]}>
                            View Attendance
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'manage' && styles.activeTab]}
                        onPress={() => setActiveTab('manage')}
                    >
                        <Text style={[styles.tabText, activeTab === 'manage' && styles.activeTabText]}>
                            Manage Data
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {activeTab === 'view' ? (
                        <StudentSearchOverview
                            students={students}
                            classes={classes}
                            classId={classId || ''}
                            onStudentUpdate={(updated) => {
                                setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
                            }}
                            refreshData={refreshData}
                        />
                    ) : (
                        <ScrollView>
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
                                <>
                                    <View style={styles.formCard}>
                                        <Text style={styles.formTitle}>Add New Class</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Class Name"
                                            placeholderTextColor="#888"
                                            value={newClassName}
                                            onChangeText={setNewClassName}
                                        />
                                        <TouchableOpacity style={styles.addButtonFull} onPress={addClass}>
                                            <Text style={styles.addButtonText}>Add Class</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>Existing Classes</Text>
                                        <View style={styles.listContainer}>
                                            {classes.map((cls) => (
                                                <View key={cls.id} style={styles.listItem}>
                                                    <View>
                                                        <Text style={styles.listItemTitle}>{cls.name}</Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={styles.deleteButton}
                                                        onPress={() => deleteClass(cls.id)}
                                                    >
                                                        <Text style={styles.buttonText}>Delete</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                            {classes.length === 0 && (
                                                <Text style={styles.emptyText}>No classes created yet</Text>
                                            )}
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <View style={styles.formCard}>
                                        <Text style={styles.formTitle}>Add New Student</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Student Name"
                                            placeholderTextColor="#888"
                                            value={studentName}
                                            onChangeText={setStudentName}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Student ID"
                                            placeholderTextColor="#888"
                                            value={studentId}
                                            onChangeText={setStudentId}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Grade (optional)"
                                            placeholderTextColor="#888"
                                            value={studentGrade}
                                            onChangeText={setStudentGrade}
                                        />
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={studentClass}
                                                style={styles.picker}
                                                onValueChange={(itemValue) => setStudentClass(itemValue)}
                                                dropdownIconColor="#888"
                                            >
                                                <Picker.Item label="Select Class" value="" color="#888" />
                                                {classes.map((cls) => (
                                                    <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
                                                ))}
                                            </Picker>
                                        </View>
                                        <TouchableOpacity style={styles.addButtonFull} onPress={addStudent}>
                                            <Text style={styles.addButtonText}>Add Student</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.formCard}>
                                        <Text style={styles.formTitle}>Upload Students from CSV</Text>
                                        <Text style={styles.helperText}>
                                            CSV format: name,number,class (class is optional)
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.uploadButton}
                                            onPress={handleUploadCSV}
                                            disabled={uploading}
                                        >
                                            <Text style={styles.addButtonText}>
                                                {uploading ? 'Uploading...' : 'Select CSV File'}
                                            </Text>
                                        </TouchableOpacity>
                                        {uploadMessage && (
                                            <View style={[
                                                styles.uploadMessageContainer,
                                                uploadMessage.includes('✅') ? styles.successMessage : styles.errorMessage
                                            ]}>
                                                <Text style={styles.uploadMessageText}>{uploadMessage}</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>Existing Students</Text>
                                        <View style={styles.tableContainer}>
                                            <View style={styles.tableHeader}>
                                                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Student</Text>
                                                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Class</Text>
                                                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Grade</Text>
                                                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Actions</Text>
                                            </View>
                                            {students.map((student) => (
                                                editingStudentId === student.id ? (
                                                    <View key={student.id} style={styles.tableRow}>
                                                        <TextInput
                                                            style={[styles.tableInput, { flex: 2 }]}
                                                            value={editForm.name}
                                                            onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                                                        />
                                                        <TextInput
                                                            style={[styles.tableInput, { flex: 1 }]}
                                                            value={editForm.grade}
                                                            onChangeText={(text) => setEditForm({ ...editForm, grade: text })}
                                                        />
                                                        <View style={[styles.actionButtons, { flex: 1, justifyContent: 'center' }]}>
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
                                                        </View>
                                                    </View>
                                                ) : (
                                                    <View key={student.id} style={styles.tableRow}>
                                                        <Text style={[styles.tableCell, { flex: 2 }]}>{student.name}</Text>
                                                        <Text style={[styles.tableCell, { flex: 1 }]}>
                                                            {classes.find(c => c.id === student.classId)?.name || '-'}
                                                        </Text>
                                                        <Text style={[styles.tableCell, { flex: 1 }]}>{student.grade || '-'}</Text>
                                                        <View style={[styles.actionButtons, { flex: 1, justifyContent: 'center' }]}>
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
                                                        </View>
                                                    </View>
                                                )
                                            ))}
                                            {students.length === 0 && (
                                                <Text style={styles.emptyText}>No students created yet</Text>
                                            )}
                                        </View>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    )}
                </View>
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
    deleteButton: {
        backgroundColor: '#F44336',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
    },
    buttonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 12,
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
        paddingBottom: 12,
        marginBottom: 12,
    },
    tableHeaderText: {
        color: '#888',
        fontWeight: 'bold',
        fontSize: 14,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2D2D2D',
    },
    tableCell: {
        color: '#EAEAEA',
        fontSize: 14,
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        padding: 20,
        fontStyle: 'italic',
    },
    pickerContainer: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#2D2D2D',
        borderRadius: 8,
        marginBottom: 12,
        justifyContent: 'center',
    },
    picker: {
        color: '#EAEAEA',
        height: 50,
    },
    helperText: {
        color: '#888',
        fontSize: 12,
        marginBottom: 12,
    },
    uploadButton: {
        backgroundColor: '#2D2D2D',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#3A86FF',
        borderStyle: 'dashed',
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
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        borderWidth: 1,
        borderColor: '#F44336',
    },
    uploadMessageText: {
        color: '#EAEAEA',
        textAlign: 'center',
        fontSize: 14,
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
    saveButton: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    cancelButton: {
        backgroundColor: '#757575',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    tableInput: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#3A86FF',
        borderRadius: 4,
        padding: 4,
        color: '#EAEAEA',
        marginRight: 8,
    },
});