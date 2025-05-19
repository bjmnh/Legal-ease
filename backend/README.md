# Legal Text Aggregator - Firebase Functions (Local/Personal Setup)

This folder contains backend Cloud Functions for the Legal Text Aggregator project. This guide will help you set up your **own independent Firebase project** (not connected to any existing private project) so you can develop and test locally and in your own cloud environment.

## Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ recommended)
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)
- A Google account

## 1. Create Your Own Firebase Project (Command Line)

1. **Log in to Firebase:**
   ```sh
   firebase login
   ```
2. **Create a new Firebase project:**
   ```sh
   firebase projects:create your-project-id --display-name "Your Project Name"
   ```
   - Replace `your-project-id` with a unique id (e.g., `legal-text-aggregator-yourname`).
   - You can view your projects with:
     ```sh
     firebase projects:list
     ```
3. **Set your active project locally:**
   ```sh
   firebase use your-project-id
   ```
4. **Enable required products:**
   - **Firestore:**
     ```sh
     firebase firestore:rules:set firestore.rules
     ```
   - **Authentication:** (email/password enabled by default; for others, use console)
   - **Cloud Functions:** (enabled by deploying functions)
   - **Cloud Storage:**
     ```sh
     firebase storage:rules:set storage.rules
     ```

## 2. Clone and Install
```sh
git clone https://github.com/your-org/Legal-Text-Aggregator.git
cd Legal-Text-Aggregator/proofOfConcept/functions
npm install
```

## 3. Link Your Local Code to Your Firebase Project
```sh
firebase init
# When prompted, select Firestore, Functions, Storage, and Emulators
# Choose your created project from the list or enter its project ID
```

## 4. Set Up Environment Variables
- Create a `.env` file in this folder:
  ```env
  CONGRESS_API_KEY=your_congress_api_key
  OPENAI_API_KEY=your_openai_api_key
  # Add any other required keys here
  ```
- **Do NOT commit secrets to version control!**

## 5. Set Up Firestore Security Rules
- For development, you can use:
  ```
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if true; // Open for dev ONLY
      }
    }
  }
  ```
- For production, restrict access to authenticated users:
  ```
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```

## 6. Set Up Storage Security Rules
- For development:
  ```
  service firebase.storage {
    match /b/{bucket}/o {
      match /{allPaths=**} {
        allow read, write: if true; // Open for dev ONLY
      }
    }
  }
  ```
- For production, restrict access to authenticated users:
  ```
  service firebase.storage {
    match /b/{bucket}/o {
      match /{allPaths=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```

## 7. Emulate Locally
- Start emulators for Functions, Firestore, Auth, and Storage:
  ```sh
  firebase emulators:start
  ```
- You can trigger storage events (e.g., upload a CSV) using the Firebase Console or CLI.

## 8. Deploy to Your Own Firebase Project
- Deploy all functions:
  ```sh
  firebase deploy --only functions
  ```

---

For help, consult the Firebase docs or ask the project maintainer.
