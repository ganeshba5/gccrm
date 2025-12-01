# Import Contacts Script

This script imports contacts from an Excel file and creates associated accounts and opportunities as needed.

## Usage

```bash
npx tsx scripts/import-contacts.ts [excel-file-path]
```

Example:
```bash
npx tsx scripts/import-contacts.ts "data/Sebastian Contacts.xlsx"
```

## Features

1. **Imports Contacts** from Excel file
2. **Creates Accounts** if they don't exist (from "Company" column)
3. **Creates Opportunities** if they don't exist (from "Opportunity" column)
4. **Associates Contacts** with Accounts and Opportunities
5. **Handles Email/Phone** - The email field may contain either an email address or a phone number
6. **Adds Country** to mailing address
7. **Sets Owner/Creator** - All created entities are owned and created by Sebastian Cordova

## Column Mapping

The script automatically detects columns using these possible names:

- **First Name**: "First Name", "FirstName", "First", "FName"
- **Last Name**: "Last Name", "LastName", "Last", "LName"
- **Company**: "Company", "Account", "Account Name", "Company Name", "Customer Name"
- **Opportunity**: "Opportunity", "Opportunity Name", "Deal Name", "Deal"
- **Email**: "Email", "Email Address", "E-mail" (may contain email or phone)
- **Phone**: "Phone", "Phone Number", "Telephone", "Tel"
- **Mobile**: "Mobile", "Mobile Number", "Cell", "Cell Phone"
- **Title**: "Title", "Job Title", "Position"
- **Department**: "Department", "Dept"
- **Street**: "Street", "Address", "Street Address", "Address Line 1"
- **City**: "City"
- **State**: "State", "Province", "Region"
- **Zip Code**: "Zip Code", "Zip", "Postal Code", "Postcode"
- **Country**: "Country"
- **Notes**: "Notes", "Comments", "Description"

## Data Processing

1. **Email/Phone Detection**: The script automatically detects if the email field contains an email address or phone number
2. **Account Creation**: Creates accounts with status "prospect" if they don't exist
3. **Opportunity Creation**: Creates opportunities with stage "New" if they don't exist
4. **Contact Association**: Links contacts to accounts and adds opportunity information to notes
5. **Mailing Address**: Constructs mailing address object with country included

## User Creation

The script will find or create a user account for "Sebastian Cordova" with email "sebastian.cordova@infoglobaltech.com". All created entities will have:
- `createdBy`: Sebastian Cordova's user ID
- `owner`: Sebastian Cordova's user ID (for opportunities)

## Output

The script provides progress updates and a summary:
- Number of contacts created
- Number of contacts skipped (with reasons)
- Number of accounts created
- Number of opportunities created

