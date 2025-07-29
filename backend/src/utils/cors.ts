export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const withCors = (response: Response): Response => {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
};

export const jsonResponse = (data: any, options?: ResponseInit): Response => {
  return new Response(JSON.stringify(data), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...options?.headers,
    },
  });
};