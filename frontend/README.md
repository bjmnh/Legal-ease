# Legal Text Aggregator Frontend

This is the frontend React application for the Legal Text Aggregator project. It allows users to search for federal bills, view proposed law amendments, and get LLM-generated impact explanations.

## Project Overview
- **Framework:** React (Vite)
- **Auth/DB:** Firebase Authentication & Firestore
- **Backend:** Node.js/Express (see `/functions`)
- **External APIs:** Congress.gov API, LLM API (OpenAI/Gemini)

## Getting Started

1. **Clone the Repository**
   ```sh
   git clone <repo-url>
   cd proofOfConcept/frontend
   ```
2. **Install Dependencies**
   ```sh
   npm install
   ```
3. **Set Up Environment Variables**
   Create a `.env` file in the `frontend` directory with:
   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_sender_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id
   VITE_GET_BILL_DETAIL_URL=Your-Bill-Details-Url
   VITE_CHAT_API_URL=Your-Chat-Api-Url
   ```

## Configuration

### Firebase
- Set up your own Firebase project and obtain the config values above.
- Update `src/firebase.js` if you change or add config fields.

### Backend/API URLs via .env
- **Bill Detail Cloud Function URL:** Set `VITE_GET_BILL_DETAIL_URL` in your `.env` file. Used in `src/App.jsx`.
- **Chat API URL:** Set `VITE_CHAT_API_URL` in your `.env` file. Used in `src/components/ChatModal.jsx`.

## Development Scripts

- **Start Dev Server:** `npm run dev`
- **Build for Production:** `npm run build`
- **Preview Production Build:** `npm run preview`

## Directory Structure
frontend/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Header.jsx      # Top navigation and search
│   │   ├── MainContent.jsx # Main app layout (splits left/right columns)
│   │   ├── LeftColumn.jsx  # Bill search/filter/results
│   │   ├── RightColumn.jsx # Bill details and chat
│   │   ├── ResultsList.jsx # List of bill search results
│   │   ├── ResultItem.jsx  # Single bill result
│   │   ├── BillDetails.jsx # Detailed bill info
│   │   ├── BillProgress.jsx# Bill progress tracker
│   │   ├── ChatModal.jsx   # LLM chat modal for bill Q&A
│   │   ├── Filters.jsx     # Filtering UI for search
│   │   ├── FloatingActionBar.jsx # Floating quick actions
│   │   ├── LandingPage.jsx # Landing/welcome screen
│   ├── App.jsx             # Main React app entry
│   ├── firebase.js         # Firebase config and initialization
│   ├── index.css           # Global styles
│   └── ...
├── .env                    # Environment variables
└── ...