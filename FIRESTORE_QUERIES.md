# Firestore Query Examples for Leads

This document shows different ways to query leads from Firestore.

## Basic Query (Current Implementation)

```typescript
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Get all leads, ordered by creation date (newest first)
const leadsRef = collection(db, 'leads');
const q = query(leadsRef, orderBy('createdAt', 'desc'));
const querySnapshot = await getDocs(q);

const leads = querySnapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

## Query with Filters

### Filter by Status

```typescript
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

// Get only "New" leads
const leadsRef = collection(db, 'leads');
const q = query(
  leadsRef,
  where('status', '==', 'New'),
  orderBy('createdAt', 'desc')
);
const querySnapshot = await getDocs(q);
```

### Filter by Owner

```typescript
import { useAuth } from '../context/AuthContext';

const { user } = useAuth();

// Get leads assigned to current user
const q = query(
  leadsRef,
  where('owner', '==', user?.uid),
  orderBy('createdAt', 'desc')
);
```

### Multiple Filters (AND)

```typescript
// Get "New" leads assigned to current user
const q = query(
  leadsRef,
  where('status', '==', 'New'),
  where('owner', '==', user?.uid),
  orderBy('createdAt', 'desc')
);
```

## Query Operators

### Comparison Operators

```typescript
// Less than
where('createdAt', '<', someDate)

// Less than or equal
where('createdAt', '<=', someDate)

// Greater than
where('createdAt', '>', someDate)

// Greater than or equal
where('createdAt', '>=', someDate)

// Not equal
where('status', '!=', 'Converted')

// Array contains
where('tags', 'array-contains', 'important')

// In array
where('status', 'in', ['New', 'Contacted'])
```

### Example: Leads Created in Last 7 Days

```typescript
import { Timestamp } from 'firebase/firestore';

const sevenDaysAgo = Timestamp.fromDate(
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
);

const q = query(
  leadsRef,
  where('createdAt', '>=', sevenDaysAgo),
  orderBy('createdAt', 'desc')
);
```

## Limit and Pagination

### Limit Results

```typescript
import { limit } from 'firebase/firestore';

// Get only the 10 most recent leads
const q = query(
  leadsRef,
  orderBy('createdAt', 'desc'),
  limit(10)
);
```

### Pagination (Start After)

```typescript
import { startAfter, limit } from 'firebase/firestore';

// Get first page
const firstPageQuery = query(
  leadsRef,
  orderBy('createdAt', 'desc'),
  limit(10)
);
const firstPageSnapshot = await getDocs(firstPageQuery);

// Get next page (start after last document)
const lastDoc = firstPageSnapshot.docs[firstPageSnapshot.docs.length - 1];
const nextPageQuery = query(
  leadsRef,
  orderBy('createdAt', 'desc'),
  startAfter(lastDoc),
  limit(10)
);
const nextPageSnapshot = await getDocs(nextPageQuery);
```

## Real-time Listeners

### Listen for Changes

```typescript
import { onSnapshot } from 'firebase/firestore';

// Set up real-time listener
const unsubscribe = onSnapshot(
  query(leadsRef, orderBy('createdAt', 'desc')),
  (snapshot) => {
    const leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setLeads(leads);
  },
  (error) => {
    console.error('Error listening to leads:', error);
  }
);

// Cleanup: call unsubscribe() when component unmounts
```

## Complete Service Example

```typescript
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  type QueryConstraint
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Lead } from '../types';

class LeadService {
  private readonly collectionName = 'leads';

  // Get all leads
  async getAll(): Promise<Lead[]> {
    const leadsRef = collection(db, this.collectionName);
    const q = query(leadsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return this.convertToLeads(snapshot);
  }

  // Get leads by status
  async getByStatus(status: Lead['status']): Promise<Lead[]> {
    const leadsRef = collection(db, this.collectionName);
    const q = query(
      leadsRef,
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return this.convertToLeads(snapshot);
  }

  // Get leads by owner
  async getByOwner(ownerId: string): Promise<Lead[]> {
    const leadsRef = collection(db, this.collectionName);
    const q = query(
      leadsRef,
      where('owner', '==', ownerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return this.convertToLeads(snapshot);
  }

  // Get recent leads (last N days)
  async getRecent(days: number = 7): Promise<Lead[]> {
    const leadsRef = collection(db, this.collectionName);
    const cutoffDate = Timestamp.fromDate(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    );
    const q = query(
      leadsRef,
      where('createdAt', '>=', cutoffDate),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return this.convertToLeads(snapshot);
  }

  // Get leads with pagination
  async getPaginated(
    pageSize: number = 10,
    lastDoc?: any
  ): Promise<{ leads: Lead[]; lastDoc: any }> {
    const leadsRef = collection(db, this.collectionName);
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    ];

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(leadsRef, ...constraints);
    const snapshot = await getDocs(q);
    const leads = this.convertToLeads(snapshot);
    const newLastDoc = snapshot.docs[snapshot.docs.length - 1];

    return { leads, lastDoc: newLastDoc };
  }

  private convertToLeads(snapshot: any): Lead[] {
    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        company: data.company,
        email: data.email,
        phone: data.phone,
        status: data.status,
        owner: data.owner,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      } as Lead;
    });
  }
}

export const leadService = new LeadService();
```

## Important Notes

1. **Indexes Required**: Composite queries (where + orderBy on different fields) require Firestore indexes. Check `firestore.indexes.json`.

2. **Query Limitations**:
   - You can only use `!=` and `not-in` once per query
   - Range queries (`<`, `<=`, `>`, `>=`) can only be used on one field
   - `in` and `array-contains-any` support up to 10 values

3. **Ordering**: You must order by the same field you filter with range operators.

4. **Performance**: Use `limit()` to reduce data transfer and improve performance.

## Current Implementation Location

The current query implementation is in:
- `src/components/LeadDashboard.tsx` - `fetchLeads()` function

