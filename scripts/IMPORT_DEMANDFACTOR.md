# DemandFactor CSV Import Guide

This guide explains how to import Accounts, Contacts, and Opportunities from a DemandFactor CSV file into your CRM.

## Prerequisites

1. **Service Account Key**: You need a Firebase service account key to use the Admin SDK
   - See `scripts/SETUP_ADMIN.md` for instructions

2. **CSV File**: Your DemandFactor CSV file should be in the `data/` directory

## Quick Start

```bash
# Import a specific CSV file
npx tsx scripts/import-demandfactor-csv.ts "data/InfoGlobalTech Delivery Report 12.02.2025 DF69125-16LD.csv"

# Or add to package.json scripts and run:
npm run import:demandfactor "data/your-file.csv"
```

## CSV File Structure

The script expects the following columns in your CSV file:

### Required Columns
- **First Name** - Contact's first name
- **Last Name** - Contact's last name
- **Company** - Company/Account name

### Optional Columns
- **Email** - Contact email address
- **Phone Number** - Contact phone number
- **Title** - Contact job title
- **Company Size** - Company size information
- **Company Revenue** - Company revenue information
- **Country** - Company country
- **Industry** - Company industry
- **LinkedIN** - Contact LinkedIn profile URL
- **Content Downloaded** - Content download information
- **CQ 1 response** - Custom Question 1 response
- **CQ 2 response** - Custom Question 2 response
- **CQ 3 response** - Custom Question 3 response (used in opportunity description)

## What Gets Imported

### Accounts
- **Name**: From "Company" column
- **Industry**: From "Industry" column
- **Status**: Set to "prospect"
- **Source**: Set to "import"
- **Shared Users**: Automatically shared with: Anil Joshi, Arjun Joshi, Ganesh B (if found)

### Contacts
- **Name**: From "First Name" + "Last Name"
- **Email**: From "Email" column
- **Phone**: From "Phone Number" column
- **Title**: From "Title" column
- **LinkedIn**: From "LinkedIN" column
- **Account**: Linked to the created/found Account
- **Is Primary**: Set to true for the first contact per account

### Opportunities
- **Name**: Format: "{Company} - {Contact Name}"
- **Account**: Linked to the created/found Account
- **Stage**: Set to "New"
- **Probability**: Set to 10%
- **Expected Close Date**: Set to 6 months from today
- **Description**: Includes "Lead from DemandFactor" and CQ 3 response
- **Source**: Set to "import"
- **Shared Users**: Same as Account (Anil Joshi, Arjun Joshi, Ganesh B)

### Notes
- A note is added to each Account: "Leads from DemandFactor"

## Processing Logic

1. **Account Matching**: Uses fuzzy matching to find existing accounts by company name
   - If exact match found → uses existing account
   - If fuzzy match found (similarity ≥ 0.8) → uses existing account
   - Otherwise → creates new account

2. **Contact Matching**: For each account, checks if contact already exists
   - Matches by email (if provided)
   - If contact exists → updates if needed
   - Otherwise → creates new contact

3. **Opportunity Creation**: Creates a new opportunity for each contact
   - Links to the account
   - Sets default values (stage: New, probability: 10%, close date: 6 months)

## Shared Users

The script automatically shares Accounts and Opportunities with these users (if found):
- Anil Joshi
- Arjun Joshi
- Ganesh B

If these users are not found, Accounts and Opportunities will be created without shared users.

## Output

The script provides detailed console output showing:
- Number of accounts created/updated
- Number of contacts created
- Number of opportunities created
- Number of notes added
- Any errors or warnings

## Example Output

```
📊 Reading CSV file: data/InfoGlobalTech Delivery Report 12.02.2025 DF69125-16LD.csv

👤 Finding shared users...
   ✅ Found user: Anil Joshi (userId1)
   ✅ Found user: Arjun Joshi (userId2)
   ✅ Found user: Ganesh B (userId3)

👤 Getting admin user...
   ✅ Using user ID: adminUserId

📄 Processing sheet: "Sheet1"
📋 Found 150 rows

✅ Created account: Acme Corporation
✅ Created contact: John Doe (john@acme.com)
✅ Created opportunity: Acme Corporation - John Doe
...

📊 Summary:
   Accounts: 45 created, 5 updated
   Contacts: 150 created
   Opportunities: 150 created
   Notes: 50 added
```

## Notes

- The script processes rows in batches to avoid overwhelming Firestore
- Empty rows are automatically skipped
- Rows without Company name or Contact name are skipped
- The script uses fuzzy matching to avoid duplicate accounts
- All imported records are marked with `source: 'import'`

