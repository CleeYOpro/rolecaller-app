# Attendance Intelligence Suite

> **Empowering Education in the Most Remote Corners of India.**
> *Dedicated to the mission of the Friends Missionary Prayer Band (FMPB).*

## 🌏 The Mission

The **Friends Missionary Prayer Band (FMPB)** operates in some of the most underdeveloped and remote regions of India, bringing humanitarian aid and educational support to tribal communities. In these areas, technology is often nonexistent, connectivity is unstable, and infrastructure is minimal.

Schools in these regions have historically relied on fragile paper-based systems. This makes it nearly impossible to track student consistency, identify drop-out risks, or provide data-driven support for scholarships and higher education opportunities.

**The Attendance Intelligence Suite** is built to solve this specific challenge. It is a robust, **offline-first** digital infrastructure designed to work where other software fails. It empowers teachers to capture vital data without needing the internet, ensuring that every student's journey is documented, recognized, and supported—paving the way for a brighter future.

### 🎯 FMPB's Vision

FMPB's vision is to empower the most marginalized communities through education and humanitarian support. The organization focuses on:
- Establishing schools in remote tribal areas
- Providing educational resources and teacher training
- Supporting students through scholarship programs
- Tracking student progress to identify and support at-risk individuals
- Creating pathways for higher education and vocational training

The Attendance Intelligence Suite directly supports this mission by providing a reliable system for tracking student attendance, even in areas with no internet connectivity.

---

## 🏗 Technical Architecture

The system is engineered for **resilience**. It assumes that the internet is a luxury, not a guarantee. The architecture decouples the data collection (Teacher App) from the data aggregation (Cloud), bridging them with an intelligent synchronization layer.

```mermaid
graph TD
    subgraph "Remote Field (Offline Environment)"
        Teacher[Teacher]
        MobileApp[React Native App]
        LocalDB[Expo SQLite]
        NetInfo[Connectivity Listener]
        
        Teacher -->|Marks Attendance| MobileApp
        MobileApp -->|Writes Data| LocalDB
        NetInfo -->|Monitors Signal| MobileApp
    end

    subgraph "Sync Layer"
        SyncService[Offline Sync Service]
        MobileApp -->|Triggers| SyncService
        SyncService -->|Reads Pending Records| LocalDB
        SyncService -->|Pushes Data| API
    end

    subgraph "Cloud Infrastructure (Online)"
        API[Node.js API Server]
        NeonDB[Neon Serverless Postgres]
        AdminDash[Admin Dashboard]
        
        API -->|Connection Pooling| NeonDB
        AdminDash -->|Fetch Analytics| API
    end

```

### 🔄 Data Flow

1. **Offline Data Collection**:
   - Teachers use the mobile app to mark student attendance
   - All data is immediately stored in the local SQLite database
   - The app works completely offline with no internet dependency

2. **Intelligent Synchronization**:
   - When connectivity is available, data is automatically synchronized
   - The sync process pushes local changes to the cloud database
   - New data from the cloud is pulled to keep local storage up-to-date

3. **Centralized Analytics**:
   - All synchronized data is stored in a central PostgreSQL database
   - Administrators can access analytics and reports through the dashboard
   - Data is used to identify trends, at-risk students, and program effectiveness

---

## 🛠 Deep Technical Stack

We have chosen a stack that balances **performance**, **reliability**, and **developer experience**.

### 📱 Frontend (Mobile & Web)
*   **Framework**: **React Native** with **Expo SDK 54** (Managed Workflow).
*   **Language**: **TypeScript** (Strict typing for reliability).
*   **Routing**: **Expo Router** (File-based routing for intuitive navigation).
*   **Offline Engine**: **Expo SQLite** (Local persistent storage for offline data).
*   **State Management**: React Hooks (`useState`, `useEffect`, `useContext`).
*   **Connectivity**: **@react-native-community/netinfo** (Real-time network state detection).
*   **UI Components**: Custom components styled with **StyleSheet** (No heavy UI libraries to keep the bundle size small).
*   **File Handling**: **Expo Document Picker** (For bulk student uploads via CSV/JSON).
*   **Icons**: **@expo/vector-icons** for consistent iconography across platforms.

### 🖥 Backend (API)
*   **Runtime**: **Node.js** (Lightweight, event-driven architecture).
*   **Server**: Custom **HTTP Server** (Zero-dependency, highly optimized for low-latency requests).
*   **Database Driver**: **pg (node-postgres)** (Robust connection pooling to handle unstable connections gracefully).
*   **Security**: Environment variable management via `dotenv`.

### 🗄 Database (Cloud)
*   **Provider**: **Neon** (Serverless PostgreSQL).
*   **ORM**: **Drizzle ORM** (Type-safe SQL schema definition and query building).
*   **Migrations**: **Drizzle Kit** (Schema management and version control).
*   **Scalability**: Auto-scaling compute endpoints to handle varying loads from multiple schools.

### 🔌 Data Synchronization
*   **Offline-first approach**: All data is written to local SQLite first
*   **Intelligent sync**: Automatic sync when connectivity is restored
*   **Conflict resolution**: Server-side conflict resolution using "last write wins"
*   **Reliable transport**: Retry mechanisms for failed sync operations

---

## 💾 Database Schema & Design

The database is normalized to ensure data integrity while supporting the flexible querying needed for analytics. We maintain identical schemas in both SQLite (local) and PostgreSQL (cloud) for seamless synchronization.

### 1. `schools`
*Represents a physical school unit in a village or town.*
*   `id`: UUID (Primary Key)
*   `name`: Text
*   `email`: Text (Unique, used for login)
*   `password`: Text (Hashed)
*   `address`: Text
*   `created_at`: Timestamp

### 2. `classes`
*Represents a grade or section within a school.*
*   `id`: UUID (Primary Key)
*   `school_id`: UUID (Foreign Key -> `schools.id`)
*   `name`: Text (e.g., "Class 5A")
*   `created_at`: Timestamp

### 3. `students`
*The core entity. Represents a child receiving education.*
*   `id`: UUID (Primary Key)
*   `school_id`: UUID (Foreign Key -> `schools.id`)
*   `class_id`: UUID (Foreign Key -> `classes.id`)
*   `name`: Text
*   `grade`: Text (Standard/Year)
*   `created_at`: Timestamp

### 4. `attendance`
*Daily records of student presence.*
*   `id`: UUID (Primary Key)
*   `student_id`: UUID (Foreign Key -> `students.id`)
*   `class_id`: UUID (Foreign Key -> `classes.id`)
*   `date`: Date (YYYY-MM-DD)
*   `status`: Enum (`present`, `absent`, `late`)
*   `updated_at`: Timestamp
*   **Constraint**: Unique composite key on `(student_id, date)` to prevent duplicate entries for the same day.

### 🔄 Data Flow: Frontend to Backend

1.  **Initialization**:
    *   App starts -> Checks `NetInfo`.
    *   **If Online**: Fetches latest `Schools`, `Classes`, and `Students` from **Neon** via **API** and caches them into **SQLite**.
    *   **If Offline**: Loads data directly from **SQLite**.

2.  **Marking Attendance**:
    *   Teacher marks a student as "Present".
    *   App writes immediately to **SQLite** (`attendance_local` table).
    *   App attempts to sync.

3.  **Synchronization Logic**:
    *   `offlineSync.ts` wakes up.
    *   Reads all "unsynced" records from **SQLite**.
    *   Sends a bulk `POST` request to `/attendance` endpoint.
    *   **API** receives data -> Performs `INSERT ... ON CONFLICT UPDATE` to **Neon**.
    *   On success, App marks local records as "synced".

### 📊 Database Relationship Diagram

```mermaid
erDiagram
    schools ||--o{ classes : contains
    schools ||--o{ students : enrolls
    classes ||--o{ students : includes
    students ||--o{ attendance : records
    classes ||--o{ attendance : tracks

    schools {
        uuid id PK
        text name
        text email
        text password
        text address
        timestamp created_at
    }

    classes {
        uuid id PK
        uuid school_id FK
        text name
        timestamp created_at
    }

    students {
        uuid id PK
        uuid school_id FK
        uuid class_id FK
        text name
        text grade
        timestamp created_at
    }

    attendance {
        uuid id PK
        uuid student_id FK
        uuid class_id FK
        date date
        enum status
        timestamp updated_at
    }
```

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm or yarn
*   Expo Go (for testing on Android/iOS devices)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-org/attendance-suite.git
    cd attendance-suite
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root:
    ```env
    DATABASE_URL="postgres://user:password@endpoint.neon.tech/neondb?sslmode=require"
    ```

### Running the System

**Step 1: Start the Backend**
This spins up the Node.js API server and connects to Neon.
```bash
npm run serve-api
```

**Step 2: Start the Frontend**
This launches the Expo development server.
```bash
npm start
```
*Press `a` for Android, `i` for iOS, or `w` for Web.*

---

## 🤝 Contributing

This project is open-source to support humanitarian efforts globally. If you are a developer, designer, or data scientist, your skills can help bring education to those who need it most.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

---

> *"To serve the least, the last, and the lost."*