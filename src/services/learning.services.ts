import { TIER_LIMITS, USER_STATUS, USER_TIERS } from '../config/constants';
import { UserDocument } from '../types/user.types';

export type FeatureAccessLevel =
  | 'limited'
  | 'full'
  | 'suspended'
  | 'review_required';

export interface UserPermissions {
  accessLevel: FeatureAccessLevel;
  features: string[];
}

const COMPETENCY_FEATURES = [
  'competency_assessment',
  'competency_results',
  'gap_analysis',
  'path_preview',
];

const FULL_FEATURES = [
  ...COMPETENCY_FEATURES,
  'modules',
  'badges',
  'certificates',
];

const resolveTierModuleList = (user: UserDocument): string[] => {
  const tier = user.tier ?? USER_TIERS.FREE;
  const limits = TIER_LIMITS[tier];
  return limits?.modulesAccessible ? [...limits.modulesAccessible] : [];
};

export const getAccessibleModules = (user: UserDocument): string[] => {
  if (
    user.status === USER_STATUS.PENDING ||
    user.status === USER_STATUS.REJECTED ||
    user.status === USER_STATUS.SUSPENDED
  ) {
    return [];
  }

  return resolveTierModuleList(user);
};

export const getCompetencyAccess = (user: UserDocument): string[] => {
  if (user.status === USER_STATUS.SUSPENDED) {
    return [];
  }

  if (user.status === USER_STATUS.REJECTED) {
    return [];
  }

  return [...COMPETENCY_FEATURES];
};

export const getUserPermissions = (user: UserDocument): UserPermissions => {
  if (user.status === USER_STATUS.SUSPENDED) {
    return { accessLevel: 'suspended', features: [] };
  }

  if (
    user.status === USER_STATUS.PENDING ||
    user.status === USER_STATUS.DRAFT
  ) {
    return { accessLevel: 'limited', features: [...COMPETENCY_FEATURES] };
  }

  if (user.status === USER_STATUS.REJECTED) {
    return { accessLevel: 'review_required', features: [] };
  }

  return { accessLevel: 'full', features: [...FULL_FEATURES] };
};
