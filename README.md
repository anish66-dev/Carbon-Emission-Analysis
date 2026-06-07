# ECO_SYSTEMS_v4.0 | Decentralized Carbon Governance Terminal (In progress, Not finished)

An enterprise-grade, data-dense **Multi-Tenant Carbon Accounting Platform** engineered to automate, audit, and optimize Scope 1 and Scope 2 emissions transparency across distributed industrial infrastructure.

The application utilizes an advanced **Industrial Command Center** design system featuring micro-second telemetry graphing, an automated AI Vision Ingestion Pipeline to parse physical billing data, and an AI-driven Strategy Layer that maps facility assets to dynamic carbon mitigation roadmaps.

---

## 🏗️ Architectural Overview

The system architecture cleanly separates decoupled microservices to preserve isolation, low latency, and deterministic verification:

```
                  ┌────────────────────────────────────────┐
                  │          Vite + React SPA (v4)         │
                  │  (Tailwind v4, Recharts, Client-Side)   │
                  └───────────────────┬────────────────────┘
                                      │
                         HTTPS + JWT Session Tokens
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       FastAPI Core Logic Engine        │
                  │       (Asynchronous Python App)        │
                  └─────────┬────────────────────┬─────────┘
                            │                    │
                NoSQL Ledger│                    │Groq Vision AI
                            ▼                    ▼
               ┌────────────────────────┐    ┌────────────────────────┐
               │    MongoDB Database    │    │      GROQ API Cloud    │
               │ (Tenants, Logs, Tasks) │    │ (Llama 3 Vision Model) │
               └────────────────────────┘    └────────────────────────┘

```

---

## 📂 System File Workspace Mapping

```text
├── python_scripts/                  # Backend Automation & Data Seeding Tasks
│   └── seed_database.py             # Industrial data factory hydration script
├── src/                             # Core User Interface Application Space
│   ├── assets/                      # Technical vector maps and visual structures
│   ├── App.jsx                      # Client-Side Router & Master State Controller
│   ├── Dashboard.jsx                # Responsive Telemetry Panels & Ingestion Core
│   ├── Landing.jsx                  # Public Environmental Analytics Splash
│   ├── Login.jsx                    # Identity Access Gateway & Typewriter Autocomplete
│   └── index.css                    # Tailwind v4 Configuration & Layered `@theme` Utilities
├── index.html                       # Global DOM shell root container
├── package.json                     # Interface project tracking dependencies
└── vite.config.js                   # Compilation engine and Tailwind processing pipeline

```

---

## 🛠️ Tech Stack & Key Frameworks

### Frontend Canvas Console

* **Core Engine:** React 19 + Vite SPA (Single Page Application Bundle)
* **Styling Engine:** Tailwind CSS v4.0 (Utilizing pure CSS configuration mapping)
* **Data Layout Charts:** Recharts (High-performance vector SVG composition layers)
* **Typography Vectors:** Geist Sans (Reading typography) & JetBrains Mono (Data readouts)

### Backend Control Plane

* **API Framework:** FastAPI (Asynchronous Python 3.11/3.12 Core)
* **Authentication Pipeline:** Jose-JWT + Cryptographic Hash Verification
* **Database Integration:** Motor / PyMongo (Asynchronous NoSQL Document Store)
* **Analytical Inference:** GROQ API Wrapper + Llama 3 Vision (Document extraction matrix)

---

## 🚀 Installation & Local Environment Setup

Ensure you have [Node.js (v18+)](https://nodejs.org/) and [Python (3.10+)](https://www.python.org/) installed before running the provisioning tasks.

### 1. Database Provisioning & Seeding

Navigate to your primary backend workspace path, verify that your local MongoDB server is running, and hydrate the system collections:

```bash
# Shift directory focus to backend tools folder
cd python_scripts

# Run database seeder to construct collections and mock parameters
python seed_database.py

```

### 2. Frontend Workspace Deployment

Open a secondary independent terminal terminal instance inside the repository root root directory path to configure the React workspace environment:

```bash
# Force explicit local installation of matching ecosystem dependencies
npm install

# Force-install Tailwind v4 plugins and core charting utilities
npm install tailwindcss@next @tailwindcss/vite@next recharts lucide-react axios react-router-dom

```

### 3. Initialize Execution Servers

With your Python backend operational, trigger the Vite compiling engine:

```bash
npm run dev

```

The app will compile cleanly and output a local testing stream endpoint link, standardly mapped to:

🌐 **`http://localhost:5173/`**

---

## 🧭 Command Console Interface Layout Map

The application is engineered into clean operational pages mapped to explicit path URLs:

### 1. Public Analytics Dashboard (`/`)

* **Purpose:** A forward-facing, unauthenticated telemetry sheet displaying international carbon stats using custom count-up interceptor trackers.
* **Entry Hook:** Features an interactive **"Access Terminal"** command button that switches application layout state straight into the authentication sequence.

### 2. Identity Access Gateway (`/login`)

* **Purpose:** Secure multi-tenant login access panel.
* **Demo Macros:** Houses three clickable system token automation profile chips: **Admin Profile**, **Staff Operator**, and **Auditor Lead**. Clicking any chip initiates an animated programmatic keystroke routine that fills user variables and hashes credentials automatically for review panels.

### 3. Executive Dashboard Terminal (`/dashboard`)

* **Purpose:** The production system control room containing reactive multi-variable components:
* **Scope Telemetry Panel:** A beautiful dual-layer translucent area chart tracing real-time emission updates over continuous month indexes.
* **Intensity Index Meter:** A responsive vector circle tracking current metric coefficients against historical factory benchmarks.
* **Operational Log Feed:** A self-scrolling audit ledger tracing automated backend state handshakes.
* **Ingestion Terminal Hub:** A secure file drop zone. When a physical carbon document (utility statement, fuel record) is uploaded, it handles passing data along to the backend via a signed security token, triggers an AI validation verify prompt, and appends the calculations straight back into the live ledger loop.



---

## 🎛️ Bottom Console Dock Navigation Strategy

When presenting or demoing the application, use this breakdown to explain what each terminal action icon does:

| Console Icon | System Destination | Operational Purpose / User Narrative |
| --- | --- | --- |
| `dashboard` | **Overview Panel** | *Current Active Screen.* Displays executive emission metrics, log streams, and upload slots. |
| `query_stats` | **Simulation Engine** | Predictive "What-If" matrix page. Allows facility operators to simulate variables (e.g., *"Reduce production array 02 line capacity by 15%"*) and instantly see the projected visual trend drop off. |
| `eco` | **Biosphere Sync & Offset** | Integrates with green credit market endpoints, allowing the company to purchase verified carbon offsets or monitor satellite canopy data. |
| `security` | **Immutable Audit Ledger** | A locked compliance route engineered for legal inspectors. Provides a clear audit log with options to download absolute CSV tables for regulatory review. |
| `settings` | **System Configuration** | Facility access control. Manage staff permissions, register new physical warehouse tokens, or adjust standard grid emission constants. |
| `power_settings_new` | **Session Termination** | Triggers an instantaneous cache clearance routine. Erases all temporary authorization keys from browser storage and restricts view routing access completely until the next authorization layer validation. |

---

## 🔒 Cryptographic Token Validation Strategy

To handle the architecture securely across fluctuating testing endpoints, the platform operates on an explicit **Zero-Trust Token validation framework**:

1. **Identity Verification:** When input fields validate correctly, your FastAPI endpoint signs user parameters with an environment-level `SECRET_KEY`, dropping a highly encrypted JWT payload.
2. **Session Isolation:** The React client catches this string and commits it to `localStorage`.
3. **Header Injection:** For subsequent backend commands (such as downloading ledgers or sending receipts to the Vision AI model), Axios automatically attaches this token inside an `Authorization: Bearer <token>` header.
4. **Backend Interception:** The Python server runs an explicit dependency interceptor check (`Depends(get_current_user)`) to evaluate the token signature. If a hacker attempts to change their role or forge records on another port, the cryptographic signature verification fails instantly, throwing a **`401 Access Denied`** safety killswitch to completely protect your database layers.

---