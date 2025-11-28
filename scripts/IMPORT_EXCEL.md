# Excel Import Guide

This guide explains how to import data from an Excel workbook into your CRM.

## Prerequisites

1. **Service Account Key**: You need a Firebase service account key to use the Admin SDK
   - See `scripts/SETUP_ADMIN.md` for instructions

2. **Excel File**: Your Excel file should be in the `data/` directory

## Quick Start

```bash
# Import the default file
npm run import:excel

# Import a specific file
npx tsx scripts/import-excel.ts "data/your-file.xlsx"

# Import with a specific owner ID
npx tsx scripts/import-excel.ts "data/your-file.xlsx" "user-uid-here"
```

## Excel File Structure

The script automatically detects common column names. It looks for:

**Note**: Your Excel file (`Salesforce pipeline May 17 2023.xlsx`) has been successfully imported with these columns:
- `Account Name` → Account name
- `Opportunity Name` → Opportunity name
- `Amount` → Deal amount
- `Stage` → Sales stage (mapped to: Qualification → Qualified)
- `Close Date` → Expected close date
- `Probability (%)` → Win probability
- `Opportunity Owner` → Owner/Assigned to

### Account Fields
- **Account Name**: `Account Name`, `Account`, `Company`, `Company Name`, `Customer Name`
- **Website**: `Website`, `Account Website`, `Company Website`
- **Industry**: `Industry`, `Account Industry`
- **Phone**: `Phone`, `Account Phone`, `Company Phone`
- **Email**: `Email`, `Account Email`, `Company Email`

### Opportunity Fields
- **Opportunity Name**: `Opportunity Name`, `Opportunity`, `Deal Name`, `Name`, `Title`
- **Amount**: `Amount`, `Value`, `Deal Amount`, `Revenue`, `Sales Amount`
- **Stage**: `Stage`, `Status`, `Sales Stage`, `Opportunity Stage`
- **Probability**: `Probability`, `Win Probability`, `%`
- **Close Date**: `Close Date`, `Expected Close Date`, `Close`, `Expected Close`
- **Description**: `Description`, `Notes`, `Comments`
- **Owner**: `Owner`, `Assigned To`, `Sales Rep`, `Account Owner`, `Opportunity Owner`

## Stage Mapping

The script automatically maps common stage names to our stages:

- `New`, `Lead`, `Prospect` → **New**
- `Qualified`, `Qualify` → **Qualified**
- `Proposal`, `Quote` → **Proposal**
- `Negotiation`, `Negotiate` → **Negotiation**
- `Won`, `Closed Won`, `Closed-Won` → **Closed Won**
- `Lost`, `Closed Lost`, `Closed-Lost` → **Closed Lost**

## How It Works

1. **Reads Excel File**: Opens the first sheet of the workbook
2. **Creates Accounts**: Groups rows by account name (avoids duplicates)
3. **Creates Opportunities**: Creates one opportunity per row
4. **Links Relationships**: Links opportunities to their accounts

## Customizing Column Mapping

If your Excel file uses different column names, edit `scripts/import-excel.ts` and update the `COLUMN_MAPPING` object:

```typescript
const COLUMN_MAPPING = {
  accountName: ['Your Column Name', 'Another Name'],
  // ... etc
};
```

## Example

Given an Excel file with these columns:
- `Company Name`
- `Opportunity`
- `Amount`
- `Stage`
- `Close Date`

The script will:
1. Create an Account for each unique company
2. Create an Opportunity for each row
3. Link the Opportunity to its Account
4. Parse amounts, dates, and stages automatically

## Troubleshooting

### "File not found"
- Make sure the file path is correct
- Use absolute path if relative path doesn't work

### "No account name found"
- Check that your Excel file has a column with account/company name
- The script looks for common names, but you may need to customize the mapping

### "Permission denied"
- Make sure you have a service account key set up
- See `scripts/SETUP_ADMIN.md` for setup instructions

### Data not appearing
- Check Firebase Console > Firestore Database
- Verify the collections `accounts` and `opportunities` were created
- Check browser console for any errors

## Notes

- **Duplicate Accounts**: Accounts with the same name (case-insensitive) are merged
- **Default Owner**: If no owner is specified, uses "system" (you can pass a user UID as the second argument)
- **Dates**: Supports Excel date serial numbers and standard date formats
- **Amounts**: Automatically removes currency symbols and commas
- **Probabilities**: Automatically converts percentages (0-100)

