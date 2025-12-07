"use strict";
/**
 * Process emails and attach them to notes at opportunity level
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processUnprocessedEmails = processUnprocessedEmails;
exports.processEmail = processEmail;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const string_similarity_1 = require("string-similarity");
const db = admin.firestore();
// Configuration for fuzzy matching and parsing
// These can be overridden by config settings
const DEFAULT_FUZZY_MATCH_THRESHOLD = 0.8; // 80% similarity required for match
const DEFAULT_CONTEXT_MATCH_THRESHOLD = 0.6; // 60% similarity for context-based matching
/**
 * Get configuration value for email parsing
 * Falls back to defaults if not set
 */
async function getParsingConfig(key, defaultValue) {
    try {
        const configRef = db.collection('configSettings');
        const globalQuery = await configRef
            .where('key', '==', `email_parsing.${key}`)
            .where('scope', '==', 'global')
            .limit(1)
            .get();
        if (!globalQuery.empty) {
            const setting = globalQuery.docs[0].data();
            return setting.value;
        }
        return defaultValue;
    }
    catch (error) {
        functions.logger.warn(`Could not load config for ${key}, using default:`, error);
        return defaultValue;
    }
}
/**
 * Clean email content - remove signatures, logos, thread history
 * Enhanced version that preserves important structured information
 */
function cleanEmailContent(text) {
    if (!text)
        return '';
    let cleaned = text;
    // Remove quoted/replied content (lines starting with >)
    cleaned = cleaned.replace(/^>\s+.*$/gm, '');
    // Remove "On [date] [person] wrote:" patterns
    cleaned = cleaned.replace(/^On\s+.+\s+wrote:.*$/gmi, '');
    // Remove "From:" lines in thread history
    cleaned = cleaned.replace(/^From:\s+.+$/gmi, '');
    // Remove "Sent:" lines in thread history
    cleaned = cleaned.replace(/^Sent:\s+.+$/gmi, '');
    // Remove "To:" lines in thread history (but keep first occurrence)
    const toMatches = cleaned.match(/^To:\s+.+$/gmi);
    if (toMatches && toMatches.length > 1) {
        // Remove all but the first
        let firstFound = false;
        cleaned = cleaned.replace(/^To:\s+.+$/gmi, (match) => {
            if (!firstFound) {
                firstFound = true;
                return match;
            }
            return '';
        });
    }
    // Split by common delimiters and take the first meaningful part
    const parts = cleaned.split(/^--\s*$/m);
    if (parts.length > 1) {
        cleaned = parts[0].trim();
    }
    // Split by "---" or "===" delimiters
    const altParts = cleaned.split(/^[-=]{3,}\s*$/m);
    if (altParts.length > 1) {
        cleaned = altParts[0].trim();
    }
    // Remove common signature lines
    const lines = cleaned.split('\n');
    const meaningfulLines = [];
    let foundSignature = false;
    const signatureStarters = [
        /^(Best regards|Sincerely|Regards|Thanks|Thank you|Yours|Cheers|Best),?$/i,
        /^(Sent from|This email was sent from)/i,
        /^--\s*$/,
        /^---\s*$/,
    ];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if this line starts a signature
        for (const pattern of signatureStarters) {
            if (pattern.test(line)) {
                foundSignature = true;
                break;
            }
        }
        if (foundSignature) {
            // Check if this might be important info (dates, amounts) before skipping
            const hasImportantInfo = /(\$[\d,]+|deadline|due date|meeting|follow up|\d{1,2}[\/\-]\d{1,2})/i.test(line);
            if (!hasImportantInfo) {
                continue;
            }
        }
        // Skip lines that look like signatures
        if (line.match(/^Sent from|^This email was sent from|^\[cid:|^<img/i)) {
            continue;
        }
        // Skip lines that are just URLs
        if (line.match(/^https?:\/\/[^\s]+$/i)) {
            continue;
        }
        // Skip lines that are just email addresses
        if (line.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/)) {
            continue;
        }
        meaningfulLines.push(line);
    }
    // Remove excessive whitespace
    cleaned = meaningfulLines.join('\n').trim();
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
    return cleaned;
}
/**
 * Extract HTML text content (strip HTML tags)
 */
function extractTextFromHtml(html) {
    if (!html)
        return '';
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    // Remove HTML tags but keep line breaks
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    return text.trim();
}
/**
 * Check if email content has already been processed (in thread history)
 */
async function isContentAlreadyProcessed(content, threadId) {
    var _a;
    if (!threadId || !content)
        return false;
    try {
        // Get all emails in this thread
        const emailsSnapshot = await db.collection('inboundEmails')
            .where('threadId', '==', threadId)
            .where('processed', '==', true)
            .get();
        // Get all notes from linked opportunities
        const noteIds = [];
        for (const emailDoc of emailsSnapshot.docs) {
            const emailData = emailDoc.data();
            if ((_a = emailData.linkedTo) === null || _a === void 0 ? void 0 : _a.noteId) {
                noteIds.push(emailData.linkedTo.noteId);
            }
        }
        if (noteIds.length === 0)
            return false;
        // Check if any note has similar content
        // Firestore "in" query has a limit of 10 items, so we need to batch
        const batchSize = 10;
        for (let i = 0; i < noteIds.length; i += batchSize) {
            const batch = noteIds.slice(i, i + batchSize);
            const notesSnapshot = await db.collection('notes')
                .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                .get();
            for (const noteDoc of notesSnapshot.docs) {
                const noteContent = noteDoc.data().content || '';
                // Simple similarity check - if content is very similar, consider it processed
                const similarity = calculateSimilarity(content, noteContent);
                if (similarity > 0.8) { // 80% similarity threshold
                    return true;
                }
            }
        }
        return false;
    }
    catch (error) {
        functions.logger.error('Error checking if content already processed:', error);
        return false;
    }
}
/**
 * Simple similarity calculation (Jaccard similarity on words)
 */
function calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return union.size > 0 ? intersection.size / union.size : 0;
}
/**
 * Parse explicit routing pattern with enhanced pattern recognition
 * Supports multiple variations: Account/Company/Client/Customer/Organization and Opportunity/Deal/Project/Engagement/Lead
 * Looks in both content and subject line
 */
function parseRoutingPattern(content, subject) {
    if (!content && !subject) {
        functions.logger.info('🔍 parseRoutingPattern: No content or subject provided');
        return null;
    }
    // Combine content and subject for pattern matching
    const searchText = `${subject || ''}\n${content || ''}`;
    let accountName;
    let opportunityName;
    // Account pattern variations (case-insensitive, with/without colon)
    const accountPatterns = [
        /(?:Account|Company|Client|Customer|Organization|Org):\s*([^,\n]+)/i,
        /(?:Account|Company|Client|Customer|Organization|Org)\s+is\s+([^,\n]+)/i,
        /(?:Account|Company|Client|Customer|Organization|Org)\s+=\s+([^,\n]+)/i,
    ];
    // Try each account pattern
    for (const pattern of accountPatterns) {
        const match = searchText.match(pattern);
        if (match && match[1]) {
            accountName = match[1].trim();
            functions.logger.info(`🔍 parseRoutingPattern: Found Account pattern - raw: "${match[1]}", trimmed: "${accountName}"`);
            break;
        }
    }
    // Opportunity pattern variations (case-insensitive, with/without colon)
    const opportunityPatterns = [
        /(?:Opportunity|Deal|Project|Engagement|Lead|Proposal):\s*([^\n]+)/i,
        /(?:Opportunity|Deal|Project|Engagement|Lead|Proposal)\s+is\s+([^\n]+)/i,
        /(?:Opportunity|Deal|Project|Engagement|Lead|Proposal)\s+=\s+([^\n]+)/i,
    ];
    // Try each opportunity pattern
    for (const pattern of opportunityPatterns) {
        const match = searchText.match(pattern);
        if (match && match[1]) {
            opportunityName = match[1].trim();
            functions.logger.info(`🔍 parseRoutingPattern: Found Opportunity pattern - raw: "${match[1]}", trimmed: "${opportunityName}"`);
            break;
        }
    }
    // Return result if at least account name was found
    if (accountName) {
        functions.logger.info(`🔍 parseRoutingPattern: Returning - accountName: "${accountName}", opportunityName: "${opportunityName || 'NOT FOUND'}"`);
        return {
            accountName,
            opportunityName,
        };
    }
    functions.logger.info('🔍 parseRoutingPattern: No account name found, returning null');
    return null;
}
/**
 * Find or create account by name with fuzzy matching
 */
async function findOrCreateAccount(accountName, createdBy, routingMethod, routingConfidence) {
    try {
        const accountsRef = db.collection('accounts');
        const trimmedName = accountName.trim();
        // Get fuzzy match threshold from config
        const fuzzyThreshold = await getParsingConfig('fuzzy_match_threshold', DEFAULT_FUZZY_MATCH_THRESHOLD);
        // First, try exact match
        const exactQuery = await accountsRef
            .where('name', '==', trimmedName)
            .limit(1)
            .get();
        if (!exactQuery.empty) {
            functions.logger.info(`✅ Found exact account match: ${trimmedName}`);
            return exactQuery.docs[0].id;
        }
        // If no exact match, try fuzzy matching
        const allAccountsSnapshot = await accountsRef.get();
        let bestMatch = null;
        for (const doc of allAccountsSnapshot.docs) {
            const existingName = doc.data().name || '';
            const similarity = (0, string_similarity_1.compareTwoStrings)(trimmedName.toLowerCase(), existingName.toLowerCase());
            if (similarity >= fuzzyThreshold) {
                if (!bestMatch || similarity > bestMatch.similarity) {
                    bestMatch = {
                        id: doc.id,
                        name: existingName,
                        similarity,
                    };
                }
            }
        }
        if (bestMatch) {
            functions.logger.info(`✅ Found fuzzy account match: "${trimmedName}" -> "${bestMatch.name}" (similarity: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
            return bestMatch.id;
        }
        // No match found, create new account
        const accountData = {
            name: trimmedName,
            status: 'active',
            createdBy,
            source: 'email', // Mark as created from email processing
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        };
        // Add routing information if provided
        if (routingMethod) {
            accountData.routingMethod = routingMethod;
        }
        if (routingConfidence !== undefined) {
            accountData.routingConfidence = routingConfidence;
        }
        const docRef = await accountsRef.add(accountData);
        functions.logger.info(`✅ Created new account: ${trimmedName}`);
        return docRef.id;
    }
    catch (error) {
        functions.logger.error(`Error finding/creating account "${accountName}":`, error.message);
        throw error;
    }
}
/**
 * Find or create opportunity by name and account with fuzzy matching
 */
async function findOrCreateOpportunity(opportunityName, accountId, createdBy, routingMethod, routingConfidence) {
    try {
        const opportunitiesRef = db.collection('opportunities');
        const trimmedName = opportunityName.trim();
        // First, get all opportunities for this account
        const accountOpportunitiesQuery = await opportunitiesRef
            .where('accountId', '==', accountId)
            .get();
        // Try exact match first
        for (const doc of accountOpportunitiesQuery.docs) {
            const existingName = doc.data().name || '';
            if (existingName === trimmedName) {
                functions.logger.info(`✅ Found exact opportunity match: ${trimmedName}`);
                return doc.id;
            }
        }
        // If no exact match, try fuzzy matching
        let bestMatch = null;
        // Get fuzzy match threshold from config
        const fuzzyThreshold = await getParsingConfig('fuzzy_match_threshold', DEFAULT_FUZZY_MATCH_THRESHOLD);
        for (const doc of accountOpportunitiesQuery.docs) {
            const existingName = doc.data().name || '';
            const similarity = (0, string_similarity_1.compareTwoStrings)(trimmedName.toLowerCase(), existingName.toLowerCase());
            if (similarity >= fuzzyThreshold) {
                if (!bestMatch || similarity > bestMatch.similarity) {
                    bestMatch = {
                        id: doc.id,
                        name: existingName,
                        similarity,
                    };
                }
            }
        }
        if (bestMatch) {
            functions.logger.info(`✅ Found fuzzy opportunity match: "${trimmedName}" -> "${bestMatch.name}" (similarity: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
            return bestMatch.id;
        }
        // No match found, create new opportunity
        const opportunityData = {
            name: trimmedName,
            accountId,
            stage: 'New',
            owner: createdBy,
            createdBy,
            source: 'email', // Mark as created from email processing
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        };
        // Add routing information if provided
        if (routingMethod) {
            opportunityData.routingMethod = routingMethod;
        }
        if (routingConfidence !== undefined) {
            opportunityData.routingConfidence = routingConfidence;
        }
        const docRef = await opportunitiesRef.add(opportunityData);
        functions.logger.info(`✅ Created new opportunity: ${trimmedName} for account ${accountId}`);
        return docRef.id;
    }
    catch (error) {
        functions.logger.error(`Error finding/creating opportunity "${opportunityName}":`, error.message);
        throw error;
    }
}
/**
 * Extract entities from email context (rule-based, no external APIs)
 * Uses heuristics to find account/opportunity names from email content, signatures, domains
 */
async function extractEntitiesFromContext(email, content, createdBy) {
    var _a;
    try {
        const fromEmail = ((_a = email.from) === null || _a === void 0 ? void 0 : _a.email) || '';
        const subject = email.subject || '';
        const domain = fromEmail.split('@')[1];
        if (!domain)
            return null;
        // Try to extract company name from email signature
        // Look for patterns like "Company Name" or "| Company Name" in signature area
        const signaturePatterns = [
            /\|\s*([A-Z][a-zA-Z\s&]+(?:Inc|LLC|Corp|Ltd|Company|Co)\.?)/i,
            /Company:\s*([A-Z][a-zA-Z\s&]+)/i,
            /([A-Z][a-zA-Z\s&]+(?:Inc|LLC|Corp|Ltd|Company|Co)\.?)/i,
        ];
        let companyName;
        for (const pattern of signaturePatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                companyName = match[1].trim();
                break;
            }
        }
        // If no company name found, try to derive from domain
        if (!companyName) {
            companyName = extractCompanyName(subject, domain);
        }
        // Try to find existing account using fuzzy matching
        const accountsRef = db.collection('accounts');
        const allAccountsSnapshot = await accountsRef.get();
        const contextThreshold = await getParsingConfig('context_match_threshold', DEFAULT_CONTEXT_MATCH_THRESHOLD);
        const contextMatchThreshold = await getParsingConfig('context_match_accept_threshold', 0.7);
        let bestMatch = null;
        for (const doc of allAccountsSnapshot.docs) {
            const existingName = doc.data().name || '';
            const similarity = (0, string_similarity_1.compareTwoStrings)(companyName.toLowerCase(), existingName.toLowerCase());
            if (similarity >= contextThreshold) { // Lower threshold for context-based matching
                if (!bestMatch || similarity > bestMatch.similarity) {
                    bestMatch = {
                        id: doc.id,
                        name: existingName,
                        similarity,
                    };
                }
            }
        }
        let accountId;
        if (bestMatch && bestMatch.similarity >= contextMatchThreshold) {
            accountId = bestMatch.id;
            functions.logger.info(`✅ Found account via context: "${companyName}" -> "${bestMatch.name}" (similarity: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
        }
        else {
            // Create new account from context
            accountId = await findOrCreateAccount(companyName, createdBy, 'context', 0.4);
        }
        // Extract opportunity name from subject or content
        let opportunityName = subject.substring(0, 50);
        if (opportunityName.length < 10) {
            opportunityName = `Email Opportunity - ${new Date().toLocaleDateString()}`;
        }
        const opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy, 'context', 0.4);
        return { accountId, opportunityId };
    }
    catch (error) {
        functions.logger.error('Error extracting entities from context:', error.message);
        return null;
    }
}
/**
 * Extract account/opportunity from email metadata (sender email domain, subject, etc.)
 * Enhanced version with improved matching
 */
async function extractFromMetadata(email, createdBy) {
    var _a;
    try {
        const fromEmail = ((_a = email.from) === null || _a === void 0 ? void 0 : _a.email) || '';
        const subject = email.subject || '';
        const domain = fromEmail.split('@')[1];
        if (!domain)
            return null;
        // Try to find account by email domain or company name in subject
        const accountsRef = db.collection('accounts');
        // Search by email domain
        let accountQuery = await accountsRef
            .where('email', '==', fromEmail)
            .limit(1)
            .get();
        if (accountQuery.empty) {
            // Try to find by domain in email field
            const allAccounts = await accountsRef.get();
            for (const doc of allAccounts.docs) {
                const accountData = doc.data();
                if (accountData.email && accountData.email.includes(domain)) {
                    accountQuery = { docs: [doc], empty: false };
                    break;
                }
            }
        }
        if (accountQuery.empty) {
            // Try to extract company name from subject or create from domain
            const companyName = extractCompanyName(subject, domain);
            const accountId = await findOrCreateAccount(companyName, createdBy, 'metadata', 0.6);
            // Create a default opportunity
            const opportunityName = `Email Opportunity - ${subject.substring(0, 50)}`;
            const opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy, 'metadata', 0.6);
            return { accountId, opportunityId };
        }
        const accountId = accountQuery.docs[0].id;
        // Try to find or create opportunity for this account
        const opportunityName = `Email Opportunity - ${subject.substring(0, 50)}`;
        const opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy, 'metadata', 0.6);
        return { accountId, opportunityId };
    }
    catch (error) {
        functions.logger.error('Error extracting from metadata:', error.message);
        return null;
    }
}
/**
 * Extract company name from subject or use domain
 */
function extractCompanyName(subject, domain) {
    // Try to extract company name from subject
    const subjectMatch = subject.match(/\[(.+?)\]/) || subject.match(/^(.+?):/);
    if (subjectMatch && subjectMatch[1]) {
        return subjectMatch[1].trim();
    }
    // Use domain name as fallback
    return domain.split('.')[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
/**
 * Extract structured data from email content
 * Returns dates, amounts, action items, and contacts
 */
function extractStructuredData(content, subject) {
    var _a;
    const result = {
        dates: [],
        amounts: [],
        actionItems: [],
        contacts: {
            emails: [],
            phones: [],
            names: [],
        },
    };
    const searchText = `${subject || ''}\n${content || ''}`;
    // Extract dates (various formats)
    const datePatterns = [
        /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g, // MM/DD/YYYY, DD-MM-YYYY
        /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g, // YYYY-MM-DD
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi, // January 15, 2024
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b/gi, // January 15
        /\b(deadline|due date|meeting|follow up|by|on|before|after)\s+([^,\n]+)/gi, // "deadline: January 15"
        /\b(today|tomorrow|next week|next month)\b/gi,
    ];
    for (const pattern of datePatterns) {
        const matches = searchText.matchAll(pattern);
        for (const match of matches) {
            try {
                const dateStr = match[0] || match[2] || '';
                if (dateStr.toLowerCase().includes('today')) {
                    result.dates.push(new Date());
                }
                else if (dateStr.toLowerCase().includes('tomorrow')) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    result.dates.push(tomorrow);
                }
                else {
                    const parsedDate = new Date(dateStr);
                    if (!isNaN(parsedDate.getTime())) {
                        result.dates.push(parsedDate);
                    }
                }
            }
            catch (e) {
                // Ignore invalid dates
            }
        }
    }
    // Extract amounts (currency values)
    const amountPatterns = [
        /\$[\d,]+(?:\.\d{2})?/g, // $1,000.00
        /\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|dollars?|usd)\b/gi, // 1,000 USD
        /\b(?:budget|amount|value|deal|contract|price|cost)\s*[:\-]?\s*\$?[\d,]+(?:\.\d{2})?/gi,
    ];
    for (const pattern of amountPatterns) {
        const matches = searchText.matchAll(pattern);
        for (const match of matches) {
            const amountStr = match[0].replace(/[^0-9.]/g, '');
            const amount = parseFloat(amountStr);
            if (!isNaN(amount) && amount > 0) {
                result.amounts.push(amount);
            }
        }
    }
    // Extract action items
    const actionPatterns = [
        /(?:Action|TODO|To Do|Task|Follow up|Follow-up|Action Item)[\s:]+([^\n]+)/gi,
        /(?:Please|Kindly|Need to|Should|Must)\s+([^.\n]+)/gi,
        /(?:Reminder|Remember to)\s+([^.\n]+)/gi,
    ];
    for (const pattern of actionPatterns) {
        const matches = searchText.matchAll(pattern);
        for (const match of matches) {
            const actionItem = (_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim();
            if (actionItem && actionItem.length > 5) {
                result.actionItems.push(actionItem);
            }
        }
    }
    // Extract email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = searchText.matchAll(emailPattern);
    for (const match of emailMatches) {
        const email = match[0].toLowerCase();
        if (!result.contacts.emails.includes(email)) {
            result.contacts.emails.push(email);
        }
    }
    // Extract phone numbers
    const phonePatterns = [
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // US format
        /\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g, // (123) 456-7890
        /\b\+?\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g, // International
    ];
    for (const pattern of phonePatterns) {
        const matches = searchText.matchAll(pattern);
        for (const match of matches) {
            const phone = match[0].trim();
            if (!result.contacts.phones.includes(phone)) {
                result.contacts.phones.push(phone);
            }
        }
    }
    // Extract names (simple heuristic: capitalized words that look like names)
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const nameMatches = searchText.matchAll(namePattern);
    for (const match of nameMatches) {
        const name = match[1].trim();
        // Filter out common false positives
        if (name.length > 3 &&
            !name.match(/^(Best|Regards|Sincerely|Thanks|Thank|Hello|Hi|Dear|Subject|From|To|CC|BCC|Account|Company|Client|Customer|Opportunity|Deal|Project|Engagement|Lead|Action|TODO|Task|Follow|Meeting|Deadline|Due|Date|Amount|Budget|Value|Price|Cost|Contract|Deal)$/i) &&
            !result.contacts.names.includes(name)) {
            result.contacts.names.push(name);
        }
    }
    return result;
}
/**
 * Analyze email for sentiment, urgency, and category
 */
function analyzeEmail(content, subject) {
    const searchText = `${subject || ''}\n${content || ''}`.toLowerCase();
    // Sentiment analysis (keyword-based)
    const positiveWords = ['thank', 'thanks', 'appreciate', 'great', 'excellent', 'wonderful', 'pleased', 'happy', 'excited', 'looking forward', 'glad', 'delighted'];
    const negativeWords = ['sorry', 'apologize', 'disappointed', 'concerned', 'worried', 'unhappy', 'frustrated', 'problem', 'issue', 'error', 'failed', 'unable'];
    let positiveCount = 0;
    let negativeCount = 0;
    for (const word of positiveWords) {
        if (searchText.includes(word))
            positiveCount++;
    }
    for (const word of negativeWords) {
        if (searchText.includes(word))
            negativeCount++;
    }
    let sentiment = 'neutral';
    if (positiveCount > negativeCount && positiveCount > 0) {
        sentiment = 'positive';
    }
    else if (negativeCount > positiveCount && negativeCount > 0) {
        sentiment = 'negative';
    }
    // Urgency detection
    const urgencyKeywords = {
        high: ['urgent', 'asap', 'as soon as possible', 'immediately', 'emergency', 'critical', 'important', 'deadline', 'due today', 'today'],
        medium: ['soon', 'quickly', 'priority', 'important', 'please respond', 'follow up'],
        low: ['when convenient', 'no rush', 'whenever', 'at your convenience'],
    };
    let urgency = 'low';
    for (const keyword of urgencyKeywords.high) {
        if (searchText.includes(keyword)) {
            urgency = 'high';
            break;
        }
    }
    if (urgency === 'low') {
        for (const keyword of urgencyKeywords.medium) {
            if (searchText.includes(keyword)) {
                urgency = 'medium';
                break;
            }
        }
    }
    // Category classification
    let category = 'General';
    const categoryPatterns = [
        { pattern: /inquiry|question|ask|information|request/i, category: 'Inquiry' },
        { pattern: /proposal|quote|estimate|pricing|bid/i, category: 'Proposal' },
        { pattern: /follow.?up|following|checking|status/i, category: 'Follow-up' },
        { pattern: /complaint|issue|problem|error|concern/i, category: 'Complaint' },
        { pattern: /support|help|assistance|troubleshoot/i, category: 'Support' },
        { pattern: /meeting|call|schedule|appointment/i, category: 'Meeting' },
        { pattern: /order|purchase|buy|transaction/i, category: 'Order' },
        { pattern: /thank|appreciation|gratitude/i, category: 'Thank You' },
    ];
    for (const { pattern, category: cat } of categoryPatterns) {
        if (pattern.test(searchText)) {
            category = cat;
            break;
        }
    }
    return { sentiment, urgency, category };
}
/**
 * Process a single email
 */
/**
 * Add an audit message to the email document
 */
async function addAuditMessage(emailDoc, status, message, details) {
    try {
        const email = emailDoc.data();
        const existingMessages = ((email === null || email === void 0 ? void 0 : email.auditMessages) || []);
        const newMessage = Object.assign({ timestamp: admin.firestore.Timestamp.now(), status,
            message }, (details && { details }));
        // Append to existing messages array
        const updatedMessages = [...existingMessages, newMessage];
        await emailDoc.ref.update({
            auditMessages: updatedMessages,
            updatedAt: admin.firestore.Timestamp.now(),
        });
    }
    catch (error) {
        functions.logger.warn(`Could not add audit message: ${error.message}`);
    }
}
async function processEmail(emailDoc, createdBy) {
    var _a, _b, _c, _d, _e;
    try {
        const email = emailDoc.data();
        if (!email) {
            await addAuditMessage(emailDoc, 'failure', 'Email data not found');
            return false;
        }
        // Skip if already processed
        if (email.processed) {
            await addAuditMessage(emailDoc, 'info', 'Email already processed, skipping');
            return false;
        }
        await addAuditMessage(emailDoc, 'info', 'Starting email processing');
        // Skip if subject contains "testing"
        const subject = (email.subject || '').toLowerCase();
        if (subject.includes('testing')) {
            functions.logger.info(`⏭️  Skipping email with "testing" in subject: ${email.subject}`);
            await addAuditMessage(emailDoc, 'skipped', 'Email skipped: subject contains "testing"', { subject: email.subject });
            await emailDoc.ref.update({ processed: true, updatedAt: admin.firestore.Timestamp.now() });
            return false;
        }
        // Get email content
        const htmlContent = ((_a = email.body) === null || _a === void 0 ? void 0 : _a.html) || '';
        const textContent = ((_b = email.body) === null || _b === void 0 ? void 0 : _b.text) || '';
        let content = textContent || extractTextFromHtml(htmlContent);
        // Clean content
        content = cleanEmailContent(content);
        if (!content || content.trim().length < 10) {
            functions.logger.info(`⏭️  Skipping email with insufficient content: ${email.subject}`);
            await addAuditMessage(emailDoc, 'skipped', 'Email skipped: insufficient content after cleaning', { contentLength: (content === null || content === void 0 ? void 0 : content.trim().length) || 0 });
            // Mark as processed to avoid infinite retries
            await emailDoc.ref.update({
                processed: true,
                updatedAt: admin.firestore.Timestamp.now(),
            });
            return false;
        }
        // Extract structured data
        const extractedData = extractStructuredData(content, email.subject);
        functions.logger.info(`📊 Extracted structured data:`, {
            dates: extractedData.dates.length,
            amounts: extractedData.amounts.length,
            actionItems: extractedData.actionItems.length,
            contacts: {
                emails: extractedData.contacts.emails.length,
                phones: extractedData.contacts.phones.length,
                names: extractedData.contacts.names.length,
            },
        });
        // Analyze email
        const analysis = analyzeEmail(content, email.subject);
        functions.logger.info(`📈 Email analysis:`, analysis);
        // Debug: Show content being parsed (first 500 chars)
        functions.logger.info(`📄 Email content (first 500 chars) for pattern matching:`, {
            subject: email.subject,
            contentPreview: content.substring(0, 500),
            contentLength: content.length,
        });
        // Check if content already processed in thread
        if (await isContentAlreadyProcessed(content, email.threadId)) {
            functions.logger.info(`⏭️  Skipping email - content already processed in thread: ${email.subject}`);
            await addAuditMessage(emailDoc, 'skipped', 'Email skipped: content already processed in thread', { threadId: email.threadId });
            await emailDoc.ref.update({ processed: true, updatedAt: admin.firestore.Timestamp.now() });
            return false;
        }
        // Smart routing with confidence scoring
        let accountId;
        let opportunityId;
        let routingMethod;
        let routingConfidence = 0;
        // Step 1: Try explicit pattern matching (highest confidence)
        const routing = parseRoutingPattern(content, email.subject);
        functions.logger.info(`🔍 Pattern matching results for email "${email.subject}":`, {
            accountName: (routing === null || routing === void 0 ? void 0 : routing.accountName) || 'NOT FOUND',
            opportunityName: (routing === null || routing === void 0 ? void 0 : routing.opportunityName) || 'NOT FOUND',
            hasRouting: !!routing,
        });
        if (routing === null || routing === void 0 ? void 0 : routing.accountName) {
            routingMethod = 'pattern';
            routingConfidence = 0.9; // High confidence for explicit patterns
            functions.logger.info(`📝 Creating/finding Account with name: "${routing.accountName}"`);
            accountId = await findOrCreateAccount(routing.accountName, createdBy, 'pattern', 0.9);
            functions.logger.info(`✅ Account ID: ${accountId}`);
            await addAuditMessage(emailDoc, 'success', `Account found/created via pattern matching`, { accountId, accountName: routing.accountName });
            if (routing.opportunityName) {
                functions.logger.info(`📝 Creating/finding Opportunity with name: "${routing.opportunityName}" for Account: ${accountId}`);
                opportunityId = await findOrCreateOpportunity(routing.opportunityName, accountId, createdBy, 'pattern', 0.9);
                functions.logger.info(`✅ Opportunity ID: ${opportunityId}`);
                await addAuditMessage(emailDoc, 'success', `Opportunity found/created via pattern matching`, { opportunityId, opportunityName: routing.opportunityName });
            }
            else {
                // Create default opportunity if not specified
                const opportunityName = `Email Opportunity - ${((_c = email.subject) === null || _c === void 0 ? void 0 : _c.substring(0, 50)) || 'New'}`;
                functions.logger.info(`📝 Creating default Opportunity with name: "${opportunityName}" for Account: ${accountId}`);
                opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy, 'pattern', 0.7);
                routingConfidence = 0.7; // Lower confidence when opportunity name not provided
                functions.logger.info(`✅ Opportunity ID: ${opportunityId}`);
                await addAuditMessage(emailDoc, 'success', `Default opportunity created (no name in pattern)`, { opportunityId, opportunityName });
            }
        }
        // Step 2: Try metadata-based routing (medium confidence)
        if (!accountId) {
            routingMethod = 'metadata';
            routingConfidence = 0.6;
            const metadataResult = await extractFromMetadata(email, createdBy);
            if (metadataResult) {
                accountId = metadataResult.accountId;
                opportunityId = metadataResult.opportunityId;
                functions.logger.info(`✅ Metadata-based routing successful: Account ${accountId}, Opportunity ${opportunityId}`);
                await addAuditMessage(emailDoc, 'success', `Account and opportunity found/created via metadata routing`, { accountId, opportunityId });
            }
            else {
                routingConfidence = 0;
                await addAuditMessage(emailDoc, 'warning', 'Metadata-based routing attempted but no account/opportunity found');
            }
        }
        // Step 3: Try rule-based entity extraction from context (lower confidence)
        if (!accountId) {
            routingMethod = 'context';
            routingConfidence = 0.4;
            const contextResult = await extractEntitiesFromContext(email, content, createdBy);
            if (contextResult) {
                accountId = contextResult.accountId;
                opportunityId = contextResult.opportunityId;
                functions.logger.info(`✅ Context-based routing successful: Account ${accountId}, Opportunity ${opportunityId}`);
                await addAuditMessage(emailDoc, 'success', `Account and opportunity found/created via context-based routing`, { accountId, opportunityId });
            }
            else {
                routingConfidence = 0;
                await addAuditMessage(emailDoc, 'warning', 'Context-based routing attempted but no account/opportunity found');
            }
        }
        if (!opportunityId) {
            functions.logger.info(`⏭️  Skipping email - could not determine opportunity (no routing method succeeded): ${email.subject}`);
            await addAuditMessage(emailDoc, 'failure', 'Email processing failed: Could not determine opportunity (no routing method succeeded)', { routingMethod, routingConfidence });
            // Update email with analysis even if not processed
            await emailDoc.ref.update({
                extractedData: {
                    dates: extractedData.dates.map(d => admin.firestore.Timestamp.fromDate(d)),
                    amounts: extractedData.amounts,
                    actionItems: extractedData.actionItems,
                    contacts: extractedData.contacts,
                },
                analysis,
                routingConfidence: 0,
                updatedAt: admin.firestore.Timestamp.now(),
            });
            return false;
        }
        // Update opportunity with extracted amount if found
        if (extractedData.amounts.length > 0 && opportunityId) {
            const maxAmount = Math.max(...extractedData.amounts);
            try {
                await db.collection('opportunities').doc(opportunityId).update({
                    amount: maxAmount,
                    updatedAt: admin.firestore.Timestamp.now(),
                });
                functions.logger.info(`💰 Updated opportunity ${opportunityId} with amount: $${maxAmount}`);
                await addAuditMessage(emailDoc, 'success', `Updated opportunity with extracted amount`, { opportunityId, amount: maxAmount });
            }
            catch (error) {
                functions.logger.warn(`Could not update opportunity amount: ${error.message}`);
                await addAuditMessage(emailDoc, 'warning', `Failed to update opportunity amount`, { error: error.message });
            }
        }
        // Create tasks from action items
        let tasksCreated = 0;
        if (extractedData.actionItems.length > 0 && opportunityId) {
            const tasksRef = db.collection('tasks');
            for (const actionItem of extractedData.actionItems.slice(0, 5)) { // Limit to 5 tasks per email
                try {
                    await tasksRef.add({
                        title: actionItem.substring(0, 200), // Truncate if too long
                        description: `Action item from email: ${email.subject}`,
                        status: 'not_started',
                        priority: analysis.urgency === 'high' ? 'high' : analysis.urgency === 'medium' ? 'medium' : 'low',
                        opportunityId,
                        accountId,
                        createdBy,
                        createdAt: admin.firestore.Timestamp.now(),
                        updatedAt: admin.firestore.Timestamp.now(),
                    });
                    functions.logger.info(`✅ Created task from action item: ${actionItem.substring(0, 50)}`);
                    tasksCreated++;
                }
                catch (error) {
                    functions.logger.warn(`Could not create task from action item: ${error.message}`);
                    await addAuditMessage(emailDoc, 'warning', `Failed to create task from action item`, { actionItem: actionItem.substring(0, 50), error: error.message });
                }
            }
            if (tasksCreated > 0) {
                await addAuditMessage(emailDoc, 'success', `Created ${tasksCreated} task(s) from action items`, { tasksCreated, totalActionItems: extractedData.actionItems.length });
            }
        }
        // Create note with email content
        const noteContent = `Email from ${((_d = email.from) === null || _d === void 0 ? void 0 : _d.name) || ((_e = email.from) === null || _e === void 0 ? void 0 : _e.email) || 'Unknown'}\n\n${content}`;
        const noteData = {
            content: noteContent,
            opportunityId,
            accountId,
            createdBy,
            source: 'email', // Mark as created from email processing
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        };
        const noteRef = await db.collection('notes').add(noteData);
        const noteId = noteRef.id;
        // Update email record with all extracted data and analysis
        await emailDoc.ref.update({
            processed: true,
            linkedTo: {
                accountId,
                opportunityId,
                noteId,
                parentType: 'opportunity',
            },
            extractedData: {
                dates: extractedData.dates.map(d => admin.firestore.Timestamp.fromDate(d)),
                amounts: extractedData.amounts,
                actionItems: extractedData.actionItems,
                contacts: extractedData.contacts,
            },
            analysis,
            routingConfidence,
            updatedAt: admin.firestore.Timestamp.now(),
        });
        // Add final success audit message
        await addAuditMessage(emailDoc, 'success', 'Email processing completed successfully', {
            accountId,
            opportunityId,
            noteId,
            routingMethod,
            routingConfidence: (routingConfidence * 100).toFixed(0) + '%',
            tasksCreated,
            extractedDataCounts: {
                dates: extractedData.dates.length,
                amounts: extractedData.amounts.length,
                actionItems: extractedData.actionItems.length,
            }
        });
        functions.logger.info(`✅ Processed email: ${email.subject} -> Opportunity ${opportunityId}, Note ${noteId} (routing: ${routingMethod}, confidence: ${(routingConfidence * 100).toFixed(0)}%)`);
        return true;
    }
    catch (error) {
        functions.logger.error(`Error processing email ${emailDoc.id}:`, error.message);
        await addAuditMessage(emailDoc, 'failure', `Email processing failed with error: ${error.message}`, { error: error.message, stack: error.stack });
        return false;
    }
}
/**
 * Process unprocessed emails
 */
async function processUnprocessedEmails(createdBy) {
    try {
        // Get admin user ID if not provided
        let adminUserId = createdBy;
        if (!adminUserId) {
            const usersRef = db.collection('users');
            const adminQuery = await usersRef
                .where('role', '==', 'admin')
                .where('isActive', '==', true)
                .limit(1)
                .get();
            if (adminQuery.empty) {
                throw new Error('No admin user found');
            }
            adminUserId = adminQuery.docs[0].id;
        }
        // Get unprocessed emails
        const emailsRef = db.collection('inboundEmails');
        const unprocessedQuery = await emailsRef
            .where('processed', '==', false)
            .orderBy('receivedAt', 'desc')
            .limit(100) // Process in batches
            .get();
        functions.logger.info(`Found ${unprocessedQuery.size} unprocessed emails`);
        let processed = 0;
        let skipped = 0;
        let errors = 0;
        for (const emailDoc of unprocessedQuery.docs) {
            try {
                const success = await processEmail(emailDoc, adminUserId);
                if (success) {
                    processed++;
                }
                else {
                    skipped++;
                }
            }
            catch (error) {
                functions.logger.error(`Error processing email ${emailDoc.id}:`, error.message);
                errors++;
            }
        }
        functions.logger.info(`✅ Email processing complete! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
        return { processed, skipped, errors };
    }
    catch (error) {
        functions.logger.error('❌ Error processing emails:', error.message);
        throw error;
    }
}
//# sourceMappingURL=processEmails.js.map