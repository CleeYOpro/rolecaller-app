import { School } from '@/constants/types';

let currentSchool: School | null = null;

export const authStore = {
    getSchool(): School | null {
        return currentSchool;
    },

    setSchool(school: School | null) {
        currentSchool = school;
    },

    isLoggedIn(): boolean {
        return currentSchool !== null;
    },

    requireSchool(): School {
        if (!currentSchool) {
            throw new Error('No school is logged in');
        }
        return currentSchool;
    }
};
