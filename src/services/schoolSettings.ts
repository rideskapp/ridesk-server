
import { supabaseAdmin } from "../database/supabase";
import {
  SchoolSettings,
  UpdateSchoolSettingsRequest,
  NotFoundError,
  AppError,
} from "../types";
import { getSchoolById } from "./schools";

const mapRowToSchoolSettings = (row: any): SchoolSettings => ({
  id: row.id,
  schoolId: row.school_id,
  lessonColorScheme:
    (row.lesson_color_scheme as "discipline" | "student_level" | "category") ||
    "discipline",
  customColorOverrides:
    (row.custom_color_overrides as Record<string, any>) || {},
  compensationMode:
    (row.compensation_mode as "fixed" | "variable") || "fixed",
  defaultCurrency: (row.default_currency as string) || "EUR",
  // Consent settings
  termsConditionsUrl: row.terms_conditions_url ?? null,
  termsConditionsLabel: row.terms_conditions_label ?? null,
  customCheckbox1Enabled: row.custom_checkbox_1_enabled ?? false,
  customCheckbox1Label: row.custom_checkbox_1_label ?? null,
  customCheckbox1Url: row.custom_checkbox_1_url ?? null,
  customCheckbox1Mandatory: row.custom_checkbox_1_mandatory ?? true,
  customCheckbox2Enabled: row.custom_checkbox_2_enabled ?? false,
  customCheckbox2Label: row.custom_checkbox_2_label ?? null,
  customCheckbox2Url: row.custom_checkbox_2_url ?? null,
  customCheckbox2Mandatory: row.custom_checkbox_2_mandatory ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getSchoolSettings = async (
  schoolId: string,
): Promise<SchoolSettings> => {
  try {
    const { data: settings, error } = await (supabaseAdmin as any)
      .from("school_settings")
      .select("*")
      .eq("school_id", schoolId)
      .maybeSingle();

    if (error) {
      throw new AppError(`Failed to get school settings: ${error.message}`, 500);
    }

    // If no settings exist, create default settings
    if (!settings) {
      const school = await getSchoolById(schoolId);

      const { data: newSettings, error: createError } = await (supabaseAdmin as any)
        .from("school_settings")
        .insert({
          school_id: schoolId,
          name: school.name,
          disciplines: school.disciplines || [],
          lesson_color_scheme: "discipline",
          custom_color_overrides: {},
          compensation_mode: "fixed",
          default_currency: "EUR",
        })
        .select()
        .single();

      if (createError || !newSettings) {
        throw new AppError(
          `Failed to create default school settings: ${createError?.message || 'Unknown error'}`,
          500,
        );
      }

      return mapRowToSchoolSettings(newSettings);
    }

    return mapRowToSchoolSettings(settings);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to get school settings", 500);
  }
};

export const updateSchoolSettings = async (
  schoolId: string,
  settingsData: UpdateSchoolSettingsRequest,
): Promise<SchoolSettings> => {
  try {
    const existingSettings = await getSchoolSettings(schoolId);

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (settingsData.lessonColorScheme !== undefined) {
      updateData.lesson_color_scheme = settingsData.lessonColorScheme;
    }

    if (settingsData.customColorOverrides !== undefined) {
      updateData.custom_color_overrides = settingsData.customColorOverrides;
    }

    if (settingsData.compensationMode !== undefined) {
      updateData.compensation_mode = settingsData.compensationMode;
    }

    if (settingsData.defaultCurrency !== undefined) {
      updateData.default_currency = settingsData.defaultCurrency;
    }

    // Consent settings
    if (settingsData.termsConditionsUrl !== undefined) {
      updateData.terms_conditions_url = settingsData.termsConditionsUrl;
    }
    if (settingsData.termsConditionsLabel !== undefined) {
      updateData.terms_conditions_label = settingsData.termsConditionsLabel;
    }
    if (settingsData.customCheckbox1Enabled !== undefined) {
      updateData.custom_checkbox_1_enabled = settingsData.customCheckbox1Enabled;
    }
    if (settingsData.customCheckbox1Label !== undefined) {
      updateData.custom_checkbox_1_label = settingsData.customCheckbox1Label;
    }
    if (settingsData.customCheckbox1Url !== undefined) {
      updateData.custom_checkbox_1_url = settingsData.customCheckbox1Url;
    }
    if (settingsData.customCheckbox1Mandatory !== undefined) {
      updateData.custom_checkbox_1_mandatory = settingsData.customCheckbox1Mandatory;
    }
    if (settingsData.customCheckbox2Enabled !== undefined) {
      updateData.custom_checkbox_2_enabled = settingsData.customCheckbox2Enabled;
    }
    if (settingsData.customCheckbox2Label !== undefined) {
      updateData.custom_checkbox_2_label = settingsData.customCheckbox2Label;
    }
    if (settingsData.customCheckbox2Url !== undefined) {
      updateData.custom_checkbox_2_url = settingsData.customCheckbox2Url;
    }
    if (settingsData.customCheckbox2Mandatory !== undefined) {
      updateData.custom_checkbox_2_mandatory = settingsData.customCheckbox2Mandatory;
    }

    const { data: updatedSettings, error } = await (supabaseAdmin as any)
      .from("school_settings")
      .update(updateData)
      .eq("id", existingSettings.id)
      .select()
      .single();

    if (error || !updatedSettings) {
      throw new AppError(
        `Failed to update school settings: ${error?.message || 'Unknown error'}`,
        500,
      );
    }

    return mapRowToSchoolSettings(updatedSettings);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to update school settings", 500);
  }
};
