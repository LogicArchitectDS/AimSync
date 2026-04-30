import { handlers } from "@/auth"

// Export the GET and POST handlers to catch Discord callbacks
export const { GET, POST } = handlers

// Ensure this runs on the Edge to match your D1 database setup
export const runtime = "edge"