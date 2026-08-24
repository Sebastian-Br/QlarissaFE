import type { RegisterUserRequest } from "../models/RegisterUserRequest";
import type { UserLoginRequest } from "../models/UserLoginRequest";
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Replace these paths with the backend availability endpoints when they are available.
export const USERNAME_AVAILABILITY_ENDPOINT = "/api/Account/CheckUsernameAvailability";
export const EMAIL_AVAILABILITY_ENDPOINT = "/api/Account/CheckEmailAvailability";

export interface AvailabilityResponse {
  available: boolean;
}

export async function checkUsernameAvailability(username: string, signal?: AbortSignal): Promise<AvailabilityResponse> {
  const response = await fetch(`${BASE_URL}${USERNAME_AVAILABILITY_ENDPOINT}?username=${encodeURIComponent(username)}`, {
    signal,
    headers: { accept: "*/*" },
  });

  return response.json();
}

export async function checkEmailAvailability(email: string, signal?: AbortSignal): Promise<AvailabilityResponse> {
  const response = await fetch(`${BASE_URL}${EMAIL_AVAILABILITY_ENDPOINT}?email=${encodeURIComponent(email)}`, {
    signal,
    headers: { accept: "*/*" },
  });

  return response.json();
}


export async function registerUser(data: RegisterUserRequest): Promise<Response> {
  let result = fetch(`${BASE_URL}/api/Account/Register`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "accept": "*/*"
  },
  body: JSON.stringify(data)});
  return result;
}

export async function loginAsUser(data: UserLoginRequest): Promise<Response> {
  let result = fetch(`${BASE_URL}/api/Account/Login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "accept": "*/*"
  },
  body: JSON.stringify(data)});
  return result;
}
