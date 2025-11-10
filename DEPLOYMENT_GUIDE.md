# Firebase Deployment Guide for F1 Fantasy App

This guide provides a complete walkthrough of the steps required to set up a new Firebase project, configure your local development environment, and deploy this web application to Firebase Hosting.

---

## Part 1: Firebase Project Setup (Web Console)

This section covers all tasks performed in the Firebase web console.

### 1. Create a Firebase Project
- Go to the [Firebase Console](https://console.firebase.google.com/).
- Click **"Add project"** and give your project a name (e.g., `formula-fantasy-1`).
- You can choose to enable or disable Google Analytics.
- Once created, you will be taken to the project's dashboard.

### 2. Register Your Web App
- On the project dashboard, click the web icon (`</>`) to start the "Add an app to get started" flow.
- Give your app a nickname (e.g., `formula-fantasy-web`).
- Click **"Register app"**. You do not need to set up Firebase Hosting at this stage.

### 3. Get Your Firebase Configuration
- After registering the app, Firebase will display your unique configuration object. This is the critical piece that connects your code to your Firebase project.
- You can also find this at any time by going to **Project settings** (gear icon) > **General** tab > **Your apps** > **Firebase SDK snippet** > **Config**.
- Copy the entire `firebaseConfig` object.

```javascript
// Example of a firebaseConfig object
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123...",
  appId: "1:123...:web:abc...",
  measurementId: "G-XYZ..."
};
```
- Paste this object into the `firebaseConfig.ts` file in the project, replacing the placeholder.

---

## Part 2: Local Environment Setup (Your Computer)

This section covers installing the necessary command-line interface (CLI) tools.

### 1. Install Node.js and npm
- **Problem:** If you run `npm` in your terminal and see an error like `'npm' is not recognized...`, you do not have Node.js installed.
- **Solution:**
    1. Go to the official [Node.js website](https://nodejs.org/).
    2. Download and run the **LTS** (Long-Term Support) version for your operating system.
    3. Accept all default installation settings.
    4. **Crucially, close and reopen your terminal/PowerShell window** for the changes to take effect.

### 2. Install the Firebase CLI
- With Node.js and npm installed, run the following command in your terminal to install the Firebase tools globally on your machine:
```bash
npm install -g firebase-tools
```

### 3. Troubleshooting: 'firebase' is not recognized
- **Problem:** If you run `firebase` and get an error, it means your system's PATH variable wasn't updated correctly.
- **Solution:**
    1. **Restart your terminal.** This is the most common fix.
    2. If that doesn't work, you may need to manually add the npm global installation directory to your system's PATH. You can find this directory by running `npm config get prefix`.

---

## Part 3: Deploying the Application

This is the final process of uploading your code to Firebase's servers.

### 1. Log In to Firebase
- In your terminal, run the login command. This will open a browser window for you to authenticate with your Google account.
```bash
firebase login
```
- When asked about enabling Gemini, you can safely select **Yes (Y)**.

### 2. Initialize Your Project Folder
- Navigate to your project's root directory in the terminal (e.g., `C:\Apps\f1-fantasy-app`).
- Run the initialization command:
```bash
firebase init
```
- Answer the series of questions **exactly** as follows:
    - `Are you ready to proceed?` -> **Yes**
    - `Which Firebase features do you want to set up?` -> Select **`Hosting: Set up deployments for static web apps`** (use arrow keys and spacebar).
    - `Please select an option:` -> **Use an existing project**
    - `Select a default Firebase project:` -> Select your project (`formula-fantasy-1`).
    - `What do you want to use as your public directory?` -> **`.`** (a single period).
    - `Configure as a single-page app (rewrite all urls to /index.html)?` -> **Yes**
    - `Set up automatic builds and deploys with GitHub?` -> **No**
    - `File ./index.html already exists. Overwrite?` -> **No**

### 3. Deploy!
- This is the final command. It bundles and uploads all your files.
```bash
firebase deploy
```
- After it completes, the terminal will provide you with a **Hosting URL** (e.g., `https://formula-fantasy-1.web.app`). Your app is now live on the internet!

---

## Part 4: Connecting a Custom Domain (Optional)
1. Go to the **Hosting** section in your Firebase Console.
2. Click **"Add custom domain"**.
3. Follow the wizard to enter your domain name (e.g., `carolinaminted.net`).
4. Firebase will provide you with one or more **`A` records** (IP addresses).
5. Go to your domain registrar's website (where you bought the domain) and add these `A` records to your DNS settings.
6. It may take some time for the changes to propagate. Firebase will automatically provision an SSL certificate once it's connected.
