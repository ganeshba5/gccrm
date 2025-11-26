# Quick Start: Deploy Firestore Rules & Indexes

## Step 1: Login to Firebase
```bash
npm run firebase:login
```
This opens a browser for authentication.

## Step 2: Set Firebase Project

**Option A** - If you have `VITE_FIREBASE_PROJECT_ID` in your `.env` file:
```bash
npm run firebase:set-project
```

**Option B** - Interactive selection (recommended):
```bash
npm run firebase:use
```
Select your project from the list.

**Option C** - Manual: Create `.firebaserc` file:
```json
{
  "projects": {
    "default": "your-project-id-here"
  }
}
```

## Step 3: Deploy
```bash
npm run firebase:deploy:firestore
```

This deploys both rules and indexes. Or deploy separately:
- `npm run firebase:deploy:rules` - Rules only
- `npm run firebase:deploy:indexes` - Indexes only

## Troubleshooting

**"No currently active project"**
→ Run Step 2 above to set your project.

**"Failed to authenticate"**
→ Run Step 1 above to login.

**"Permission denied"**
→ Make sure you have the correct permissions in Firebase Console.

