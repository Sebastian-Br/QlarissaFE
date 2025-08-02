import type { RegisterUserRequest } from "../models/RegisterUserRequest";
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