# GCCRM - CRM Application

A modern Customer Relationship Management (CRM) application built with React, TypeScript, Vite, and Firebase.

## Features

- **Opportunities Management**: Track sales opportunities with stages, amounts, and close dates
- **Accounts Management**: Manage customer accounts with industry and contact information
- **Contacts Management**: Store and manage contact information linked to accounts
- **Tasks & Notes**: Create tasks and notes associated with opportunities, accounts, or contacts
- **User Management**: Role-based access control with hierarchical user relationships
- **Authentication**: Application-level authentication with password management
- **Date Filtering**: Advanced date filtering for opportunities by months, quarters, years, or custom ranges

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication)
- **State Management**: React Context API
- **Routing**: React Router DOM
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm or yarn
- Firebase project with Firestore enabled

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gccrmapp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Firebase configuration:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

4. Deploy Firestore rules and indexes:
```bash
npm run firebase:deploy:rules
npm run firebase:deploy:indexes
```

5. Create an admin user (see scripts section below)

6. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run firebase:deploy:rules` - Deploy Firestore security rules
- `npm run firebase:deploy:indexes` - Deploy Firestore indexes
- `npm run import:excel` - Import data from Excel file

## Deployment

### Azure Static Web Apps

See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) for detailed deployment instructions.

Quick steps:
1. Create an Azure Static Web App in Azure Portal
2. Configure GitHub Secrets with Firebase credentials
3. Push to `main` branch to trigger automatic deployment

### Firebase Hosting (Alternative)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and initialize
firebase login
firebase init hosting

# Build and deploy
npm run build
firebase deploy --only hosting
```

## Project Structure

```
gccrmapp/
├── src/
│   ├── components/      # React components
│   ├── services/       # Firebase service classes
│   ├── types/          # TypeScript type definitions
│   ├── context/        # React context providers
│   └── lib/            # Utility functions and Firebase config
├── scripts/            # Node.js scripts for data management
├── .github/workflows/  # GitHub Actions workflows
├── staticwebapp.config.json  # Azure Static Web App config
└── firestore.rules     # Firestore security rules
```

## Data Model

See [DATA_MODEL.md](./DATA_MODEL.md) for detailed information about the data model, relationships, and validation rules.

## Authentication

The application uses application-level authentication (not Firebase Auth). Users are stored in Firestore with bcrypt-hashed passwords.

Default password for new users: `Welcome@123`

## User Roles

- **admin**: Full access to all data and user management
- **sales_manager**: Access to own data and team data
- **sales_rep**: Access to own data only
- **user**: Basic user access

## Scripts for Data Management

Located in the `scripts/` directory:

- `insert-admin-user.ts` - Create or update admin user
- `set-admin-password.ts` - Set password for any user
- `create-users-from-opportunities.ts` - Create users from opportunity owners
- `link-opportunities-to-users.ts` - Link opportunities to user IDs
- `import-excel.ts` - Import data from Excel file

Run scripts with:
```bash
npx tsx scripts/script-name.ts
```

## Documentation

- [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) - Azure Static Web Apps deployment guide
- [DATA_MODEL.md](./DATA_MODEL.md) - Data model documentation
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Firebase deployment guide
- [NETWORK_ACCESS.md](./NETWORK_ACCESS.md) - Network access configuration
- [scripts/IMPORT_EXCEL.md](./scripts/IMPORT_EXCEL.md) - Excel import guide

## License

[Add your license here]

## Support

For issues and questions, please open an issue in the repository.
