import { toaster } from "../../ui/toaster";

// The backend answers errors as { error: "..." }; fall back to the status code.
export const errorMessage = async (response) => {
  if (!response) return "The server could not be reached.";
  try {
    const body = await response.json();
    if (body?.error) return body.error;
  } catch (e) {
    // not JSON
  }
  return `Request failed (HTTP ${response.status}).`;
};

export const showError = async (title, response) =>
  toaster.create({ title, description: await errorMessage(response), type: "error" });
