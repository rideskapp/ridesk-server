/*
 * @fileoverview Phone number validation utility
 */

import { parsePhoneNumberFromString, isValidPhoneNumber } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

export interface PhoneValidationResult {
  isValid: boolean;
  formattedNumber?: string;
  countryCode?: string | undefined;
  nationalNumber?: string | undefined;
  error?: string | undefined;
}

// Validate and format a phone number

export const validatePhoneNumber = (
  phoneNumber: string,
  defaultCountry?: CountryCode,
): PhoneValidationResult => {
  if (!phoneNumber || phoneNumber.trim() === "") {
    return {
      isValid: false,
      error: "Phone number is required",
    };
  }

  try {
    if (!isValidPhoneNumber(phoneNumber, defaultCountry)) {
      return {
        isValid: false,
        error: "Invalid phone number format",
      };
    }

    const phoneNumberData = parsePhoneNumberFromString(phoneNumber, defaultCountry);

    if (!phoneNumberData) {
      return {
        isValid: false,
        error: "Could not parse phone number",
      };
    }

    return {
      isValid: true,
      formattedNumber: phoneNumberData.formatInternational(),
      countryCode: phoneNumberData.country,
      nationalNumber: phoneNumberData.nationalNumber,
    };
  } catch (error: unknown) {
    let message = "Invalid phone number";
    if (error instanceof Error && error.message) {
      message = error.message;
    } else if (typeof error === "string" && error) {
      message = error;
    }
    return {
      isValid: false,
      error: message,
    };
  }
};

 // Format phone number to international format
 
export const formatPhoneNumber = (
  phoneNumber: string,
  defaultCountry?: CountryCode,
): string => {
  const validation = validatePhoneNumber(phoneNumber, defaultCountry);
  return validation.formattedNumber || phoneNumber;
};

