const handleLogin = async () => {
    if (!selectedSchool) {
        setError("Please select a school");
        return;
    }

    setIsLoading(true);
    setError("");

    try {
        // Check if we're doing offline login
        const hasLocalSchool = await attendanceService.hasOfflineData();
        const isSameSchool = hasLocalSchool && (await storage.getSchool())?.id === selectedSchool.id;

        // If offline login for a school that was previously logged into
        if (!isOnline() && isSameSchool) {
            // Verify password against local database
            const localSchools = await localDb.select()
                .from(schoolsLocal)
                .where(eq(schoolsLocal.id, selectedSchool.id));

            if (localSchools.length > 0) {
                const localSchool = localSchools[0];
                // Simple password comparison (in a real app, you'd hash passwords)
                if (localSchool.password !== schoolPassword) {
                    throw new Error("Invalid credentials");
                }
            } else {
                // School not found in local DB, try to fetch it first
                console.log("School not found locally, attempting to sync...");
                try {
                    // Try to sync the school data
                    await syncSchoolsToLocal([selectedSchool]);

                    // Now check again
                    const updatedLocalSchools = await localDb.select()
                        .from(schoolsLocal)
                        .where(eq(schoolsLocal.id, selectedSchool.id));

                    if (updatedLocalSchools.length > 0) {
                        const updatedLocalSchool = updatedLocalSchools[0];
                        if (updatedLocalSchool.password !== schoolPassword) {
                            throw new Error("Invalid credentials");
                        }
                    } else {
                        throw new Error("Failed to sync school data");
                    }
                } catch (err) {
                    console.error("Failed to sync school data:", err);
                    throw new Error("Failed to sync school data");
                }
            }

            // For offline login, we don't need to sync data, it should already be there
            console.log("Offline login successful, using existing local data");
        } else {
            // Online login - verify credentials via API
            await api.login(schoolEmail, schoolPassword);

            // Save school to storage on successful login
            await storage.saveSchool(selectedSchool.id, selectedSchool.name);

            // Update local database with latest school data
            try {
                await attendanceService.downloadSchoolData(selectedSchool.id);
                console.log("Silent sync completed successfully.");
            } catch (err) {
                console.error("Silent sync failed:", err);
                // Non-blocking error, continue to login
            }
        }

        // Save school credentials to storage
        await storage.saveSchool(selectedSchool.id, selectedSchool.name);
    }