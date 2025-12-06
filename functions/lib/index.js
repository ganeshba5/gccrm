"use strict";
// Firebase Cloud Functions
// Deploy this to Firebase Functions
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
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Export addRole function
exports.addRole = functions.https.onCall(async (data, context) => {
    var _a, _b;
    // Check if request is made by an authenticated admin
    if (!context || !context.auth || !((_b = (_a = context.auth.token) === null || _a === void 0 ? void 0 : _a.roles) === null || _b === void 0 ? void 0 : _b.admin)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can modify roles.');
    }
    // Validate data
    const userId = data === null || data === void 0 ? void 0 : data.userId;
    const role = data === null || data === void 0 ? void 0 : data.role;
    if (!userId || !role || !['admin', 'sales'].includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid user ID or role specified.');
    }
    try {
        // Get user and current custom claims
        const user = await admin.auth().getUser(userId);
        const currentClaims = user.customClaims || {};
        // Update roles in custom claims
        const roles = currentClaims.roles || {};
        roles[role] = true;
        // Set custom claims
        await admin.auth().setCustomUserClaims(userId, Object.assign(Object.assign({}, currentClaims), { roles }));
        // Store role in Firestore for UI access
        await admin.firestore()
            .collection('roles')
            .doc(userId)
            .set({ roles }, { merge: true });
        return { success: true };
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', 'Error modifying user roles.', error);
    }
});
// Export fetchEmails function
const fetchEmails_1 = require("./fetchEmails");
exports.fetchEmails = fetchEmails_1.fetchEmails;
// Export processEmails function
const processEmails_1 = require("./processEmails");
exports.processEmails = functions.https.onRequest(async (req, res) => {
    try {
        const result = await (0, processEmails_1.processUnprocessedEmails)();
        res.json(Object.assign(Object.assign({ success: true }, result), { timestamp: new Date().toISOString() }));
    }
    catch (error) {
        functions.logger.error('Error processing emails:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
//# sourceMappingURL=index.js.map