
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function GetSecret(): Promise<Response> {
  const token = localStorage.getItem("jwt");
  let result = await fetch(`${BASE_URL}/api/Dashboard/GetBasicInformation`, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "accept": "*/*",
    "Authorization": `Bearer ${token}`
  },
  });
  return result;
}