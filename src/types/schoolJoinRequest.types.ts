import type { firestore } from 'firebase-admin';
import type { UserProfile } from './user.types';

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SchoolJoinRequest {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  schoolId: string;
  status: JoinRequestStatus;
  message?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: firestore.Timestamp;
  createdAt: firestore.Timestamp;
  updatedAt: firestore.Timestamp;
}

export interface CreateJoinRequestPayload {
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  schoolId: string;
  message?: string;
}

export interface ReviewJoinRequestPayload {
  requestId: string;
  reviewerId: string;
  reason?: string;
}

export type JoinRequestStatusView = SchoolJoinRequest & {
  isPending: boolean;
  isApproved: boolean;
  isRejected: boolean;
};

export type JoinRequestWithProfile = JoinRequestStatusView & {
  user?: UserProfile | null;
};
