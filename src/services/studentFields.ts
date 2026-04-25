import { DbUser } from "../types";

export interface SchoolScopedStudentFields {
  skill_level?: string | null;
  preferred_disciplines?: string[] | null;
  primary_sport?: string | null;
  riding_background?: string | null;
  preferred_days?: string[] | null;
  preferred_time_slots?: string[] | null;
  preferred_lesson_types?: string[] | null;
  preferred_language?: string | string[] | null;
  consent_physical_condition?: boolean | null;
  consent_terms_conditions?: boolean | null;
  consent_gdpr?: boolean | null;
  consent_photos_videos?: boolean | null;
  consent_marketing?: boolean | null;
  consent_custom_1?: boolean | null;
  consent_custom_2?: boolean | null;
  arrival_date?: string | null;
  departure_date?: string | null;
  stay_notes?: string | null;
  notes?: string | null;
  school_id?: string | null;
}

export type MergedStudentUser = DbUser & SchoolScopedStudentFields;

export const buildSchoolScopedStudentFields = (
  studentData: any,
): SchoolScopedStudentFields => ({
  ...(studentData.skillLevel !== undefined && {
    skill_level: studentData.skillLevel || null,
  }),
  ...(studentData.preferredDisciplines !== undefined && {
    preferred_disciplines: studentData.preferredDisciplines || [],
  }),
  ...(studentData.primarySport !== undefined && {
    primary_sport: studentData.primarySport || null,
  }),
  ...(studentData.ridingBackground !== undefined && {
    riding_background: studentData.ridingBackground || null,
  }),
  ...(studentData.preferredDays !== undefined && {
    preferred_days: [...(studentData.preferredDays ?? [])],
  }),
  ...(studentData.preferredTimeSlots !== undefined && {
    preferred_time_slots: [...(studentData.preferredTimeSlots ?? [])],
  }),
  ...(studentData.preferredLessonTypes !== undefined && {
    preferred_lesson_types: [...(studentData.preferredLessonTypes ?? [])],
  }),
  ...(studentData.preferredLanguage !== undefined && {
    preferred_language: studentData.preferredLanguage ?? [],
  }),
  ...(studentData.consentPhysicalCondition !== undefined && {
    consent_physical_condition: studentData.consentPhysicalCondition,
  }),
  ...(studentData.consentTermsConditions !== undefined && {
    consent_terms_conditions: studentData.consentTermsConditions,
  }),
  ...(studentData.consentGdpr !== undefined && {
    consent_gdpr: studentData.consentGdpr,
  }),
  ...(studentData.consentPhotosVideos !== undefined && {
    consent_photos_videos: studentData.consentPhotosVideos,
  }),
  ...(studentData.consentMarketing !== undefined && {
    consent_marketing: studentData.consentMarketing,
  }),
  ...(studentData.consentCustom1 !== undefined && {
    consent_custom_1: studentData.consentCustom1,
  }),
  ...(studentData.consentCustom2 !== undefined && {
    consent_custom_2: studentData.consentCustom2,
  }),
  ...(studentData.arrivalDate !== undefined && {
    arrival_date: studentData.arrivalDate || null,
  }),
  ...(studentData.departureDate !== undefined && {
    departure_date: studentData.departureDate || null,
  }),
  ...(studentData.stayNotes !== undefined && {
    stay_notes: studentData.stayNotes || null,
  }),
  ...(studentData.notes !== undefined && {
    notes: studentData.notes || null,
  }),
});

export const mergeSchoolScopedStudentFields = (
  user: DbUser,
  membership?: Partial<SchoolScopedStudentFields> | null,
): MergedStudentUser => ({
    ...user,
  skill_level: membership?.skill_level ?? user.skill_level ?? null,
    preferred_disciplines:
    membership?.preferred_disciplines ?? user.preferred_disciplines ?? null,
  primary_sport: membership?.primary_sport ?? user.primary_sport ?? null,
  riding_background: membership?.riding_background ?? user.riding_background ?? null,
  preferred_days: membership?.preferred_days ?? user.preferred_days ?? null,
    preferred_time_slots:
    membership?.preferred_time_slots ?? user.preferred_time_slots ?? null,
    preferred_lesson_types:
    membership?.preferred_lesson_types ?? user.preferred_lesson_types ?? null,
  preferred_language:
    membership?.preferred_language ?? user.preferred_language ?? null,
    consent_physical_condition:
    membership?.consent_physical_condition ??
    user.consent_physical_condition ??
    null,
    consent_terms_conditions:
    membership?.consent_terms_conditions ?? user.consent_terms_conditions ?? null,
  consent_gdpr: membership?.consent_gdpr ?? user.consent_gdpr ?? null,
    consent_photos_videos:
    membership?.consent_photos_videos ?? user.consent_photos_videos ?? null,
  consent_marketing: membership?.consent_marketing ?? user.consent_marketing ?? null,
  consent_custom_1: membership?.consent_custom_1 ?? user.consent_custom_1 ?? null,
  consent_custom_2: membership?.consent_custom_2 ?? user.consent_custom_2 ?? null,
  arrival_date: membership?.arrival_date ?? user.arrival_date ?? null,
  departure_date: membership?.departure_date ?? user.departure_date ?? null,
  stay_notes: membership?.stay_notes ?? user.stay_notes ?? null,
  notes: membership?.notes ?? user.notes ?? null,
  school_id: membership?.school_id ?? user.school_id ?? null,
  });
