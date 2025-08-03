import type { RegisterUserRequest } from "../models/RegisterUserRequest";
import type { UserLoginRequest } from "../models/UserLoginRequest";
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

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