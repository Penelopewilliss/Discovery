# Firebase Security Rules Proposal

This file outlines starter security rules for new collections added by the feature set: `posts` (with scheduling/privacy), `groups`, `reports`, and `drafts` (if persisted server-side).

These are recommendations — adapt to your project's auth model and testing.

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users: readable by anyone, writable by owner
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Posts: create by authenticated users
    match /posts/{postId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid
        && request.resource.data.visibilityStatus in ["draft","scheduled","published"]
        && request.resource.data.locationPrivacy in ["exact","approximate","hidden","delayed"];

      // Allow read only posts that are published or belong to the requester
      allow read: if resource.data.visibilityStatus == "published"
        || (request.auth != null && resource.data.userId == request.auth.uid)
        || (resource.data.privacy == 'public');

      // Updates only allowed by owner. Prevent changing `userId`.
      allow update: if request.auth != null && request.auth.uid == resource.data.userId
        && request.resource.data.userId == resource.data.userId;

      // Deletion only by owner
      allow delete: if request.auth != null && request.auth.uid == resource.data.userId;

      // Comments are subcollection — require auth to create
      match /comments/{commentId} {
        allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
        allow read: if true;
        allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
      }
    }

    // Groups: creation requires auth, membership changes by server or group owners
    match /groups/{groupId} {
      allow create: if request.auth != null && request.resource.data.createdBy == request.auth.uid;
      allow read: if true;
      allow update: if request.auth != null && (
        request.auth.uid == resource.data.createdBy ||
        (resource.data.admins != null && request.auth.uid in resource.data.admins)
      );
      allow delete: if request.auth != null && request.auth.uid == resource.data.createdBy;
    }

    // Reports: allow any authenticated user to create reports; only server/admin reads
    match /reports/{reportId} {
      allow create: if request.auth != null && request.resource.data.reporterId == request.auth.uid;
      allow read: if false; // only trusted backend/admin should read
      allow delete: if false;
    }

    // Default deny
    match /{document=**} { allow read, write: if false; }
  }
}
